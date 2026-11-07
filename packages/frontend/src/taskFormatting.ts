import katex from 'katex';

const SUPERSCRIPTS: Record<string, string> = {
  '0': '⁰', '1': '¹', '2': '²', '3': '³', '4': '⁴',
  '5': '⁵', '6': '⁶', '7': '⁷', '8': '⁸', '9': '⁹',
  '+': '⁺', '-': '⁻', '=': '⁼', '(': '⁽', ')': '⁾',
  'a': 'ᵃ', 'b': 'ᵇ', 'c': 'ᶜ', 'd': 'ᵈ', 'e': 'ᵉ',
  'i': 'ⁱ', 'j': 'ʲ', 'k': 'ᵏ', 'm': 'ᵐ', 'n': 'ⁿ',
  'p': 'ᵖ', 'r': 'ʳ', 's': 'ˢ', 't': 'ᵗ', 'x': 'ˣ', 'y': 'ʸ', 'z': 'ᶻ',
};

function toSuperscript(s: string): string {
  return [...s].map(ch => SUPERSCRIPTS[ch] ?? ch).join('');
}

/**
 * Typesets math problem statements clearly for display on the handwritten whiteboard:
 * - Converts power exponents `^2`, `^n`, `^{2n+1}` into unicode superscripts `²`, `ⁿ`, etc.
 * - Replaces multiplication `*` with a readable middle dot `·`.
 * - Formats fractions `(a)/(b)` into clean text fractions `(a) / (b)`.
 * - Preserves natural spacing and task descriptions.
 */
export function formatTaskForBoard(statement: string): string {
  if (!statement) return '';
  let text = statement.trim();

  // Exponents: ^{...} or unbraced ^digits or ^single-letter
  text = text.replace(/\^\{([^}]+)\}/g, (_, exp) => toSuperscript(exp));
  text = text.replace(/\^([0-9]+|[a-z])/gi, (_, exp) => toSuperscript(exp));

  // Multiplication: replace * with middle dot
  text = text.replace(/\s*\*\s*/g, ' · ');

  // Fractions: clean up spacing around division slashes with parentheses or expressions
  text = text.replace(/\)\s*\/\s*\(/g, ') / (');
  text = text.replace(/\)\s*\/\s*([0-9a-zA-Z])/g, ') / $1');
  text = text.replace(/([0-9a-zA-Z])\s*\/\s*\(/g, '$1 / (');

  // Collapse excessive spaces
  text = text.replace(/[ \t]+/g, ' ');

  return text;
}

const MATH_WORDS = new Set([
  'lim', 'sin', 'cos', 'tan', 'tg', 'cotg', 'cot', 'log', 'ln', 'exp',
  'det', 'ker', 'dim', 'gcd', 'deg', 'max', 'min', 'inf', 'sup', 'infty',
  'frac', 'sqrt', 'cdot', 'times',
]);

function escapeHtml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function convertFormulaToLatex(formula: string): string {
  let latex = formula.trim();
  latex = latex.replace(/lim\s*\(([a-z]+)\s*(?:→|->)\s*(?:∞|\\infty)\)/gi, '\\lim_{$1 \\to \\infty}');
  latex = latex.replace(/\(([^)]+)\)\/\(([^)]+)\)/g, '\\frac{$1}{$2}');
  latex = latex.replace(/\(([^)]+)\)\/([0-9a-zA-Z]+)/g, '\\frac{$1}{$2}');
  latex = latex.replace(/([0-9a-zA-Z]+)\/\(([^)]+)\)/g, '\\frac{$1}{$2}');
  latex = latex.replace(/(\b[0-9a-zA-Z]+)\/(\b[0-9a-zA-Z]+)/g, '\\frac{$1}{$2}');
  latex = latex.replace(/\*/g, ' \\cdot ');
  return latex;
}

/**
 * Renders problem statements for the task card.
 * - Word problems (containing spaces, words, natural language, diacritics) are rendered as regular text with spaces.
 * - Only explicit `$math$` segments or pure standalone mathematical expressions without words are rendered via KaTeX.
 * - Returns HTML string or null (if statement should be rendered as plain text).
 */
export function renderMathStatement(raw: string): string | null {
  if (!raw || !raw.trim()) return null;

  // Case 1: Statement contains explicit $...$ math delimiters
  if (raw.includes('$')) {
    const parts = raw.split(/(\$[^$]+\$)/g);
    let hasMath = false;
    const renderedParts = parts.map(part => {
      if (part.startsWith('$') && part.endsWith('$') && part.length >= 2) {
        const mathContent = part.slice(1, -1);
        try {
          const rendered = katex.renderToString(convertFormulaToLatex(mathContent), {
            throwOnError: false, displayMode: false, strict: 'ignore',
          });
          hasMath = true;
          return rendered;
        } catch {
          return escapeHtml(part);
        }
      }
      return escapeHtml(part);
    });
    return hasMath ? renderedParts.join('') : null;
  }

  // Case 2: Statement without $. Check if it's a pure mathematical expression vs word problem.
  let prefix = '';
  let math = raw.trim();

  // Handle standard instruction prefix before a colon, e.g. "Vypočítej: 2x + 3 = 7"
  const colonIdx = raw.indexOf(':');
  if (colonIdx !== -1 && /[a-zA-Z\u00C0-\u024F]/.test(raw.slice(0, colonIdx))) {
    prefix = raw.slice(0, colonIdx + 1) + ' ';
    math = raw.slice(colonIdx + 1).trim();
  }

  // Extract all words of 2 or more letters
  const words = math.match(/[a-zA-Z\u00C0-\u024F]{2,}/g) || [];
  const nonMathWords = words.filter(w => !MATH_WORDS.has(w.toLowerCase()));

  // If there are words that are not standard math functions, this is a word problem!
  // Render as normal text so words and units (m, s, km/h, g, etc.) have proper spaces and no italic concatenation.
  if (nonMathWords.length > 0) {
    return null;
  }

  // Must contain some math operator, variable or fraction/equality to be worth rendering in KaTeX
  if (!/[/^=<>\u2264\u2265\u00b7+\\-]/.test(math) && !/lim/i.test(math)) {
    return null;
  }

  let suffix = '';
  if (math.endsWith('.')) {
    suffix = '.';
    math = math.slice(0, -1);
  }

  const latex = convertFormulaToLatex(math);

  try {
    const rendered = katex.renderToString(latex, { throwOnError: false, displayMode: false, strict: 'ignore' });
    return (prefix ? `<span>${escapeHtml(prefix)}</span>` : '') + rendered + suffix;
  } catch {
    return null;
  }
}
