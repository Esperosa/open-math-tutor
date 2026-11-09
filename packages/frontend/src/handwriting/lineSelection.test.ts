import { expect, it, vi } from 'vitest';
import type { Stroke } from './types';
import type { PersonalCalibrationProfile } from './personalCalibration';

vi.mock('./model', () => ({
  recognizeSymbol: (_strokes: unknown, profile?: { samples: Record<string, unknown> }) => profile?.samples['7']
    ? [{ label: '7', probability: .99 }, { label: '1', probability: .005 }, { label: '2', probability: .005 }]
    : [{ label: '1', probability: .99 }, { label: '7', probability: .005 }, { label: '2', probability: .005 }],
  classifyRaster: vi.fn(), MODEL_LABELS: ['1', '7', '2'],
}));
vi.mock('./lineRecognizer', () => ({
  recognizeStrokeLine: (strokes: Stroke[], _options: unknown, _profile: unknown, comparison?: unknown) => ({
    best: comparison ? undefined : { text: '2', transcript: '2', confidence: .999, rawConfidence: .999,
      logProbability: 0, rawProbabilities: [.999], symbols: [{ ctcIndex: 0, ctcKey: '2:0', label: '2', confidence: .999,
        candidates: [{ label: '2', probability: .999 }, { label: '1', probability: .001 }],
        bbox: strokes[0].bbox, strokeIds: strokes.map(s => s.id), strokeOrder: strokes.map(s => s.order), uncertain: false }] },
    candidates: [], rawText: '2', transcript: '2',
  }),
}));
import { createHandwritingRecognizer } from './index';

it('invalidates comparison-dependent cached readings when the caller changes its margin threshold', () => {
  const ink = [{ id: 's', type: 'freedraw', x: 0, y: 0, points: [[0, 0], [10, 30], [20, 0]] }];
  const cached = createHandwritingRecognizer();
  expect(cached.recognize(ink, { marginThreshold: 0 })[0].text).toBe('1');
  const after = cached.recognize(ink, { marginThreshold: 1 });
  expect(after).toEqual(createHandwritingRecognizer().recognize(ink, { marginThreshold: 1 }));
  expect(after[0].text).toBe('2');
});

it('invalidates both model caches when personal samples change within the same update timestamp', () => {
  const ink = [{ id: 's', type: 'freedraw', x: 0, y: 0, points: [[0, 0], [10, 30], [20, 0]] }];
  const cached = createHandwritingRecognizer();
  const profile: PersonalCalibrationProfile = { version: 1, updatedAt: 1, samples: {} };
  expect(cached.recognize(ink, { reader: 'symbol', calibrationProfile: profile })[0].text).toBe('1');
  profile.samples['7'] = [{ raster: Array<number>(784).fill(0), strokeCount: 1, timestamp: 1 }];
  expect(cached.recognize(ink, { reader: 'symbol', calibrationProfile: profile })[0].text).toBe('7');
});
