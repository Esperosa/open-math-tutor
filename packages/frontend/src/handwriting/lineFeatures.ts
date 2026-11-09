import type { Point, Stroke } from './types';

export interface LineInput { features: Float32Array; points: Point[]; strokeIndices: number[] }
export const LINE_STEP = .08;
export const LINE_MAX_POINTS = 1024;

/** Arc-length sampling, not event-count normalization. Pen-up never draws a line. */
export function lineFeatures(strokes: readonly Stroke[]): LineInput {
  if (strokes.length > 256) throw new RangeError('At most 256 strokes per CTC line');
  const points: Point[] = [], strokeIndices: number[] = [], values: number[] = [];
  let x0 = Infinity, y0 = Infinity, y1 = -Infinity, count = 0, length = 0;
  for (const s of strokes) for (let i = 0; i < s.points.length; i++) {
    const [x, y] = s.points[i];
    if (!Number.isFinite(x) || !Number.isFinite(y)) throw new RangeError('Finite line points required');
    x0 = Math.min(x0, x); y0 = Math.min(y0, y); y1 = Math.max(y1, y);
    if (i) length += Math.hypot(x - s.points[i - 1][0], y - s.points[i - 1][1]);
    if (++count > 200000) throw new RangeError('At most 200000 line points');
  }
  if (!count) return { features: new Float32Array(), points, strokeIndices };
  const height = Math.max(1, y1 - y0);
  const step = Math.max(LINE_STEP, length / height / Math.max(1, LINE_MAX_POINTS - 2 * strokes.length));
  let previous: Point | undefined;
  for (const [si, stroke] of strokes.entries()) {
    if (!stroke.points.length) continue;
    // Subtract the scene origin BEFORE float32 conversion, preserving tiny ink
    // even on a board panned millions of pixels from its origin.
    const normalized = stroke.points.map(([x, y]) => [Math.fround((x - x0) / height), Math.fround((y - y0) / height)] as Point);
    const distances = [0];
    for (let i = 1; i < normalized.length; i++) distances.push(Math.fround(distances[i - 1] + Math.fround(Math.hypot(normalized[i][0] - normalized[i - 1][0], normalized[i][1] - normalized[i - 1][1]))));
    const total = distances.at(-1)!;
    const targets = total < 1e-6 ? [0] : Array.from({ length: Math.ceil(total / step) }, (_, i) => i * step).concat(total);
    let segment = 1;
    for (const [i, target] of targets.entries()) {
      while (segment < distances.length - 1 && distances[segment] <= target) segment++;
      const a = Math.max(0, segment - 1), b = Math.min(segment, normalized.length - 1);
      const ratio = distances[b] > distances[a] ? (target - distances[a]) / (distances[b] - distances[a]) : 0;
      const x = Math.fround(normalized[a][0] + (normalized[b][0] - normalized[a][0]) * ratio);
      const y = Math.fround(normalized[a][1] + (normalized[b][1] - normalized[a][1]) * ratio);
      values.push(x * .1, y, previous ? x - previous[0] : 0, previous ? y - previous[1] : 0, Number(i === 0), Number(i === targets.length - 1));
      previous = [x, y];
      points.push([x0 + x * height, y0 + y * height]); strokeIndices.push(si);
    }
  }
  if (points.length > LINE_MAX_POINTS + 256) throw new RangeError('CTC line too long');
  return { features: Float32Array.from(values), points, strokeIndices };
}
