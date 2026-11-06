import { describe, expect, it } from 'vitest';
import { localTeacherActions } from './localTeacher';

describe('localTeacher pedagogy rules', () => {
  const line = { stepId: 'step-1', parentId: 'step-1', latexGuess: '3*4=15' };

  it('first mistake only provides a circle and a guiding question without revealing the answer', () => {
    const actions = localTeacherActions(line, 1, 'cs');
    expect(actions).toHaveLength(2);
    expect(actions[0]).toMatchObject({ id: 'coach-step-1-circle', type: 'circle', targetStepId: 'step-1' });
    expect(actions[1]).toMatchObject({
      id: 'coach-step-1-label',
      type: 'write_text',
      text: 'Zkus ten řádek přepočítat po operacích.',
    });
    // Must NOT contain the correct result '12'
    expect((actions[1] as { text: string }).text).not.toContain('12');
  });

  it('first mistake in English asks guiding question without revealing answer', () => {
    const actions = localTeacherActions(line, 1, 'en');
    expect(actions[1]).toMatchObject({
      type: 'write_text',
      text: 'Try recalculating that line operation by operation.',
    });
    expect((actions[1] as { text: string }).text).not.toContain('12');
  });

  it('second mistake on the same line reveals the correct value', () => {
    const actions = localTeacherActions(line, 2, 'cs', { attemptCount: 2 });
    expect(actions[1]).toMatchObject({
      type: 'write_text',
      text: '3*4=12',
    });
  });

  it('explicit hint request reveals the correct value on request', () => {
    const actions = localTeacherActions(line, 1, 'cs', { revealSolution: true });
    expect(actions[1]).toMatchObject({
      type: 'write_text',
      text: '3*4=12',
    });
  });

  it('returns empty array when line is undefined', () => {
    expect(localTeacherActions(undefined, 1, 'cs')).toEqual([]);
  });
});
