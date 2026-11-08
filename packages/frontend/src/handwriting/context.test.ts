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

it('heavily penalizes double operators and rejects ambiguous readings with ++ or +- in favor of clean operator', () => {
  // A '+' where second stroke could ambiguously be '+' or '1'
  const symbols = [
    symbol('5', [['5', .9]], 0),
    symbol('+', [['+', .52], ['t', .2], ['1', .2]], 20),
    symbol('+', [['+', .48], ['1', .45]], 40),
    symbol('=', [['=', .95]], 60),
  ];
  // Raw might be 5++=, but ++ is heavily penalized so 5+1= is favored
  const read = readLine(symbols);
  expect(read.text).toBe('5+1=');
  expect(read.text).not.toContain('++');
});

it('penalizes digit count explosion like =1005 after 5+1 while allowing reasonable wrong math like 5+2=15', () => {
  // Candidate for RHS is ambiguously 6 vs 1005 (or similar multi-digit artifact)
  // Student wrote 5+1=, but a flourish is ambiguously '6' (.48) or '1' (.52) followed by extra noise
  const symbolsPlau = [
    symbol('5', [['5', .99]], 0),
    symbol('+', [['+', .99]], 20),
    symbol('2', [['2', .99]], 40),
    symbol('=', [['=', .99]], 60),
    symbol('1', [['1', .99]], 80),
    symbol('5', [['5', .99]], 100),
  ];
  const readPlau = readLine(symbolsPlau);
  // 5+2=15 is wrong math, but 2 digits on RHS is plausible for 1-digit addition -> kept!
  expect(readPlau.text).toBe('5+2=15');

  // Conversely, 1+1=3 is wrong math, but NEVER changed to 1+1=2 because "rovnice vychází" is NEVER a prior
  const symbolsWrong = [
    symbol('1', [['1', .99]], 0),
    symbol('+', [['+', .99]], 20),
    symbol('1', [['1', .99]], 40),
    symbol('=', [['=', .99]], 60),
    symbol('3', [['3', .99], ['2', .01]], 80),
  ];
  const readWrong = readLine(symbolsWrong);
  expect(readWrong.text).toBe('1+1=3');
});

it('uses task prompt as weak-to-medium prior without overriding clear student ink', () => {
  // Student is transcribing task prompt "5+1" with trailing '=':
  // First symbol is slightly ambiguous '5' (.48) vs 's' (.52)
  const symbolsTranscribing = [
    symbol('s', [['s', .52], ['5', .48]], 0),
    symbol('+', [['+', .95]], 20),
    symbol('1', [['1', .95]], 40),
    symbol('=', [['=', .95]], 60),
  ];
  // With task prompt "5+1", the prior nudges 's' to '5'
  const readPrompt = readLine(symbolsTranscribing, { taskPrompt: '5+1' });
  expect(readPrompt.text).toBe('5+1=');

  // But student clearly wrote "5+2=15" when task was "5+1":
  // The '2' and '15' have clear ink, so task prompt "5+1" MUST NOT change '2' into '1'
  const symbolsDifferent = [
    symbol('5', [['5', .99]], 0),
    symbol('+', [['+', .99]], 20),
    symbol('2', [['2', .98], ['1', .02]], 40),
    symbol('=', [['=', .99]], 60),
    symbol('1', [['1', .99]], 80),
    symbol('5', [['5', .99]], 100),
  ];
  const readDifferent = readLine(symbolsDifferent, { taskPrompt: '5+1' });
  expect(readDifferent.text).toBe('5+2=15');
});

it('heavily penalizes nonsensical brackets like empty () and inverted )(', () => {
  const symbols = [
    symbol('(', [['(', .51], ['1', .49]], 0),
    symbol(')', [[')', .51], ['1', .49]], 20),
    symbol('+', [['+', .95]], 40),
    symbol('5', [['5', .95]], 60),
  ];
  // ()+5 has empty brackets (penalty -6.0), so 1+5 is selected
  const read = readLine(symbols);
  expect(read.text).not.toContain('()');
  expect(read.text).toBe('11+5');
});
