import { expect, it } from 'vitest';
import parity from './__fixtures__/parity.json';
import { elementsToStrokes } from './strokes';
import { rasterizeSymbol } from './raster';
import { classifyRaster } from './model';

it('matches independent Python rasterization and PyTorch inference after export', () => {
  for (const fixture of parity) {
    const strokes = elementsToStrokes(fixture.strokes.map((points, i) => ({ id: String(i), type: 'freedraw', x: 0, y: 0, points, strokeWidth: fixture.width })));
    const image = rasterizeSymbol(strokes);
    expect(Math.max(...image.map((v, i) => Math.abs(v - fixture.raster[i])))).toBeLessThan(1e-5);
    const candidates = classifyRaster(image);
    expect(candidates.map(c => c.label)).toEqual(fixture.candidates.map(c => c.label));
    candidates.forEach((c, i) => expect(c.probability).toBeCloseTo(fixture.candidates[i].probability, 5));
  }
});
it('has bounded, finite top-3 probabilities and validates the raster contract', () => {
  const candidates = classifyRaster(new Float32Array(784));
  expect(candidates).toHaveLength(3);
  expect(candidates.reduce((s, c) => s + c.probability, 0)).toBeLessThanOrEqual(1.000001);
  expect(() => classifyRaster(new Float32Array([NaN]))).toThrow(RangeError);
});
