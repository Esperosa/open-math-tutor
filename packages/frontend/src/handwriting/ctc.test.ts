import { expect, it } from 'vitest';
import { ctcAlign, ctcBeam, ctcGreedy, logSoftmax } from './ctc';

it('sums repeated-label and blank paths exactly on a tiny exhaustively enumerated lattice', () => {
  const labels = ['', '1', '+'];
  const probabilities = [[.4, .5, .1], [.4, .5, .1], [.3, .6, .1]];
  const logp = Float32Array.from(probabilities.flat().map(Math.log));
  const expected = new Map<string, number>();
  for (let a = 0; a < 3; a++) for (let b = 0; b < 3; b++) for (let c = 0; c < 3; c++) {
    const path = [a, b, c];
    const text = path.filter((v, i) => v && (!i || v !== path[i - 1])).map(v => labels[v]).join('');
    expected.set(text, (expected.get(text) ?? 0) + probabilities[0][a] * probabilities[1][b] * probabilities[2][c]);
  }
  for (const h of ctcBeam(logp, labels, 64)) expect(Math.exp(h.logProbability), h.text).toBeCloseTo(expected.get(h.text) ?? 0, 6);
  expect(ctcGreedy(logp, labels).text).toBe('1');
  const repeated = Float32Array.from([.01, .98, .01, .98, .01, .01, .01, .98, .01].map(Math.log));
  expect(ctcGreedy(repeated, labels).text).toBe('11');
  expect(ctcAlign(repeated, 3, [1, 1])).toEqual([[0], [2]]);
  expect(ctcAlign(repeated.slice(0, 3), 3, [1, 1])).toBeNull();
});

it('normalizes stably and rejects invalid/nonfinite lattices', () => {
  const p = logSoftmax(Float32Array.from([1000, 1001, 1002]), 3);
  expect([...p].reduce((s, x) => s + Math.exp(x), 0)).toBeCloseTo(1, 6);
  expect(() => logSoftmax(Float32Array.from([NaN, 0]), 2)).toThrow(RangeError);
  expect(() => logSoftmax(new Float32Array(3), 2)).toThrow(RangeError);
  expect(() => ctcBeam(p, ['', 'a', 'b'], 0)).toThrow(RangeError);
  expect(() => ctcBeam(p, [])).toThrow(RangeError);
  expect(() => ctcGreedy(p, [])).toThrow(RangeError);
  expect(() => ctcAlign(p, 3, [3])).toThrow(RangeError);
  expect(() => ctcBeam(new Float32Array(4098), ['', '1'])).toThrow(RangeError);
  expect(ctcBeam(new Float32Array(), ['', '1'])).toEqual([{ text: '', tokens: [], logProbability: 0 }]);
});
