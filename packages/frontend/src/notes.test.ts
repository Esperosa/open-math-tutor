import { describe, expect, it } from 'vitest';
import { catalog } from '@openmathtutor/content';
import { createMasteryState, recordAttempt } from '@openmathtutor/shared';
import { messages } from './i18n';
import { newBoard } from './boardState';
import { buildNotesHtml, buildNotesMarkdown, studyTextRequest, summarizeStrengths } from './notes';

const t = messages.cs;

describe('summarizeStrengths', () => {
  it('judges only practised skills: mastered is strong, a fresh miss is weak', () => {
    let strong = createMasteryState('arithmetic-integers', 0);
    for (let i = 1; i <= 14; i++) strong = recordAttempt(strong, true, i);
    const weak = recordAttempt(createMasteryState('fractions-basic', 0), false, 1);
    const result = summarizeStrengths(catalog, { 'arithmetic-integers': strong, 'fractions-basic': weak, 'percentages-basic': createMasteryState('percentages-basic', 0) }, 'cs');
    expect(result.weak.map(l => l.skillId)).toEqual(['fractions-basic']);
    expect(result.strong.map(l => l.skillId)).toEqual(['arithmetic-integers']);
    expect([...result.strong, ...result.weak, ...result.practising].some(l => l.skillId === 'percentages-basic')).toBe(false);
  });
});

describe('notes export', () => {
  const board = { ...newBoard(), statement: '2x+3=7', topic: 'Rovnice', steps: [
    { stepId: 'a', boardRevision: 1, latexGuess: '2x=4', box: { x: 0, y: 0, width: 1, height: 1 }, elementIds: [] },
    { stepId: 'b', boardRevision: 1, latexGuess: 'x=3', box: { x: 0, y: 0, width: 1, height: 1 }, elementIds: [] },
  ] };
  it('marks checked steps and always carries the unverified-AI disclaimer', () => {
    const md = buildNotesMarkdown([board], t);
    expect(md).toContain('1. `2x=4` ✓');
    expect(md).toContain('2. `x=3` ✗');
    expect(md).toContain(t.unverified);
  });
  it('escapes HTML in student text', () => {
    const html = buildNotesHtml([{ ...board, statement: '<img src=x onerror=alert(1)>' }], t);
    expect(html).not.toContain('<img src=x');
    expect(html).toContain('&lt;img');
  });
  it('study-text request names weak skills and what already works', () => {
    const text = studyTextRequest({ strong: [{ skillId: 's', title: 'Zlomky', track: 'x', attempts: 5 }], weak: [{ skillId: 'w', title: 'Rovnice', track: 'x', attempts: 2 }], practising: [] }, 'cs');
    expect(text).toContain('Rovnice');
    expect(text).toContain('Zlomky');
  });
});
