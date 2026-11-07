// @vitest-environment node
import { expect, it } from 'vitest';
import { readLine } from './context';
import type { RecognizedSymbol } from './types';

const symbol = (label: string, alternatives: [string, number][], x: number): RecognizedSymbol => ({
  bbox: { x, y: 0, width: 14, height: 40 },
  strokeIds: [label + x], strokeOrder: [x / 20], uncertain: false,
  candidates: [{ label, probability: alternatives[0]?.[1] ?? 1 }, ...alternatives.slice(1).map(([l, p]) => ({ label: l, probability: p }))],
  label, confirmed: false,
});

it('keeps a wrong written equation, including uncertain digits, exactly as written', () => {
  const symbols = [symbol('5', [['5', .55], ['s', .4]], 0), symbol('+', [['+', .99]], 20),
    symbol('2', [['2', .99]], 40), symbol('=', [['=', .99]], 60),
    symbol('1', [['1', .6], ['l', .4]], 80), symbol('5', [['5', .55], ['s', .45]], 100)];
  const read = readLine(symbols);
  expect(read.text).toBe('5+2=15');
  expect(read.contextualized).toBe(false);
});

it('uses the expected unit vocabulary to repair a slash/l confusion, and keeps the raw reading', () => {
  const symbols = [symbol('5', [['5', .9999]], 0), symbol('m', [['m', 1]], 20), symbol('o', [['o', .958], ['2', .02]], 40),
    symbol('l', [['l', .839], ['1', .156], ['/', .005]], 60), symbol('/', [['/', .956], ['2', .041]], 80),
    symbol('/', [['/', .913], ['l', .046]], 100)];
  const read = readLine(symbols, { unitAliases: ['mol/l'], expectedUnit: 'mol/l' });
  expect(read.rawText).toBe('5mol//');
  expect(read.text).toBe('5 mol/l');
  expect(read.contextualized).toBe(true);
});

it('does not use unit context to rewrite unrelated arithmetic', () => {
  const symbols = [symbol('7', [['7', .99]], 0), symbol('2', [['2', .99]], 20), symbol('/', [['/', .99]], 40),
    symbol('1', [['1', .99]], 60), symbol('2', [['2', .99]], 80), symbol('=', [['=', .99]], 100),
    symbol('6', [['6', .99]], 120)];
  expect(readLine(symbols, { unitAliases: ['m/s'] }).text).toBe('72/12=6');
});
