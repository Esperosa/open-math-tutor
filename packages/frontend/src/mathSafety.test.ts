import { expect, it } from 'vitest';
import katex from 'katex';
it('does not authorize external links or raw HTML in model-generated math', () => {
  for (const latex of [String.raw`\href{javascript:alert(1)}{click}`, String.raw`\htmlClass{evil}{x}`, '<script>alert(1)</script>']) {
    const html = katex.renderToString(latex, { throwOnError: false, trust: false, strict: 'error', maxExpand: 100, maxSize: 10 });
    const container = document.createElement('div'); container.innerHTML = html;
    expect(container.querySelector('script')).toBeNull();
    expect(container.querySelector('a[href]')).toBeNull();
    expect(container.querySelector('.evil')).toBeNull();
  }
});
