import { bottom, centerX, centerY, groupSymbols, isBar, isRadicalStroke, right } from './strokes';
import type { Stroke } from './types';

export interface CorrectedStrokes { active: Stroke[]; ignored: Stroke[]; ambiguous: Stroke[] }

/**
 * Conservative chronological heuristic, NOT semantic intent detection. A later
 * straight cross-out must be 45% wider than the old glyph; a dense scribble can
 * be narrower. Preserve 7 crossbars, +, ≠ and slashed-zero/∅. Underlines below
 * ink are annotations. Ambiguous short cross-outs require human confirmation.
 */
export function applyCorrections(strokes: readonly Stroke[]): CorrectedStrokes {
  let active: Stroke[] = [];
  const ignored: Stroke[] = [];
  const ambiguous: Stroke[] = [];
  let comparisons = 0;
  for (const stroke of strokes) {
    const b = stroke.bbox;
    const fractionPeer = (s: Stroke) => s !== stroke && s.bbox.height > b.width * .3
      && centerX(s.bbox) > b.x && centerX(s.bbox) < right(b)
      && Math.abs(centerY(s.bbox) - centerY(b)) < b.width * 1.5;
    // A fraction bar can look like an underline until its denominator is
    // written. Reconsider the complete scene, including later strokes.
    if (isBar(b) && strokes.some(s => fractionPeer(s) && bottom(s.bbox) < b.y - stroke.width)
      && strokes.some(s => fractionPeer(s) && s.bbox.y > bottom(b) + stroke.width)) {
      active.push(stroke); continue;
    }
    let length = 0;
    for (let i = 1; i < stroke.points.length; i++) length += Math.hypot(stroke.points[i][0] - stroke.points[i - 1][0], stroke.points[i][1] - stroke.points[i - 1][1]);
    const span = Math.hypot(b.width, b.height);
    const dense = length > span * 3.5 && b.width > stroke.width * 4;
    const straight = span > stroke.width * 4 && length < span * 1.12;
    // A complete, late, curved redraw after the writer has continued elsewhere.
    // Immediate overdraw cannot reliably be distinguished from a multi-stroke glyph.
    if (active.length && length > span * 1.35 && b.height > stroke.width * 5) {
      const overwritten = groupSymbols(active).filter(s => {
        const last = s.strokes[s.strokes.length - 1], old = s.bbox;
        const late = stroke.order - last.order >= 4 || (stroke.createdAt !== undefined && last.createdAt !== undefined && stroke.createdAt - last.createdAt > 1500);
        return late && b.height > old.height * .7 && b.height < old.height * 1.5
          && Math.abs(centerX(b) - centerX(old)) < Math.max(b.width, old.width) * .4
          && Math.min(bottom(b), bottom(old)) - Math.max(b.y, old.y) > Math.min(b.height, old.height) * .7;
      });
      const ids = new Set(overwritten.flatMap(s => s.strokes.map(p => p.id)));
      ignored.push(...active.filter(s => ids.has(s.id)));
      active = active.filter(s => !ids.has(s.id));
    }
    if (active.length && (straight || dense) && !isRadicalStroke(stroke)) {
      comparisons += active.length;
      if (comparisons > 200000) throw new RangeError('Correction complexity budget exceeded');
      // Ordinary following symbols do not overlap earlier ink; avoid reclustering.
      if (!active.some(s => right(s.bbox) >= b.x && s.bbox.x <= right(b)
        && bottom(s.bbox) + s.bbox.height * .3 >= b.y && s.bbox.y <= bottom(b))) {
        active.push(stroke); continue;
      }
      const symbols = groupSymbols(active);
      const crossed = symbols.filter(s => {
        const old = s.bbox;
        // A first vertical stem is not a completed glyph: a later horizontal
        // stroke may finish + or *. Do not mistake ordinary construction for undo.
        if (s.strokes.length === 1) {
          const points = s.strokes[0].points;
          let path = 0;
          for (let i = 1; i < points.length; i++) path += Math.hypot(points[i][0] - points[i - 1][0], points[i][1] - points[i - 1][1]);
          if (path < Math.hypot(old.width, old.height) * 1.35) return false;
        }
        if (old.height < stroke.width * 3 || b.width < Math.max(old.width * (dense ? .9 : 1.6), old.height * (dense ? .7 : 1.2))) return false;
        if (centerX(old) < b.x || centerX(old) > right(b)) return false;
        const first = stroke.points[0], last = stroke.points[stroke.points.length - 1];
        const t = (centerX(old) - first[0]) / (last[0] - first[0] || 1);
        const y = dense ? centerY(b) : first[1] + (last[1] - first[1]) * t;
        return y > old.y + old.height * .2 && y < bottom(old) - old.height * .2;
      });
      const underlined = isBar(b) && symbols.some(s => b.width > s.bbox.width * 1.2 && centerX(s.bbox) >= b.x && centerX(s.bbox) <= right(b)
        && b.y > bottom(s.bbox) + stroke.width && b.y < bottom(s.bbox) + s.bbox.height * .3);
      if (crossed.length) {
        const ids = new Set(crossed.flatMap(s => s.strokes.map(p => p.id)));
        ignored.push(...active.filter(s => ids.has(s.id)), stroke);
        active = active.filter(s => !ids.has(s.id));
        continue;
      }
      if (underlined) { ignored.push(stroke); continue; }
      // A short, late slash may be a cross-out but is not safe to delete.
      // Never guess its mathematical meaning: ask for an eraser instead.
      if (straight && symbols.some(s => {
        const old = s.bbox, last = s.strokes.at(-1)!;
        // A real correction slash reaches past both sides of the old glyph. A
        // crossbar inside a letter (A, H, e) stays within it and must not ask
        // the student to erase a correct answer.
        return stroke.order - last.order >= 2 && old.height > stroke.width * 5 && b.width > old.width * 1.05
          && b.x < old.x - stroke.width * .5 && right(b) > right(old) + stroke.width * .5
          && centerX(old) > b.x && centerX(old) < right(b)
          && centerY(b) > old.y + old.height * .2 && centerY(b) < bottom(old) - old.height * .2;
      })) ambiguous.push(stroke);
    }
    active.push(stroke);
  }
  return { active, ignored, ambiguous };
}
