// @vitest-environment node
import { expect, it, vi } from 'vitest';
import { evaluateMathAst, parseMathStatement } from '@openmathtutor/shared';
import { recognizeBoardLines } from './index';
import { rowElements } from './__fixtures__/generate';
import { union } from './strokes';
import type { Point, Stroke } from './types';

// Deliberately wrong, overconfident punctuation predictions: geometry must win
// even if neither decimal label appears among the neural top three.
vi.mock('./model', async importOriginal => {
  const original = await importOriginal<typeof import('./model')>();
  return { ...original, recognizeSymbol: (strokes: readonly Stroke[]) => {
    const bbox = union(strokes.map(s => s.bbox));
    return Math.max(bbox.height, bbox.width) < 12
      ? [{ label: '9', probability: .99 }, { label: '1', probability: .009 }, { label: '/', probability: .001 }]
      : original.recognizeSymbol(strokes);
  } };
});

for (const height of [24, 40, 72]) for (const [shape, points, separator] of [
  ['dot', [[0, 0]], '.'],
  ['closed dot', [[0, 0], [.017, -.017], [.033, 0], [.017, .017], [0, 0]], '.'],
  ['slash', [[0, 0], [-.05, .13]], ','],
  ['hook', [[0, 0], [.03, .05], [-.03, .12]], ','],
] as const) {
  it(`uses geometry for a ${shape} at height ${height} despite wrong classifier candidates`, () => {
    const input = rowElements('2,5+1,5=4', 7, height, [-130, 280]);
    const punctuation = input.filter(e => {
      const ys = e.points!.map(p => p[1]);
      return Math.max(...ys) - Math.min(...ys) < height * .2 && Math.min(...ys) > height * .85;
    });
    expect(punctuation).toHaveLength(2);
    const lines = recognizeBoardLines(input.map(e => punctuation.includes(e) ? { ...e,
      points: points.map(p => [p[0] * height, height * .94 + p[1] * height] as Point),
      strokeWidth: height * .015,
    } : e));
    expect(lines).toHaveLength(1);
    expect(lines[0].text).toBe(`2${separator}5+1${separator}5=4`);
    const decimals = lines[0].symbols.filter(s => s.label === separator);
    expect(decimals).toHaveLength(2);
    expect(decimals.every(s => s.candidates[0].label === '9' && !s.uncertain)).toBe(true);
    const parsed = parseMathStatement(lines[0].text);
    if (parsed.form !== 'relation') throw new Error('Expected decimal equality');
    expect(evaluateMathAst(parsed.value.lhs, {})).toBe(4);
    expect(evaluateMathAst(parsed.value.rhs, {})).toBe(4);
  });
}

it('never turns a full-height digit or division slash into decimal punctuation', () => {
  expect(recognizeBoardLines(rowElements('295+1/5', 7, 60))[0].text).toBe('295+1/5');
});
