import { describe, expect, it } from 'vitest';
import { boardMathToPlain, validateBoardActions } from './boardActions.js';
const placement = { relativeToStepId: 's', side: 'right', offsetEm: 1 };
const base = { id: 'a', boardRevision: 2 };
const bounds = { minX: -100, minY: -100, maxX: 1000, maxY: 1000 };
const check = (action: unknown) => validateBoardActions([action], 2, bounds);
describe('teacher board action boundary', () => {
  it.each(['circle', 'underline', 'highlight', 'strike_through'])('accepts %s on a symbol or row', type => {
    expect(check({ ...base, type, targetStepId: 's', targetSymbolIndex: 0 }).errors).toEqual([]);
  });
  it.each(['write_text', 'show_hint', 'write_math'])('accepts relative %s and legacy saved anchors', type => {
    const content = type === 'write_math' ? { latex: String.raw`\frac{1}{2}x=3` } : { text: 'Co se stane na druhé straně?' };
    expect(check({ ...base, type, ...content, placement }).errors).toEqual([]);
    expect(check({ ...base, type, ...content, anchor: { x: 20, y: 30 } }).errors).toEqual([]);
  });
  it('accepts relative arrows and caps each batch at twelve', () => {
    const a = { ...base, type: 'draw_arrow', from: placement, to: { ...placement, side: 'below' } };
    expect(check(a).errors).toEqual([]);
    expect(validateBoardActions(Array(13).fill(a), 2, bounds).errors).toHaveLength(1);
  });
  it.each([
    { side: 'screen' }, { relativeToStepId: '' }, { offsetEm: Infinity }, { offsetEm: -1 }, { offsetEm: 13 },
    { symbolIndex: -1 }, { symbolIndex: 0.5 }, { symbolIndex: 300 }, { x: 0 },
  ])('rejects invalid relative anchors %#', patch => {
    expect(check({ ...base, type: 'write_text', text: 'hint', placement: { ...placement, ...patch } }).valid).toEqual([]);
  });
  it.each(['<img src=x onerror=alert(1)>', '&#60;script&#62;', 'x'.repeat(501), '\u202etest'])('rejects unsafe labels %#', text => {
    expect(check({ ...base, type: 'write_text', text, placement }).valid).toEqual([]);
  });
  it.each([String.raw`\href{https://evil}{x}`, String.raw`\htmlClass{x}{y}`, String.raw`\def\a{a}\a`, '<script>x</script>', "__import__('os')", 'x'.repeat(301)])('rejects unsafe math %#', latex => {
    expect(check({ ...base, type: 'write_math', latex, placement }).valid).toEqual([]);
  });
  it('parses only a nonexpanding math subset', () => {
    expect(boardMathToPlain(String.raw`\frac{1}{\frac{2}{3}}+x^{2}`)).toBe('((1)/(((2)/(3))))+x^(2)');
    expect(boardMathToPlain('5+2=7')).toBe('5+2=7');
  });
  it('rejects stale revisions, mixed anchors, hidden fields, bad styles and nonfinite legacy coordinates', () => {
    const a = { ...base, type: 'write_text', text: 'hint', placement };
    for (const patch of [{ boardRevision: 1 }, { boardRevision: NaN }, { boardRevision: -1 }, { id: 'x'.repeat(129) },
      { anchor: { x: 0, y: 0 } }, { command: 'run' }, { style: { color: 'red' } }, { style: { emphasis: ['high'] } }]) {
      expect(check({ ...a, ...patch }).valid).toEqual([]);
    }
    expect(check({ ...base, type: 'show_hint', text: 'hint', anchor: { x: Infinity, y: 0 } }).valid).toEqual([]);
  });
});
