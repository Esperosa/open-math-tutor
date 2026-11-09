// @vitest-environment node
import { expect, it } from 'vitest';
import parity from './__fixtures__/line-parity.json';
import { lineFeatures } from './lineFeatures';
import { LINE_LABELS, lineLogits } from './lineModel';
import { ctcGreedy, logSoftmax } from './ctc';
import { elementsToStrokes } from './strokes';
import { rankLineCandidates } from './context';
import { recognizeStrokeLine } from './lineRecognizer';
import { canonicalTranscript, parseLine } from './parse';
import { evaluateMathAst, parseMathStatement } from '@openmathtutor/shared';

it('matches independently exported PyTorch features, gates, both directions and logits', () => {
  for (const sample of parity) {
    const strokes = elementsToStrokes(sample.traces.map((points, i) => ({ id: String(i), type: 'freedraw', x: 0, y: 0, points })));
    const input = lineFeatures(strokes);
    const expected = sample.features.flat();
    expect(input.features.length).toBe(expected.length);
    expect(Math.max(...input.features.map((v, i) => Math.abs(v - expected[i])))).toBeLessThan(2e-5);
    const logits = lineLogits(input.features), target = sample.logits.flat();
    expect(logits.length).toBe(target.length);
    expect(Math.max(...logits.map((v, i) => Math.abs(v - target[i])))).toBeLessThan(2e-4);
    expect(ctcGreedy(logSoftmax(logits, LINE_LABELS.length), LINE_LABELS).text).toBe(sample.greedy);
    const read = recognizeStrokeLine(strokes);
    for (const symbol of read.best?.symbols ?? []) {
      expect(symbol.strokeIds.length).toBeGreaterThan(0);
      expect(symbol.strokeIds.every(id => strokes.some(s => s.id === id))).toBe(true);
      expect(Object.values(symbol.bbox).every(Number.isFinite)).toBe(true);
    }
  }
}, 10000);

it('does not use equation correctness to rerank CTC N-best candidates', () => {
  const candidate = (text: string, logProbability: number) => ({ text, logProbability, confidence: .9, symbols: [] });
  expect(rankLineCandidates([candidate('5+2=15', -.1), candidate('5+2=7', -1)], { taskPrompt: '5+2' })[0].text).toBe('5+2=15');
  expect(rankLineCandidates([candidate('5^+1=', -1), candidate('5+1=', -2)], { taskPrompt: '5+1' })[0].text).toBe('5+1=');
});

it('keeps normalization invariant under large scene translation and sparse sampling', () => {
  const make = (offset: number) => elementsToStrokes([{ id: 'connected', type: 'freedraw', x: offset, y: offset,
    points: [[0, 0], [20, 40], [40, 0]] }]);
  expect([...lineFeatures(make(0)).features]).toEqual([...lineFeatures(make(80000000)).features]);
  expect(() => lineLogits(Float32Array.from([NaN, 0, 0, 0, 0, 0]))).toThrow(RangeError);
  expect(() => lineFeatures([{ ...make(0)[0], points: [[Infinity, 0]] }])).toThrow(RangeError);
});

it('shares nested-root canonicalization with one-tap CTC recomposition', () => {
  const text = '√(9)+√(√(16))';
  expect(canonicalTranscript(text)).toBe('((9)^(1/2))+((((16)^(1/2)))^(1/2))');
  expect(() => parseMathStatement(canonicalTranscript(text))).not.toThrow();
  const symbols = [...text].map((label, i) => ({ ctcIndex: i, label, confidence: .9, candidates: [{ label, probability: .9 }],
    bbox: { x: 0, y: 0, width: 10, height: 20 }, strokeIds: ['connected'], strokeOrder: [0], uncertain: false }));
  expect(parseLine(symbols).text).toBe(canonicalTranscript(text));
  expect(canonicalTranscript('1mol/l', ['mol/l'])).toBe('1 mol/l');
  expect(canonicalTranscript('8m/s', ['m/s'])).toBe('8 m/s');
  for (const [source, expected] of [['-√(9)', -3], ['√(9)^2', 9], ['2^√(9)', 8]] as const) {
    const ast = parseMathStatement(canonicalTranscript(source));
    expect(ast.form).toBe('expression');
    if (ast.form === 'expression') expect(evaluateMathAst(ast.value, {})).toBeCloseTo(expected, 10);
  }
});
