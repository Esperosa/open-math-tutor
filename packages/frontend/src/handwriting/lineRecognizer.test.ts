import { expect, it, vi } from 'vitest';
import type { Stroke } from './types';

const { rasterize } = vi.hoisted(() => ({ rasterize: vi.fn(() => new Float32Array(784)) }));
vi.mock('./model', () => ({ MODEL_LABELS: ['1', '2'] }));
vi.mock('./raster', () => ({ rasterizeSymbol: rasterize }));
vi.mock('./personalCalibration', () => ({ normalizeCalibrationLabel: (label: string) => label,
  applyCalibrationBlending: (logits: Float32Array) => { logits[0] = 1; logits[1] = 1; } }));
vi.mock('./lineModel', () => ({
  LINE_LABELS: ['', '1', '2'],
  inferLine: () => ({
    logits: Float32Array.from([0, 10, 0, 0, 10, 0, 10, 0, 0, 0, 0, 10, 0, 0, 10]),
    features: new Float32Array(60), points: Array.from({ length: 10 }, (_, i) => [i * 10, i % 2 * 20]),
    strokeIndices: Array<number>(10).fill(0),
  }),
}));
import { recognizeStrokeLine } from './lineRecognizer';

it('scores personal prototypes on token-local fragments, never repeats a connected whole-word raster for each token', () => {
  const stroke: Stroke = { id: 'connected', order: 0, width: 2,
    points: Array.from({ length: 10 }, (_, i) => [i * 10, i % 2 * 20]), bbox: { x: 0, y: 0, width: 90, height: 20 } };
  const sample = { raster: Array<number>(784).fill(0), strokeCount: 1, timestamp: 1 };
  const before = recognizeStrokeLine([stroke]);
  const reading = recognizeStrokeLine([stroke], {}, { version: 1, updatedAt: 1, samples: { '1': [sample], '2': [sample] } });
  expect(reading.best?.transcript).toBe('12');
  expect(reading.best!.logProbability).toBeGreaterThan(before.best!.logProbability);
  expect(reading.best!.confidence).toBe(before.best!.confidence);
  const first = rasterize.mock.calls[0] as unknown as [Stroke[]];
  const second = rasterize.mock.calls[1] as unknown as [Stroke[]];
  expect(first[0][0].points.length).toBeLessThan(stroke.points.length);
  expect(second[0][0].points.length).toBeLessThan(stroke.points.length);
  expect(first[0][0].points).not.toEqual(second[0][0].points);
  expect(reading.best?.symbols.map(s => s.strokeIds)).toEqual([['connected'], ['connected']]);
  expect(new Set(reading.best?.symbols.map(s => s.ctcKey)).size).toBe(2);
});
