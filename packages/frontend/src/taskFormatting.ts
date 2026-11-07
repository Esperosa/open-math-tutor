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
