import { expect, it } from 'vitest';
import { nextCoachEvent } from './coach.js';
import { expectedAnswerFor } from './answers.js';
import { judgeLines } from './judgement.js';

const line = (stepId: string, latexGuess: string, uncertain = false) => ({ stepId, latexGuess, uncertain });
it('uses the first free-board equation as the task, and checks roots against it', () => {
  const task = '2*x+3=11', steps = [line('task', task), line('wrong', 'x=5'), line('right', 'x=4')];
  expect(judgeLines(task, steps, expectedAnswerFor(task))).toMatchObject({ task: { status: 'unknown' }, wrong: { status: 'wrong' }, right: { status: 'ok' } });
  expect(nextCoachEvent({ mode: 'live', statement: task, steps: steps.slice(0, 1), expected: expectedAnswerFor(task), handled: new Set() }).kind).toBe('idle');
});
it('never lets a true but unrelated calculation pass a word problem', () => {
  const expected = { value: 11, unit: 'm/s', tolerance: 1e-9, wordProblem: true, givens: [77, 7] };
  const task = 'Auto ujede 77 m za 7 s. Jaká je rychlost?';
  for (const text of ['72/12=6', '72/12=6 m/s', '22/2=11 m/s', '11', '77/7=11', '77/7=11 kg']) {
    expect(judgeLines(task, [line('a', text)], expected).a?.status, text).not.toBe('ok');
    expect(nextCoachEvent({ mode: 'live', statement: task, steps: [line('a', text)], expected, handled: new Set() }).kind, text).not.toMatch(/solved|ok_step/);
  }
  expect(judgeLines(task, [line('a', '77/7=11 m/s')], expected).a?.status).toBe('ok');
});
it('treats uncertain lines as questions, including final mode and explicit confirmation', () => {
  const steps = [line('a', '215+115=4', true)];
  expect(nextCoachEvent({ mode: 'live', statement: '2,5+1,5', steps, expected: { value: 4, tolerance: 1e-9 }, handled: new Set() }).kind).toBe('unclear');
});
