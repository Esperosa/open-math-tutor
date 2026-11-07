import { describe, expect, it } from 'vitest';
import { formatTaskForBoard } from './taskFormatting';

describe('formatTaskForBoard', () => {
  it('formats exponents with unicode superscripts', () => {
    expect(formatTaskForBoard('(n^2+9)/(2n^2+n)')).toBe('(n²+9) / (2n²+n)');
    expect(formatTaskForBoard('x^2 + 5x + 6 = 0')).toBe('x² + 5x + 6 = 0');
    expect(formatTaskForBoard('2^{n+1} - 1')).toBe('2ⁿ⁺¹ - 1');
    expect(formatTaskForBoard('y^3 - x^3')).toBe('y³ - x³');
  });

  it('replaces multiplication * with middle dot ·', () => {
    expect(formatTaskForBoard('3*4=12')).toBe('3 · 4=12');
    expect(formatTaskForBoard('(2+3)*4=20')).toBe('(2+3) · 4=20');
    expect(formatTaskForBoard('a * b')).toBe('a · b');
  });

  it('cleans up fractions in text form', () => {
    expect(formatTaskForBoard('(x+1)/(x-1)')).toBe('(x+1) / (x-1)');
    expect(formatTaskForBoard('(a+b)/c')).toBe('(a+b) / c');
    expect(formatTaskForBoard('a/(b+c)')).toBe('a / (b+c)');
  });

  it('preserves text statements and returns empty string for empty input', () => {
    expect(formatTaskForBoard('')).toBe('');
    expect(formatTaskForBoard('Vypočítej: 2x + 3 = 7')).toBe('Vypočítej: 2x + 3 = 7');
  });
});
