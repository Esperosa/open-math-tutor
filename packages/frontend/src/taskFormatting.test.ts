import { describe, expect, it } from 'vitest';
import { catalog } from '@openmathtutor/content';
import { instantiateProblem } from '@openmathtutor/shared';
import { formatTaskForBoard, renderMathStatement } from './taskFormatting';

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

describe('renderMathStatement (D2: word problems vs pure math formulas)', () => {
  it('does NOT render word problems as KaTeX formulas without spaces', () => {
    // Physics
    const physics = 'Auto ujede 44 m za 4 s. Jakou má průměrnou rychlost v km/h?';
    expect(renderMathStatement(physics)).toBeNull();

    // Chemistry
    const chemistry1 = 'Urči látkové množství v 50 g NaCl.';
    expect(renderMathStatement(chemistry1)).toBeNull();
    const chemistry2 = 'Vypočítej molární hmotnost kyseliny sírové H2SO4.';
    expect(renderMathStatement(chemistry2)).toBeNull();

    // University Analysis
    const analysis = 'Urči definiční obor a vyšetři body nespojitosti funkce.';
    expect(renderMathStatement(analysis)).toBeNull();

    // Linear Algebra
    const la = 'Najdi bázi a dimenzi podprostoru generovaného vektory v1 a v2.';
    expect(renderMathStatement(la)).toBeNull();
  });

  it('renders pure math expressions with KaTeX', () => {
    const quad = 'x^2 + 5x + 6 = 0';
    const renderedQuad = renderMathStatement(quad);
    expect(renderedQuad).not.toBeNull();
    expect(renderedQuad).toContain('class="katex"');

    const frac = '(x+1)/(x-1) = 3';
    const renderedFrac = renderMathStatement(frac);
    expect(renderedFrac).not.toBeNull();
    expect(renderedFrac).toContain('frac');

    const limit = 'lim(n->\\infty) (n^2+1)/(2n^2)';
    const renderedLimit = renderMathStatement(limit);
    expect(renderedLimit).not.toBeNull();
    expect(renderedLimit).toContain('katex');
  });

  it('renders pure math with command prefix correctly', () => {
    const prefixed = 'Vypočítej: 2x + 3 = 7';
    const rendered = renderMathStatement(prefixed);
    expect(rendered).not.toBeNull();
    expect(rendered).toContain('Vypočítej:');
    expect(rendered).toContain('class="katex"');
  });

  it('renders mixed statements containing explicit $...$ math parts', () => {
    const mixed = 'Spočítej hodnotu výrazu $2x^2 + 3x$ pro $x = 4$.';
    const rendered = renderMathStatement(mixed);
    expect(rendered).not.toBeNull();
    expect(rendered).toContain('Spočítej hodnotu výrazu');
    expect(rendered).toContain('class="katex"');
    expect(rendered).toContain('pro');
  });

  it('verifies every catalog template: no word problem renders as a single KaTeX formula without spaces', () => {
    for (const template of catalog.problemTemplates) {
      const instantiated = instantiateProblem(template);
      const statement = instantiated.statement;
      const html = renderMathStatement(statement);

      if (html) {
        // If html was produced:
        // Either statement had explicit $...$, or it was a pure math expression
        if (!statement.includes('$')) {
          // If pure math, check that it didn't contain common natural words
          const words = statement.match(/[a-zA-Z\u00C0-\u024F]{3,}/g) || [];
          const nonMathWords = words.filter(w => !['lim', 'sin', 'cos', 'tan', 'det', 'ker', 'dim', 'exp', 'log'].includes(w.toLowerCase()));
          // If there were natural language words, it should NOT have been rendered purely by KaTeX
          // (except if it was just a prefix before a colon, in which case the prefix is rendered outside katex in a span)
          if (nonMathWords.length > 0) {
            const colonIdx = statement.indexOf(':');
            expect(colonIdx).toBeGreaterThan(0);
            expect(html).toContain('<span>');
          }
        }
      }
    }
  });
});
