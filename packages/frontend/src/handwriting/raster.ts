import { union } from './strokes';
import type { Stroke } from './types';

/** MNIST convention: white ink, black background, longest ink dimension 20, centroid at (13.5,13.5). */
export function rasterizeSymbol(strokes: readonly Stroke[]): Float32Array {
  const image = new Float32Array(784);
  if (!strokes.length) return image;
  const b = union(strokes.map(s => s.bbox));
  const width = Math.max(...strokes.map(s => s.width));
  const scale = 20 / Math.max(b.width + width, b.height + width, 1e-6);
  const ox = (28 - b.width * scale) / 2, oy = (28 - b.height * scale) / 2;
  for (const stroke of strokes) {
    const radius = Math.max(.65, stroke.width * scale / 2);
    const p = stroke.points.map(([x, y]) => [(x - b.x) * scale + ox, (y - b.y) * scale + oy]);
    for (let i = 0; i < p.length; i++) {
      const [ax, ay] = p[i], [bx, by] = p[Math.min(i + 1, p.length - 1)];
      const dx = bx - ax, dy = by - ay, norm = Math.max(dx * dx + dy * dy, 1e-12);
      const left = Math.max(0, Math.floor(Math.min(ax, bx) - radius - 1)), top = Math.max(0, Math.floor(Math.min(ay, by) - radius - 1));
      const right = Math.min(27, Math.ceil(Math.max(ax, bx) + radius + 1)), bottom = Math.min(27, Math.ceil(Math.max(ay, by) + radius + 1));
      for (let y = top; y <= bottom; y++) for (let x = left; x <= right; x++) {
        const t = Math.max(0, Math.min(1, ((x - ax) * dx + (y - ay) * dy) / norm));
        const ink = Math.max(0, Math.min(1, radius + .5 - Math.hypot(x - ax - t * dx, y - ay - t * dy)));
        const idx = y * 28 + x;
        image[idx] = Math.max(image[idx], ink);
      }
    }
  }
  let mass = 0, mx = 0, my = 0;
  for (let y = 0; y < 28; y++) for (let x = 0; x < 28; x++) {
    const v = image[y * 28 + x]; mass += v; mx += v * x; my += v * y;
  }
  if (!mass) return image;
  const dx = 13.5 - mx / mass, dy = 13.5 - my / mass, centered = new Float32Array(784);
  for (let y = 0; y < 28; y++) for (let x = 0; x < 28; x++) {
    const sx = x - dx, sy = y - dy, ix = Math.floor(sx), iy = Math.floor(sy);
    if (sx < 0 || sy < 0 || sx > 27 || sy > 27) continue;
    for (let j = 0; j < 2; j++) for (let i = 0; i < 2; i++) {
      if (ix + i < 28 && iy + j < 28) centered[y * 28 + x] += image[(iy + j) * 28 + ix + i]
        * (i ? sx - ix : 1 - sx + ix) * (j ? sy - iy : 1 - sy + iy);
    }
  }
  // Float32 accumulation can overshoot one by one ULP during bilinear shifting.
  for (let i = 0; i < centered.length; i++) centered[i] = Math.max(0, Math.min(1, centered[i]));
  return centered;
}
