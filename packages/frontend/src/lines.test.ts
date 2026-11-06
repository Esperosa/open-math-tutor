import { describe, expect, it } from 'vitest';
import { effectiveStatement, markPerStep, writtenLines } from './lines';
import type { Step } from './boardState';

const step = (stepId: string, latexGuess: string): Step => ({ stepId, latexGuess, boardRevision: 1, box: { x: 0, y: 0, width: 1, height: 1 }, elementIds: [] });

describe('written lines', () => {
  it('splits multi-line text into separately judged lines and skips empty steps', () => {
    const lines = writtenLines([step('a', '2x+3=7\n2x=4'), step('b', ''), step('c', 'x=2')]);
    expect(lines.map(l => [l.stepId, l.latexGuess, l.parentId])).toEqual([['a#0', '2x+3=7', 'a'], ['a#1', '2x=4', 'a'], ['c', 'x=2', 'c']]);
  });
  it('uses the lesson statement, else the first written line, as the task', () => {
    const lines = writtenLines([step('a', '5+1=8')]);
    expect(effectiveStatement('2x+3=7', lines)).toBe('2x+3=7');
    expect(effectiveStatement('  ', lines)).toBe('5+1=8');
    expect(effectiveStatement('', [])).toBe('');
  });
  it('lets a wrong line win the margin mark of its step', () => {
    const lines = writtenLines([step('a', '1\n2')]);
    expect(markPerStep({ 'a#0': { status: 'wrong', reason: 'arithmetic' }, 'a#1': { status: 'ok' } }, lines).a?.status).toBe('wrong');
    expect(markPerStep({ 'a#0': { status: 'ok' }, 'a#1': { status: 'wrong', reason: 'arithmetic' } }, lines).a?.status).toBe('wrong');
    expect(markPerStep({ 'a#0': { status: 'unknown' }, 'a#1': { status: 'ok' } }, lines).a?.status).toBe('ok');
  });
});
