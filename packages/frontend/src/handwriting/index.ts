import { parseMathStatement, unitFromLine } from '@openmathtutor/shared';
import { applyCorrections } from './corrections';
import { recognizeSymbol } from './model';
import { CALIBRATION, uncertaintyThreshold } from './calibration';
import { parseLine } from './parse';
import { readLine } from './context';
import { bottom, centerY, elementsToStrokes, groupLines, groupSymbols, median, right } from './strokes';
import type { Alternative, BoardElement, Candidate, RecognitionOptions, RecognizedLine, RecognizedSymbol, Stroke } from './types';

export type { Alternative, BBox, BoardElement, Candidate, RecognitionOptions, RecognizedLine, RecognizedSymbol, Stroke } from './types';
export { classifyRaster, MODEL_LABELS, recognizeSymbol } from './model';
export { rasterizeSymbol } from './raster';
export { parseLine } from './parse';
export { elementsToStrokes, groupLines, groupSymbols } from './strokes';

function stableId(ids: readonly string[]): string {
  let hash = 0xcbf29ce484222325n;
  for (const id of [...ids].sort()) for (const c of `${id.length}:${id}`) hash = BigInt.asUintN(64, (hash ^ BigInt(c.codePointAt(0)!)) * 0x100000001b3n);
  return `hw-${hash.toString(16).padStart(16, '0')}`;
}

function contextualize(symbols: RecognizedSymbol[], symbolStrokes: readonly (readonly Stroke[])[], opts: RecognitionOptions): void {
  const height = median(symbols.map(s => s.bbox.height).filter(h => h > 3));
  const baseline = median(symbols.filter(s => s.bbox.height >= height * .8).map(s => bottom(s.bbox)));
  for (let i = 0; i < symbols.length; i++) {
    const s = symbols[i], best = s.candidates[0].label;
    const strokes = symbolStrokes[i];
    let contextual: string | undefined;
    const left = symbols[i - 1], next = symbols[i + 1];
    let geometryConflict = false;
    // A pair of broad, separated horizontal strokes conflicts with a digit
    // reading. Do not guess equals or recalibrate the model's probability;
    // require the writer to choose, even if the classifier is very confident.
    if (best !== '=' && strokes.length === 2) {
      const [a, b] = strokes.map(stroke => stroke.bbox);
      if ([a, b].every(box => box.width > height * .35 && box.height < box.width * .45)
        && Math.min(a.width, b.width) > Math.max(a.width, b.width) * .55
        && Math.min(right(a), right(b)) - Math.max(a.x, b.x) > Math.min(a.width, b.width) * .65
        && Math.abs(centerY(a) - centerY(b)) > median(strokes.map(stroke => stroke.width))) { s.uncertain = true; geometryConflict = true; }
    }
    // Tiny baseline mark BETWEEN full-height digits is decimal punctuation,
    // regardless of whether its isolated silhouette resembles 1 or slash.
    if (left && next && /^\d$/.test(left.label ?? left.candidates[0].label) && /^\d$/.test(next.candidates[0].label)
      && s.bbox.height < height * .32 && s.bbox.width < height * .3
      && centerY(s.bbox) > baseline - height * .25 && centerY(s.bbox) < baseline + height * .3
      && s.bbox.x >= right(left.bbox) && next.bbox.x >= right(s.bbox)
      && s.bbox.x - right(left.bbox) < height * .7 && next.bbox.x - right(s.bbox) < height * .7
      && Math.min(left.bbox.height, next.bbox.height) > height * .65) {
      // Raster normalization erases absolute size: even a pen tap can look
      // like a midline multiplication dot. Use the original pen footprint,
      // not the class label, to distinguish a dot from a visible comma tail.
      const penWidth = median(strokes.map(stroke => stroke.width));
      const span = Math.max(s.bbox.width, s.bbox.height);
      const closedDot = span <= Math.min(s.bbox.width, s.bbox.height) * 1.5 && strokes.every(stroke => {
        const first = stroke.points[0], last = stroke.points[stroke.points.length - 1];
        // Excalidraw may append the first point to a short hook. Closure alone
        // therefore isn't a dot: require a compact loop with a filled footprint.
        const area = Math.abs(stroke.points.reduce((sum, a, j, points) => {
          const b = points[(j + 1) % points.length];
          return sum + (a[0] - first[0]) * (b[1] - first[1]) - (b[0] - first[0]) * (a[1] - first[1]);
        }, 0)) / 2;
        return stroke.points.length >= 4 && Math.hypot(last[0] - first[0], last[1] - first[1]) <= span * .35
          && area >= s.bbox.width * s.bbox.height * .4;
      });
      s.label = span <= penWidth * .75 || closedDot ? '.' : ',';
      s.uncertain = false;
      continue;
    }
    // Visually identical shapes need context. Preserve raw probabilities rather
    // than claiming the heuristic has increased neural-model certainty.
    if (best === '.' || best === '·') contextual = centerY(s.bbox) < baseline - height * .3 ? '·' : '.';
    if (best === '0' || best === '°') {
      // A circle is a degree sign only when it is much smaller than, and raised above, its digit neighbours.
      const peers = symbols.filter(o => o !== s && /^[0-9]$/.test(o.candidates[0].label) && o.bbox.height > 3);
      if (peers.length) {
        const reference = median(peers.map(o => o.bbox.height));
        contextual = s.bbox.height < reference * .55 && centerY(s.bbox) < baseline - reference * .5 ? '°' : '0';
      }
    }
    const variableSlot = (i === 0 || /^\d$/.test(left?.candidates[0].label ?? '')) && ['=', '+', '-'].includes(next?.candidates[0].label ?? '');
    if ((best === '×' || best === 'x') && variableSlot) contextual = 'x';
    if (contextual && contextual !== best) {
      s.label = contextual;
      s.uncertain = true;
    }
    const numericSlot = /^\d$/.test(left?.label ?? left?.candidates[0].label ?? '')
      && /^\d$/.test(next?.candidates[0].label ?? '');
    // Sum only spellings with the same numeric meaning; other competing labels
    // still reject the reading. No mathematical correctness enters this gate.
    const zeroSlot = contextual !== '°' && (best === '0' || best === 'o')
      && (/^\d$/.test(left?.candidates[0].label ?? '') || /^\d$/.test(next?.candidates[0].label ?? ''));
    const equivalent = numericSlot && (best === 'x' || best === '×') ? ['x', '×'] : zeroSlot ? ['0', 'o'] : undefined;
    if (equivalent && !geometryConflict) {
      const probability = s.candidates.filter(c => equivalent.includes(c.label)).reduce((sum, c) => sum + c.probability, 0);
      const competitor = s.candidates.find(c => !equivalent.includes(c.label))?.probability ?? 0;
      s.uncertain = probability < (opts.confidenceThreshold ?? Math.max(CALIBRATION.numericEquivalentThreshold, uncertaintyThreshold(zeroSlot ? '0' : '×', CALIBRATION.defaultThreshold)))
        || probability - competitor < (opts.marginThreshold ?? CALIBRATION.marginThreshold);
    }
    // x and × already normalize identically between digits. Keep the measured
    // probability/margin gate, rather than rejecting every multiplication sign.
    if (best === '.' || best === '·' || ((best === 'x' || best === '×') && !variableSlot && !numericSlot) || '±≠π°∅'.includes(best)) s.uncertain = true;
  }
}

export interface RecognitionStats { convertedStrokes: number; inferredSymbols: number; cachedSymbols: number }

/** Board-scoped cache. Scan for edits; convert only changed elements and infer only changed symbol groups. */
export function createHandwritingRecognizer(): {
  recognize: (elements: readonly BoardElement[], opts?: RecognitionOptions) => RecognizedLine[];
  clear: () => void;
  readonly stats: RecognitionStats;
} {
  const elementCache = new Map<string, { fingerprint: string; stroke: Stroke | null }>();
  const symbolCache = new Map<string, Candidate[]>();
  const stats: RecognitionStats = { convertedStrokes: 0, inferredSymbols: 0, cachedSymbols: 0 };
  return {
    stats,
    clear: () => { elementCache.clear(); symbolCache.clear(); },
    recognize(elements, opts = {}) {
      stats.convertedStrokes = 0; stats.inferredSymbols = 0; stats.cachedSymbols = 0;
      const threshold = opts.confidenceThreshold, margin = opts.marginThreshold ?? CALIBRATION.marginThreshold;
      if (![threshold ?? .8, margin].every(n => Number.isFinite(n) && n >= 0 && n <= 1)) throw new RangeError('Confidence thresholds must be in [0,1]');
      if (elements.length > 10000) throw new RangeError('At most 10000 board elements per recognition');
      elementsToStrokes([], opts); // Validate screen viewport even on an empty/cached board.
      let count = 0;
      const seen = new Set<string>(), current: Stroke[] = [];
      const viewportKey = opts.inputSpace === 'screen' ? JSON.stringify(opts.viewport) : 'scene';
      for (const [order, e] of elements.entries()) {
        if (e.type !== 'freedraw' || e.isDeleted || seen.has(e.id)) continue;
        count += e.points?.length ?? 0;
        if (count > 200000) throw new RangeError('At most 200000 stroke points per recognition');
        seen.add(e.id);
        const fingerprint = JSON.stringify([e.x, e.y, e.points, e.angle, e.strokeWidth, e.scale, e.createdAt, viewportKey],
          (_, value: unknown) => typeof value === 'number' && !Number.isFinite(value) ? String(value) : value);
        let cached = elementCache.get(e.id);
        if (!cached || cached.fingerprint !== fingerprint) {
          cached = { fingerprint, stroke: elementsToStrokes([e], opts)[0] ?? null };
          elementCache.set(e.id, cached); stats.convertedStrokes++;
        }
        if (cached.stroke) current.push({ ...cached.stroke, order });
      }
      for (const id of elementCache.keys()) if (!seen.has(id)) elementCache.delete(id);
      if (current.every(s => s.createdAt !== undefined)) current.sort((a, b) => a.createdAt! - b.createdAt! || a.order - b.order);
      current.forEach((s, order) => { s.order = order; });
      if (current.length > 2048) throw new RangeError('At most 2048 strokes per recognition');
      const corrected = applyCorrections(current);
      // Stray pen taps are not mathematical rows. Keep punctuation near a
      // real glyph (including decimal dots and division colons).
      const tiny = (s: Stroke) => Math.max(s.bbox.width, s.bbox.height) <= Math.max(6, s.width * 2);
      const taps = corrected.active.filter(s => tiny(s) && !corrected.active.some(o => o !== s && !tiny(o)
        && Math.abs(centerY(s.bbox) - centerY(o.bbox)) < o.bbox.height * 1.4
        && Math.max(s.bbox.x, o.bbox.x) - Math.min(right(s.bbox), right(o.bbox)) < Math.max(o.bbox.height, o.bbox.width) * 1.2));
      const active = corrected.active.filter(s => !taps.includes(s)), ignored = [...corrected.ignored, ...taps];
      const usedKeys = new Set<string>();
      const recognized = groupLines(groupSymbols(active)).map(line => {
        const symbols: RecognizedSymbol[] = line.symbols.map(symbol => {
          const key = JSON.stringify(symbol.strokes.map(s => [s.id, elementCache.get(s.id)!.fingerprint]));
          usedKeys.add(key);
          let candidates = symbolCache.get(key);
          if (!candidates) { candidates = recognizeSymbol(symbol.strokes); symbolCache.set(key, candidates); stats.inferredSymbols++; }
          else stats.cachedSymbols++;
          return { bbox: { ...symbol.bbox }, strokeIds: symbol.strokes.map(s => s.id), strokeOrder: symbol.strokes.map(s => s.order),
            candidates: candidates.map(c => ({ ...c })),
            uncertain: candidates[0].probability < (threshold ?? uncertaintyThreshold(candidates[0].label, CALIBRATION.defaultThreshold))
              || candidates[0].probability - candidates[1].probability < margin };
        });
        contextualize(symbols, line.symbols.map(s => s.strokes), opts);
        const parsed = readLine(symbols, { unitAliases: opts.unitAliases, expectedUnit: opts.expectedUnit }), alternatives: Alternative[] = [];
        if (parsed.contextualized && parsed.rawText && !alternatives.some(a => a.text === parsed.rawText)) {
          alternatives.push({ text: parsed.rawText, confidence: parsed.rawConfidence });
        }
        for (let i = 0; i < symbols.length; i++) for (let rank = 0; rank < symbols[i].candidates.length; rank++) {
          const choices = symbols.map(() => -1); choices[i] = rank;
          const alternative = parseLine(symbols, choices, opts.unitAliases);
          if (alternative.text !== parsed.text && !alternatives.some(a => a.text === alternative.text)) alternatives.push({ text: alternative.text, confidence: alternative.confidence });
        }
        const strokeIds = line.symbols.flatMap(s => s.strokes).sort((a, b) => a.order - b.order).map(s => s.id);
        let parserCompatible = true;
        try { parseMathStatement(parsed.text); } catch {
          const unit = unitFromLine(parsed.text);
          try { if (!unit || !opts.unitAliases?.includes(unit)) throw new Error('Unsupported unit'); parseMathStatement(parsed.text.slice(0, -unit.length).trim()); } catch { parserCompatible = false; }
        }
        return { id: stableId(strokeIds), strokeIds, text: parsed.text, confidence: parsed.confidence,
          alternatives: alternatives.sort((a, b) => b.confidence - a.confidence).slice(0, 3), bbox: { ...line.bbox }, symbols, parserCompatible,
          ...(parsed.contextualized ? { rawText: parsed.rawText, contextualized: true } : {}),
          ignoredStrokeIds: ignored.map(s => s.id), crossOutUncertain: corrected.ambiguous.some(s => strokeIds.includes(s.id)), ...(parsed.uncertain || corrected.ambiguous.some(s => strokeIds.includes(s.id)) ? { uncertain: true } : {}) };
      });
      for (const key of symbolCache.keys()) if (!usedKeys.has(key)) symbolCache.delete(key);
      return recognized;
    },
  };
}

/** Stateless API; use createHandwritingRecognizer per board for incremental edits. No DOM, network or mutation. */
export function recognizeBoardLines(elements: readonly BoardElement[], opts: RecognitionOptions = {}): RecognizedLine[] {
  return createHandwritingRecognizer().recognize(elements, opts);
}
