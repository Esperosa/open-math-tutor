import { bottom, centerX, centerY, isBar, median, right, union } from './strokes';
import type { BBox, RecognizedSymbol } from './types';
import { readUnitSuffix } from './units';

export interface ParsedLine { text: string; confidence: number; symbols: RecognizedSymbol[]; uncertain?: boolean }
interface Token { text: string; bbox: BBox }
const canonical = (label: string): string => ({ '×': '*', '·': '*', '÷': '/', ':': '/', '[': '(', ']': ')', '{': '(', '}': ')', '≤': '<=', '≥': '>=' } as Record<string, string>)[label] ?? label;

/** Shared's safe AST accepts decimal comma/dot directly, so keep the written number readable. */
export function normalizeExpression(text: string): string {
  // Only the curriculum's variables get implicit multiplication. Unit words
  // (Kc, ohm, mol, km, kWh, ...) must stay intact so the answer checker can
  // read them; turning them into K*c or m*o*l would make a correct answer
  // unreadable.
  // The recogniser confuses a handwritten zero with the lowercase letter o.
  // Repair it only beside digits or a decimal separator so unit words (mol, ohm) survive.
  return text.replace(/(^|[^a-zA-Z])[oO](?=\d|[,.]\d|[^a-zA-Z]|$)/g, '$10')
    .replace(/(\d)x(?=\d)/g, '$1*')
    .replace(/(\d)([xyab(])/g, '$1*$2').replace(/\)([\dxyab(])/g, ')*$1')
    .replace(/([xyab])(?=[xyab(])/g, '$1*')
    .replace(/(\d+|\([^()]*\))%(?!\s*$)/g, '($1/100)');
}

function layout(input: Token[], depth = 0): string {
  if (depth > 12) return ''; // Explicit recursion budget for malformed nested drawings.
  let tokens = [...input];
  for (const root of tokens.filter(t => t.text === '√')) {
    const covered = tokens.filter(t => t !== root && centerX(t.bbox) > root.bbox.x + root.bbox.width * .35 && centerX(t.bbox) < right(root.bbox)
      && t.bbox.y > root.bbox.y - root.bbox.height * .1 && bottom(t.bbox) < bottom(root.bbox) + root.bbox.height * .5);
    const following = [...tokens].sort((a, b) => a.bbox.x - b.bbox.x);
    const next = following[following.indexOf(root) + 1];
    const argument = covered.length ? covered : next && /^[0-9a-zA-Z]$/.test(next.text) ? [next] : [];
    if (argument.length) {
      tokens = tokens.filter(t => t !== root && !argument.includes(t));
      tokens.push({ text: `(${layout(argument, depth + 1)})^(1/2)`, bbox: union([root.bbox, ...argument.map(t => t.bbox)]) });
    }
  }
  // Inner/narrow fractions first, then the surrounding fraction can consume the result.
  const bars = tokens.filter(t => t.text === '-' && isBar(t.bbox)).sort((a, b) => a.bbox.width - b.bbox.width);
  for (const bar of bars) {
    if (!tokens.includes(bar)) continue;
    const b = bar.bbox, limit = Math.max(b.width * 1.3, median(tokens.map(t => t.bbox.height)) * 1.4);
    const neighbors = tokens.filter(t => t !== bar && centerX(t.bbox) > b.x && centerX(t.bbox) < right(b)
      && Math.abs(centerY(t.bbox) - centerY(b)) < limit);
    const above = neighbors.filter(t => bottom(t.bbox) < centerY(b));
    const below = neighbors.filter(t => t.bbox.y > centerY(b));
    if (!above.length || !below.length) continue;
    const consumed = new Set([bar, ...above, ...below]);
    tokens = tokens.filter(t => !consumed.has(t));
    tokens.push({ text: `(${layout(above, depth + 1)})/(${layout(below, depth + 1)})`, bbox: union([...consumed].map(t => t.bbox)) });
  }
  tokens.sort((a, b) => a.bbox.x - b.bbox.x);
  const h = median(tokens.filter(t => t.bbox.height > 3 && !'+-=*/.,'.includes(t.text)).map(t => t.bbox.height));
  const baseline = median(tokens.filter(t => t.bbox.height >= h * .8).map(t => bottom(t.bbox)));
  let out = '';
  for (let i = 0; i < tokens.length; i++) {
    const token = tokens[i];
    out += token.text;
    const superscript: Token[] = [];
    let previous = token;
    while (i + 1 < tokens.length) {
      const next = tokens[i + 1];
      if (!/[0-9a-zA-Z)]$/.test(previous.text) && !superscript.length) break;
      if (!/^[0-9a-zA-Z()+-]+$/.test(next.text) || centerY(next.bbox) >= baseline - h * .55
        || next.bbox.height > h * .8 || bottom(next.bbox) >= baseline - h * .32
        || next.bbox.x - right(previous.bbox) > h * .9 || next.bbox.x < centerX(token.bbox)) break;
      superscript.push(next); previous = next; i++;
    }
    if (superscript.length) {
      const exponent = layout(superscript, depth + 1);
      out += exponent.length === 1 ? `^${exponent}` : `^(${exponent})`;
    }
  }
  return out;
}

/** Pure spatial composition; does not use a solver or change a wrong equation into a correct one. */
export function parseLine(symbols: readonly RecognizedSymbol[], choices?: readonly number[], unitAliases: readonly string[] = []): ParsedLine {
  if (symbols.length > 128) throw new RangeError('At most 128 symbols per line');
  if (!symbols.length) return { text: '', confidence: 0, symbols: [] };
  let logConfidence = 0;
  const tokens = symbols.map((symbol, i) => {
    const choice = choices?.[i] ?? -1;
    const label = choice < 0 ? symbol.label ?? symbol.candidates[0]?.label : symbol.candidates[choice]?.label;
    const candidate = symbol.candidates.find(c => c.label === label) ?? (choice < 0 && symbol.label ? symbol.candidates[0] : undefined);
    logConfidence += Math.log(Math.max(1e-12, symbol.confirmed ? 1 : candidate?.probability ?? 0));
    return { text: canonical(label ?? '?'), bbox: symbol.bbox };
  });
  // A bare long line is a drawing/dash, not enough evidence of a mathematical minus.
  if (tokens.length === 1 && tokens[0].text === '-' && isBar(tokens[0].bbox)) return { text: '', confidence: 0, symbols: [...symbols] };
  const raw = layout(tokens), unit = readUnitSuffix(raw, unitAliases);
  const text = unit ? `${normalizeExpression(unit.expression)} ${unit.unit}` : normalizeExpression(raw);
  return { text, confidence: Math.exp(logConfidence / symbols.length), symbols: [...symbols], ...(unit?.uncertain ? { uncertain: true } : {}) };
}
