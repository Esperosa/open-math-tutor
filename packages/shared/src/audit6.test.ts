import { describe, expect, it } from 'vitest';
import { answerFromLine, checkAnswerLine, expectedAnswerFor, looksLikeFinalLine, normalizeUnit, unitFromLine } from './answers.js';
import { confirmCoachFinal, nextCoachEvent, stepKey } from './coach.js';
import { checkStep } from './stepCheck.js';

describe('audit 6: precision and notation', () => {
  it('rejects percent-wide decimal errors, accepts only a written rounding', () => {
    const mass = { value: 175.5, unit: 'g', tolerance: 0.01 };
    for (const line of ['175,6 g', '176,4 g', '175.5001 g']) expect(checkAnswerLine(mass, line)).toBe('wrong');
    expect(checkAnswerLine({ value: 50.64, tolerance: 0.005 }, '50,74')).toBe('wrong');
    expect(expectedAnswerFor('6,33*8')?.value).toBe(50.64);
    expect(checkStep('3*0.7=2.1', '1.1+1').status).toBe('ok');
    expect(checkStep('3*0.7=2.1', '1.1+2').status).toBe('wrong');
    expect(checkAnswerLine(expectedAnswerFor('2/3')!, '0,66')).toBe('correct');
    expect(checkAnswerLine(expectedAnswerFor('2/3')!, '0,67')).toBe('correct');
    expect(checkAnswerLine(expectedAnswerFor('2/3')!, '0,65')).toBe('wrong');
    expect(checkAnswerLine(expectedAnswerFor('2/3')!, '2/3')).toBe('correct');
    expect(checkAnswerLine(expectedAnswerFor('7/8')!, '0,9')).toBe('wrong');
    expect(checkAnswerLine({ value: 1.204567e24, tolerance: 0.01 }, '1.2e24')).toBe('wrong');
    expect(checkAnswerLine({ value: 1.204567e24, tolerance: 0.01 }, '1.205e24')).toBe('correct');
    expect(checkAnswerLine(expectedAnswerFor('201/200')!, '1.01')).toBe('correct');
    expect(checkAnswerLine(expectedAnswerFor('201/200')!, '1.00')).toBe('wrong');
    expect(checkAnswerLine({ value: 1.204e24, tolerance: 0.01 }, '1,204e+24')).toBe('correct');
    expect(looksLikeFinalLine('1,204e+24', false)).toBe(true);
  });
  it('keeps percent as a unit, density aliases and case-sensitive molarity', () => {
    expect(unitFromLine('180 %')).toBe('%');
    expect(checkAnswerLine({ value: 180, unit: 'Kč', tolerance: 1e-9 }, '180 %')).toBe('unit');
    for (const unit of ['g cm^-3', 'g·cm⁻³', 'g/cm3']) {
      expect(normalizeUnit(unit)).toBe('g/cm3');
      expect(checkAnswerLine({ value: 2, unit: 'g/cm³', tolerance: 1e-9 }, `2 ${unit}`)).toBe('correct');
    }
    expect(checkAnswerLine({ value: 2, unit: 'mol/l', tolerance: 1e-9 }, '2 M')).toBe('correct');
    expect(checkAnswerLine({ value: 2, unit: 'mol/l', tolerance: 1e-9 }, '2 m')).toBe('unit');
  });
  it('checks every decimal arithmetic link, including two-part equations with units', () => {
    for (const line of ['3*0,7=2,2', '2*58.5=118', '5*58.5=293.5', '2*58.5=118 g', 'm = 5*58.5 = 293.5 g', 'm = 2·3 = 7', '1 1/2 = 5.5', '1 1 / 2 = 5.5']) {
      expect(checkStep(line, null), line).toEqual({ status: 'wrong', reason: 'arithmetic' });
    }
    for (const line of ['3*0,7=2,1', '2*58.5=117 g', '1/3=0.33', '7/8 = 0,88 g', '1 1/2 = 1.5', '1 1 / 2 = 1.5', '2·3 = 6', '201/200 = 1.01']) expect(checkStep(line, null).status, line).toBe('ok');
    expect(checkStep('1/3=0.34', null).status).toBe('wrong');
    expect(checkStep('10000000000000=10000000000001', null).status).toBe('wrong');
    expect(checkStep('2+2=4', '1+1').status).toBe('wrong');
  });
  it('offers soft confirmation for bare word-problem results, never judges givens', () => {
    const expected = { value: 175.5, unit: 'g', tolerance: 0.01, wordProblem: true, givens: [3, 58.5] };
    for (const mode of ['live', 'final'] as const) {
      for (const latexGuess of ['176,4', '176,4 g', '1,204e+24']) {
        expect(nextCoachEvent({ mode, statement: 'Urči hmotnost.', expected, handled: new Set(), steps: [{ stepId: 'a', latexGuess }] }).kind).toBe('check_in');
      }
      expect(nextCoachEvent({ mode, statement: 'Urči hmotnost.', expected, handled: new Set(), steps: [{ stepId: 'a', latexGuess: 'm = 3 g' }] }).kind).not.toBe('wrong_final');
    }
  });
  it('rejects oversized input before any numeric regex work', () => {
    for (const line of ['1' + ' '.repeat(50000) + 'e+', '1·10' + ' '.repeat(50000) + '^']) {
      expect(answerFromLine(line)).toBeNull();
      expect(unitFromLine(line)).toBe('');
      expect(looksLikeFinalLine(line, false)).toBe(false);
      expect(checkAnswerLine({ value: 1, tolerance: 0.01 }, line)).toBe('none');
      expect(checkStep(line, null).status).toBe('unknown');
    }
  });
  it('requires explicit confirmation of a current line and respects off mode', () => {
    const step = { stepId: 'a', latexGuess: '176,4 g' };
    const input = { mode: 'live' as const, statement: 'Urči hmotnost.', expected: { value: 175.5, tolerance: 1e-9, wordProblem: true }, steps: [step], handled: new Set<string>() };
    expect(confirmCoachFinal(input, stepKey(step)).kind).toBe('wrong_final');
    expect(confirmCoachFinal({ ...input, mode: 'off' }, stepKey(step)).kind).toBe('idle');
    expect(confirmCoachFinal({ ...input, steps: [{ ...step, latexGuess: '175,5 g' }] }, stepKey(step)).kind).toBe('idle');
    expect(confirmCoachFinal({ ...input, steps: [] }, stepKey(step)).kind).toBe('idle');
    expect(confirmCoachFinal({ ...input, steps: [step, { stepId: 'b', latexGuess: '175.5 g' }] }, stepKey(step)).kind).toBe('idle');
  });
  it('does not finalize an edited earlier row when a newer result has already been handled', () => {
    const last = { stepId: 'b', latexGuess: '176.4 g' };
    const event = nextCoachEvent({ mode: 'live', statement: 'Hmotnost?', expected: { value: 175.5, unit: 'g', tolerance: 1e-9, wordProblem: true },
      steps: [{ stepId: 'a', latexGuess: '175.5 g' }, last], handled: new Set([stepKey(last)]) });
    expect(['solved', 'wrong_final', 'check_in']).not.toContain(event.kind);
  });
});
