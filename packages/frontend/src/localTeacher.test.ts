import { expect, it } from 'vitest';
import { localTeacherActions } from './localTeacher';

it('never writes an arithmetic correction from uncertain ink', () => {
  const actions = localTeacherActions({ stepId: 'ink', parentId: 'ink', latexGuess: '215+115=4', uncertain: true }, 1, 'cs');
  expect(actions.some(a => a.type === 'write_math' || (a.type === 'write_text' && /330|=/.test(a.text)))).toBe(false);
  expect(JSON.stringify(actions)).toContain('Zkontroluj, jestli jsem to přečetl správně');
});
