import { expect, it } from 'vitest';
import { parseMathStatement } from '@openmathtutor/shared';
import { normalizeExpression, parseLine } from './parse';
import type { RecognizedSymbol } from './types';

const symbol = (label: string, x: number, y = 0, width = 20, height = 40): RecognizedSymbol => ({
  bbox: { x, y, width, height }, strokeIds: [label + x], strokeOrder: [0], uncertain: false, candidates: [{ label, probability: .9 }],
});
it('normalizes decimal comma, multiplication/division, unary minus, letters and percent to the actual shared grammar', () => {
  for (const [input, expected] of [['1,25+2', '1,25+2'], ['3x4=12', '3*4=12'], ['x=7', 'x=7'], ['2a', '2*a'], ['25%+1', '(25/100)+1'], ['-2+3', '-2+3']]) {
    expect(normalizeExpression(input)).toBe(expected); expect(() => parseMathStatement(expected)).not.toThrow();
  }
  expect(normalizeExpression('16%')).toBe('16%');
  expect(normalizeExpression('58cm')).toBe('58cm');
  expect(normalizeExpression('20mol')).toBe('20mol');
  expect(normalizeExpression('2ohm')).toBe('2ohm');
  expect(normalizeExpression('4o')).toBe('40');
  expect(normalizeExpression('19o,905')).toBe('190,905');
  expect(parseLine([symbol('3', 0), symbol('×', 30), symbol('4', 60)]).text).toBe('3*4');
  expect(parseLine([symbol('3', 0), symbol('÷', 30), symbol('4', 60)]).text).toBe('3/4');
  expect(parseLine([symbol('x', 0), symbol('=', 30, 14, 25, 12), symbol('5', 65)]).text).toBe('x=5');
});
it('composes spatial fractions and powers', () => {
  const f = parseLine([symbol('1', 5, 0, 12, 25), symbol('-', 0, 34, 35, 0), symbol('2', 4, 43, 20, 25)]);
  expect(f.text).toBe('(1)/(2)'); expect(() => parseMathStatement(f.text)).not.toThrow();
  expect(parseLine([symbol('2', 0), symbol('3', 25, -6, 12, 22)]).text).toBe('2^3');
});
it('does not turn an isolated dash into a mathematical assertion or solve an incorrect equation', () => {
  expect(parseLine([symbol('-', 0, 10, 100, 0)])).toMatchObject({ text: '', confidence: 0 });
  expect(parseLine([symbol('5', 0), symbol('+', 25), symbol('2', 50), symbol('=', 75), symbol('1', 100), symbol('5', 125)]).text).toBe('5+2=15');
  expect(parseLine([]).confidence).toBe(0);
});
