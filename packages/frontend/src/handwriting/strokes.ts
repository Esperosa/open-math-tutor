import type { BBox, BoardElement, Point, RecognitionOptions, Stroke, StrokeLine, StrokeSymbol } from './types';

export const right = (b: BBox): number => b.x + b.width;
export const bottom = (b: BBox): number => b.y + b.height;
export const centerX = (b: BBox): number => b.x + b.width / 2;
export const centerY = (b: BBox): number => b.y + b.height / 2;
export function union(boxes: readonly BBox[]): BBox {
  if (!boxes.length) return { x: 0, y: 0, width: 0, height: 0 };
  let x = Infinity, y = Infinity, x2 = -Infinity, y2 = -Infinity;
  for (const b of boxes) { x = Math.min(x, b.x); y = Math.min(y, b.y); x2 = Math.max(x2, right(b)); y2 = Math.max(y2, bottom(b)); }
  return { x, y, width: x2 - x, height: y2 - y };
}
export function median(values: number[]): number {
  if (!values.length) return 1;
  const s = [...values].sort((a, b) => a - b);
  return s[Math.floor(s.length / 2)];
}
const finite = (n: unknown): n is number => typeof n === 'number' && Number.isFinite(n) && Math.abs(n) <= 1e8;

/**
 * Scene coordinates are authoritative. Stored points already include Excalidraw
 * resizing; applying width/height or viewport zoom again would distort handwriting.
 * Rotation is about the unrotated points' bounds (including negative local points).
 * Optional screen imports are inverted AFTER element rotation/scale.
 * Invalid input is ignored; oversized input fails explicitly rather than truncating.
 */
export function elementsToStrokes(elements: readonly BoardElement[], opts: RecognitionOptions = {}): Stroke[] {
  if (elements.length > 10000) throw new RangeError('At most 10000 board elements per recognition');
  const v = opts.viewport;
  if (opts.inputSpace === 'screen' && (!v || !finite(v.zoom) || v.zoom <= 0 || !finite(v.scrollX) || !finite(v.scrollY)
    || !finite(v.offsetLeft ?? 0) || !finite(v.offsetTop ?? 0))) throw new RangeError('Screen input requires a finite, positive viewport');
  const result: Stroke[] = [];
  let pointCount = 0;
  const ids = new Set<string>();
  for (const [order, e] of elements.entries()) {
    if (e.type !== 'freedraw' || e.isDeleted || !e.points?.length) continue;
    if (!e.id || e.id.length > 512 || ids.has(e.id) || !finite(e.x) || !finite(e.y) || !finite(e.angle ?? 0)) continue;
    pointCount += e.points.length;
    if (pointCount > 200000) throw new RangeError('At most 200000 stroke points per recognition');
    if (e.points.some(p => !finite(p[0]) || !finite(p[1]))) continue;
    const sx = e.scale?.[0] ?? 1, sy = e.scale?.[1] ?? 1;
    if (!finite(sx) || !finite(sy) || !sx || !sy || !finite(e.strokeWidth ?? 2) || (e.strokeWidth ?? 2) <= 0) continue;
    let x1 = Infinity, y1 = Infinity, x2 = -Infinity, y2 = -Infinity;
    for (const p of e.points) {
      x1 = Math.min(x1, p[0] * sx); x2 = Math.max(x2, p[0] * sx);
      y1 = Math.min(y1, p[1] * sy); y2 = Math.max(y2, p[1] * sy);
    }
    const cx = (x1 + x2) / 2, cy = (y1 + y2) / 2;
    const c = Math.cos(e.angle ?? 0), s = Math.sin(e.angle ?? 0);
    const points: Point[] = e.points.map(p => {
      const dx = p[0] * sx - cx, dy = p[1] * sy - cy;
      let x = e.x + cx + c * dx - s * dy, y = e.y + cy + s * dx + c * dy;
      if (opts.inputSpace === 'screen' && v) {
        x = (x - (v.offsetLeft ?? 0)) / v.zoom - v.scrollX;
        y = (y - (v.offsetTop ?? 0)) / v.zoom - v.scrollY;
      }
      return [x, y];
    });
    if (points.some(p => !finite(p[0]) || !finite(p[1]))) continue;
    const bbox = union(points.map(p => ({ x: p[0], y: p[1], width: 0, height: 0 })));
    result.push({ id: e.id, points, bbox, order, width: (e.strokeWidth ?? 2) * Math.sqrt(Math.abs(sx * sy)) / (opts.inputSpace === 'screen' ? v!.zoom : 1),
      ...(finite(e.createdAt) ? { createdAt: e.createdAt } : {}) });
    ids.add(e.id);
  }
  // `updated` is intentionally NOT a creation time: moving a stroke must not reorder it.
  if (result.every(s => s.createdAt !== undefined)) result.sort((a, b) => a.createdAt! - b.createdAt! || a.order - b.order);
  return result.map((s, order) => ({ ...s, order }));
}

function clusters<T>(items: readonly T[], related: (a: T, b: T) => boolean): T[][] {
  const groups: T[][] = [];
  for (const item of items) {
    const hits: number[] = [];
    for (let i = 0; i < groups.length; i++) if (groups[i].some(other => related(item, other))) hits.push(i);
    if (!hits.length) groups.push([item]);
    else {
      const target = groups[hits[0]];
      target.push(item);
      for (let i = hits.length - 1; i > 0; i--) target.push(...groups.splice(hits[i], 1)[0]);
    }
  }
  return groups;
}
const overlapX = (a: BBox, b: BBox): number => Math.min(right(a), right(b)) - Math.max(a.x, b.x);
const overlapY = (a: BBox, b: BBox): number => Math.min(bottom(a), bottom(b)) - Math.max(a.y, b.y);
export const isBar = (b: BBox): boolean => b.width > 4 && b.height < b.width * .18;
const isBarLike = (b: BBox): boolean => b.width > 4 && b.height < b.width * .45;

/** A root hook ending in an overbar; keep covered radicands out of the root's symbol. */
export function isRadicalStroke(s: Stroke): boolean {
  if (s.points.length < 4 || s.bbox.width < s.bbox.height * 1.1 || s.bbox.height < s.bbox.width * .3) return false;
  const p = s.points, first = p[0], last = p[p.length - 1];
  // The hook must actually descend and rise: a short horizontal serif or the
  // bottom flourish of a digit has a similar box, but barely climbs.
  return last[0] > first[0] + s.bbox.width * .75 && last[1] < s.bbox.y + s.bbox.height * .2
    && first[1] > s.bbox.y + s.bbox.height * .3 && first[1] < bottom(s.bbox) - s.bbox.height * .15
    && bottom(s.bbox) - last[1] > s.bbox.height * .5 && first[1] - last[1] > s.bbox.height * .45;
}

/** Spatially overlapping, nearby-in-order strokes form a symbol, not one character per pen-down. */
export function groupSymbols(strokes: readonly Stroke[]): StrokeSymbol[] {
  if (strokes.length > 2048) throw new RangeError('At most 2048 strokes per recognition');
  // Upper decile of stroke sizes, not the median: multi-stroke glyphs add many
  // short flourishes, while the letter height is what spacing rules need.
  const sizes = strokes.map(s => Math.max(s.bbox.height, s.bbox.width)).filter(h => h > 2).sort((a, b) => a - b);
  const typical = sizes.length ? sizes[Math.min(sizes.length - 1, Math.floor(sizes.length * .9))] : 1;
  const dividePairs = new Set<string>();
  for (const bar of strokes.filter(s => isBar(s.bbox))) {
    const b = bar.bbox;
    const dots = strokes.filter(s => s !== bar && Math.max(s.bbox.width, s.bbox.height) < b.width * .22
      && Math.abs(centerX(s.bbox) - centerX(b)) < b.width * .2
      && Math.abs(centerY(s.bbox) - centerY(b)) < b.width * .8
      && Math.abs(s.order - bar.order) <= 6);
    if (dots.some(d => centerY(d.bbox) < b.y) && dots.some(d => centerY(d.bbox) > bottom(b))) {
      for (const d of dots) dividePairs.add([bar.id, d.id].sort().join('\0'));
    }
  }
  // A root hook spans a large part of the line height; small ticks at the bottom
  // of a glyph can match its silhouette and must stay part of that glyph.
  const tallest = Math.max(1, ...strokes.map(s => s.bbox.height));
  const radical = (s: Stroke): boolean => isRadicalStroke(s) && s.bbox.height > tallest * .4;
  // A fraction bar is a separate layout token, never a detached serif of
  // numerator/denominator. Decide from strokes before merging glyphs.
  const fractionBars = new Set(strokes.filter(bar => {
    if (!isBar(bar.bbox)) return false;
    const peers = strokes.filter(s => s !== bar && s.bbox.height > typical * .3
      && centerX(s.bbox) > bar.bbox.x && centerX(s.bbox) < right(bar.bbox)
      && Math.abs(centerY(s.bbox) - centerY(bar.bbox)) < Math.max(typical, bar.bbox.width) * 1.5);
    return peers.some(s => bottom(s.bbox) < bar.bbox.y - bar.width)
      && peers.some(s => s.bbox.y > bottom(bar.bbox) + bar.width);
  }));
  const dots = strokes.filter(s => Math.max(s.bbox.width, s.bbox.height) < typical * .2);
  const dotNeighbor = new Map(dots.map(dot => [dot, dots.filter(other => other !== dot
    && Math.abs(centerX(dot.bbox) - centerX(other.bbox)) < typical * .3
    && Math.abs(centerY(dot.bbox) - centerY(other.bbox)) < typical * 1.1)
    .sort((a, b) => Math.abs(centerY(dot.bbox) - centerY(a.bbox)) - Math.abs(centerY(dot.bbox) - centerY(b.bbox)))[0]]));
  const groups = clusters(strokes, (a, b) => {
    if (Math.abs(a.order - b.order) > 12) return false;
    const x = a.bbox, y = b.bbox;
    if (fractionBars.has(a) || fractionBars.has(b)) return false;
    if (radical(a) || radical(b)) return false;
    if (dividePairs.has([a.id, b.id].sort().join('\0'))) return true;
    const ox = overlapX(x, y), oy = overlapY(x, y);

    // Equals: two roughly horizontal strokes one above the other, even if slanted or non-parallel
    if (isBar(x) && isBar(y)) {
      if (ox > .65 * Math.min(x.width, y.width)
        && Math.min(x.width, y.width) > .55 * Math.max(x.width, y.width)
        && Math.abs(centerY(x) - centerY(y)) < .75 * Math.max(x.width, y.width)) return true;
    }
    if (isBarLike(x) && isBarLike(y)) {
      const minW = Math.min(x.width, y.width), maxW = Math.max(x.width, y.width);
      const dy = Math.abs(centerY(x) - centerY(y));
      const dx = Math.abs(centerX(x) - centerX(y));
      if (ox > .5 * minW && minW > .45 * maxW && dx < maxW * .4 && dy > Math.max(a.width, b.width) * .55 && dy < maxW * 1.15) return true;
    }

    // Colon: two small, vertically aligned dots. Two isolated dots are ambiguous.
    if (Math.max(x.width, x.height, y.width, y.height) < typical * .2
      && Math.abs(centerX(x) - centerX(y)) < typical * .3
      && Math.abs(centerY(x) - centerY(y)) < typical * 1.1) return dotNeighbor.get(a) === b && dotNeighbor.get(b) === a;
    // Disconnected inequality underline (≤/≥) and other same-column components.
    if (ox > Math.min(x.width, y.width) * .65 && oy < 0 && oy > -typical * .25
      && Math.min(x.width, y.width) > Math.max(x.width, y.width) * .6) return true;

    // European 7 crossbar: a short horizontal stroke intersecting the middle of a taller stroke
    if (Math.min(x.height, y.height) < typical * .3 && Math.max(x.height, y.height) > typical * .5) {
      const cross = x.height < y.height ? x : y, stem = cross === x ? y : x;
      if (cross.width > cross.height * 1.5 && cross.width < stem.width * 1.1
        && Math.abs(centerY(cross) - centerY(stem)) < stem.height * .32
        && centerX(cross) > stem.x - typical * .15 && centerX(cross) < right(stem) + typical * .15
        && ox >= -typical * .05 && oy >= -typical * .05) return true;
    }

    // A flat stroke directly above or below a taller one is a detached part of
    // that glyph (top bar of 5/7, serif, underline), not a new character.
    const thin = x.height <= y.height ? x : y, tall = thin === x ? y : x;
    if (thin.height < thin.width * .5 && thin.height < typical * .25 && thin.width < tall.width * 1.15
      && ox > Math.min(x.width, y.width) * .55) {
      const above = bottom(thin) <= tall.y + typical * .06 && tall.y - bottom(thin) < typical * .35;
      const below = thin.y >= bottom(tall) - typical * .06 && thin.y - bottom(tall) < typical * .35;
      if (above || below) return true;
    }
    // A percent sign is a slanted stroke plus two small loops: the loops only
    // touch the slash at their corners, so size/overlap tests alone split it
    // into a digit and a zero. Merge a compact loop with a straight slant.
    const compact = (box: BBox): boolean => box.height > typical * .2 && box.height < typical * .6
      && box.width > box.height * .6 && box.width < box.height * 1.6;
    const slant = (s: Stroke): boolean => {
      let path = 0;
      for (let i = 1; i < s.points.length; i++) path += Math.hypot(s.points[i]![0] - s.points[i - 1]![0], s.points[i]![1] - s.points[i - 1]![1]);
      const dx = s.bbox.width, dy = s.bbox.height, span = Math.hypot(dx, dy);
      return span > s.width * 4 && path < span * 1.12 && dx > dy * .25 && dy > dx * .5;
    };
    if (((compact(x) && slant(b)) || (compact(y) && slant(a)))
      && ox > Math.min(x.width, y.width) * .1 && oy > Math.min(x.height, y.height) * .3) return true;
    // Multi-stroke letters such as V, W and M meet at a corner where their
    // bounding boxes overlap by less than a pen width. Join them only when a
    // stroke end really lands on the other stroke and both are tall glyphs.
    const distance = (p: readonly number[], q: readonly number[]): number => Math.hypot(p[0]! - q[0]!, p[1]! - q[1]!);
    const nearEnd = Math.min(
      distance(a.points[0]!, b.points[0]!), distance(a.points[0]!, b.points.at(-1)!),
      distance(a.points.at(-1)!, b.points[0]!), distance(a.points.at(-1)!, b.points.at(-1)!));
    const unionWidth = Math.max(right(x), right(y)) - Math.min(x.x, y.x);
    if (Math.min(x.height, y.height) > typical * .5 && oy > Math.min(x.height, y.height) * .6
      && ox >= -typical * .03 && unionWidth > typical * .5 && unionWidth < typical * 1.8
      && nearEnd < typical * .15) return true;

    // A horizontal bar touching a tall full-height stem near the bar's outer tip
    // and in the middle of the stem is a collision between adjacent characters (+ or - touching 1).
    const isHorizA = x.width > x.height * 3 && x.width > typical * .3;
    const isStemB = y.height > typical * .6 && y.height > y.width * 3;
    const isHorizB = y.width > y.height * 3 && y.width > typical * .3;
    const isStemA = x.height > typical * .6 && x.height > x.width * 3;
    if ((isHorizA && isStemB) || (isHorizB && isStemA)) {
      const bar = isHorizA ? x : y, stem = isHorizA ? y : x;
      const atBarTip = Math.abs(centerX(bar) - centerX(stem)) > bar.width * .35;
      const inStemMiddle = centerY(bar) > stem.y + stem.height * .25 && centerY(bar) < bottom(stem) - stem.height * .25;
      const shallowOverlap = ox < bar.width * .25;
      if (atBarTip && inStemMiddle && shallowOverlap) return false;
    }

    const tolerance = Math.min(typical * .06, Math.max(a.width, b.width));
    return ox >= -tolerance && oy >= -tolerance
      && (ox > Math.min(x.width, y.width) * .2 || Math.min(x.width, y.width) < tolerance);
  });
  return groups.map(strokes => ({ strokes: strokes.sort((a, b) => a.order - b.order), bbox: union(strokes.map(s => s.bbox)) }))
    .sort((a, b) => a.bbox.x - b.bbox.x);
}

/** Fraction bars connect numerator/denominator before baseline clustering; superscripts stay with their base. */
export function groupLines(symbols: readonly StrokeSymbol[]): StrokeLine[] {
  const h = median(symbols.filter(s => !isBar(s.bbox)).map(s => s.bbox.height).filter(v => v > 2));
  const fractionLinks = new Map<StrokeSymbol, Set<StrokeSymbol>>();
  for (const bar of symbols.filter(s => isBar(s.bbox))) {
    const b = bar.bbox;
    const near = symbols.filter(s => s !== bar && centerX(s.bbox) >= b.x && centerX(s.bbox) <= right(b)
      && Math.abs(centerY(s.bbox) - centerY(b)) < Math.max(h, b.width) * 1.3);
    if (near.some(s => bottom(s.bbox) < centerY(b)) && near.some(s => s.bbox.y > centerY(b))) fractionLinks.set(bar, new Set(near));
  }
  const groups = clusters(symbols, (a, b) => {
    if (fractionLinks.get(a)?.has(b) || fractionLinks.get(b)?.has(a)) return true;
    const x = a.bbox, y = b.bbox;
    const gap = Math.max(x.x, y.x) - Math.min(right(x), right(y));
    if (gap > h * 6) return false;
    if (overlapY(x, y) >= Math.min(x.height, y.height) * .25 && overlapY(x, y) >= 0) return true;
    const tall = x.height >= y.height ? x : y, small = tall === x ? y : x;
    if (Math.abs(centerY(x) - centerY(y)) < h * .38) return true;
    return small.height < tall.height * .78 && gap < h * 1.5
      && bottom(small) >= tall.y - h * .25 && centerY(small) < centerY(tall);
  });
  return groups.map(symbols => ({ symbols: symbols.sort((a, b) => a.bbox.x - b.bbox.x), bbox: union(symbols.map(s => s.bbox)) }))
    .sort((a, b) => a.bbox.y - b.bbox.y || a.bbox.x - b.bbox.x);
}
