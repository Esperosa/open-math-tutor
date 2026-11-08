import { normalizeUnit, parseMathStatement, unitFromLine } from '@openmathtutor/shared';
import { parseLine } from './parse';
import type { RecognizedSymbol } from './types';

export interface ContextReadOptions {
  unitAliases?: readonly string[];
  expectedUnit?: string;
  maxCandidates?: number;
  beamWidth?: number;
  /** Do not replace the neural top-1 reading for a smaller gain. */
  minGain?: number;
  taskPrompt?: string;
  previousLines?: readonly string[];
}

export interface ContextRead {
  text: string;
  confidence: number;
  uncertain?: boolean;
  rawText: string;
  rawConfidence: number;
  contextualized: boolean;
  gain: number;
}

interface Beam { choices: number[]; labels: string[]; logp: number }

const optionLabel = (symbol: RecognizedSymbol, option: number): string =>
  option < 0 ? symbol.label ?? symbol.candidates[0]?.label ?? '?' : symbol.candidates[option]?.label ?? '?';

const optionProbability = (symbol: RecognizedSymbol, option: number): number => {
  if (symbol.confirmed) return 1;
  if (option >= 0) return symbol.candidates[option]?.probability ?? 1e-12;
  // A label set by the geometric contextualizer is a decision, not a new
  // neural score; charge the top-1 evidence so it is not outvoted by the raw
  // shortlist (a decimal dot is often rank 2 behind a multiplication dot).
  return symbol.candidates[0]?.probability ?? 1e-12;
};

const operators = new Set([...'+-*/×÷=<>']);
const isOperator = (ch: string): boolean => operators.has(ch);

/**
 * Syntax and spelling prior only. It never evaluates the expression, compares
 * sides, or prefers an answer because it would be mathematically true.
 */
function prior(text: string, symbols: readonly RecognizedSymbol[], options: ContextReadOptions): number {
  const compact = text.replace(/\s+/g, '');
  if (!compact) return -6;
  let score = 0;

  // 1. Units
  const unit = unitFromLine(text);
  if (unit) {
    if (options.expectedUnit && normalizeUnit(unit) === normalizeUnit(options.expectedUnit)) score += 5;
    else if (options.unitAliases?.includes(unit)) score += 1.5;
    else score -= .5;
  }

  // Syntax validity (handles complete statements or working lines ending with '=')
  let compatible = true;
  try {
    parseMathStatement(text);
  } catch {
    if (compact.endsWith('=')) {
      try { parseMathStatement(compact.slice(0, -1)); } catch { compatible = false; }
    } else if (unit) {
      try { parseMathStatement(text.slice(0, -unit.length).trim()); } catch { compatible = false; }
    } else {
      compatible = false;
    }
  }
  score += compatible ? .8 : -1.6;

  // 2. Expression grammar penalties
  // Exponent grammar: ^+, ^-, ^=, ^^, ^/, ^* are heavily penalized
  if (/\^[+\-*/×÷=^]/.test(compact) || /\^\([+\-*/×÷=^]/.test(compact)) score -= 8.0;

  // Double operators (excluding valid multi-char tokens like <=, >=, !=)
  const strippedOps = compact.replace(/<=|>=|!=/g, '');
  if (/[+\-*/×÷=<>]{2}/.test(strippedOps)) score -= 6.0;

  // Brackets: unbalanced, empty, inverted, or operator adjacent to bracket edge
  const bracketBalance = [...compact].reduce((n, ch) => n + (ch === '(' ? 1 : ch === ')' ? -1 : 0), 0);
  if (bracketBalance !== 0) score -= 6.0;
  if (/\(\)/.test(compact)) score -= 6.0;
  if (/\)\(/.test(compact)) score -= 8.0;
  if (/\([*/×÷^=]/.test(compact)) score -= 5.0;
  if (/[+\-*/×÷^=]\)/.test(compact)) score -= 5.0;

  // Multiple equals in a single statement
  const equalsCount = (compact.match(/=/g) ?? []).length;
  if (equalsCount > 1) score -= 6.0;

  // Trailing or leading operators (except leading minus or trailing equal sign in incomplete working)
  if (/[+\-*/×÷<>]$/.test(compact)) score -= 2.5;
  else if (compact.endsWith('=')) {
    score -= 0.2;
  }
  if (/^[*/×÷=<>]/.test(compact)) score -= 2.5;

  if (/[.,](?![0-9])|(?<![0-9])[.,]/.test(compact)) score -= 2.0;
  if (compact.includes('%') && !/[0-9]%$/.test(compact)) score -= 2.0;
  if (unit && !compact.endsWith(unit)) score -= 2.0;

  // 3. Digit count plausibility (e.g. 5+1=1005: 4-digit RHS for 1-digit operands)
  if (equalsCount === 1) {
    const [lhs, rhs] = compact.split('=');
    if (lhs && rhs) {
      const lhsNumbers = (lhs.match(/\d+(?:[.,]\d+)?/g) ?? []).map(s => s.replace(/[.,]/, ''));
      const rhsNumbers = (rhs.match(/\d+(?:[.,]\d+)?/g) ?? []).map(s => s.replace(/[.,]/, ''));
      if (lhsNumbers.length > 0 && rhsNumbers.length === 1) {
        const maxLhsDigits = Math.max(...lhsNumbers.map(n => n.length));
        const rhsDigits = rhsNumbers[0]!.length;
        const isMultiplication = /[*×·]/.test(lhs);
        const maxPlausibleDigits = isMultiplication
          ? lhsNumbers.reduce((sum, n) => sum + n.length, 0)
          : maxLhsDigits + 1;
        if (rhsDigits > maxPlausibleDigits + 1) {
          score -= 3.5 * (rhsDigits - maxPlausibleDigits);
        }
      }
    }
  }

  // 4. Weak-to-medium prior from task prompt and previous lines
  // NIKDY "rovnice vychází" jako prior (equation truth is never evaluated).
  if (options.taskPrompt) {
    const promptClean = options.taskPrompt.replace(/\s+/g, '');
    const match = promptClean.match(/[\d(a-zA-Z][\d(a-zA-Z+\-*/×÷=^.,)]*/);
    const promptExpr = match ? match[0].replace(/[=]+$/, '') : promptClean.replace(/[=]+$/, '');
    if (promptExpr) {
      const cleanLhs = compact.replace(/=.*$/, '');
      if (cleanLhs === promptExpr || compact.startsWith(promptExpr)) {
        score += 1.5;
      } else if (cleanLhs.startsWith(promptExpr)) {
        score += 1.0;
      }
    }
  }
  if (options.previousLines && options.previousLines.length > 0) {
    for (const prev of options.previousLines) {
      const prevVars = prev.match(/[a-zA-Z]/g);
      if (prevVars && prevVars.some(v => compact.includes(v))) {
        score += 0.4;
        break;
      }
    }
  }

  const first = compact[0]!, last = compact[compact.length - 1]!;
  if (symbols.length > 1 && isOperator(first) && first !== '-') score -= .4;
  if (isOperator(last) && last !== '=') score -= .4;
  return score;
}

/** Beam-search a line over the classifier's shortlist, then rank with syntax/unit priors. */
export function readLine(symbols: readonly RecognizedSymbol[], options: ContextReadOptions = {}): ContextRead {
  const raw = parseLine(symbols, undefined, options.unitAliases);
  const rawText = raw.text;
  const rawChoices = symbols.map(() => -1);
  if (symbols.length === 0) return { text: '', confidence: 0, rawText: '', rawConfidence: 0, contextualized: false, gain: 0 };
  const maxCandidates = Math.max(1, Math.min(options.maxCandidates ?? 3, 5));
  const beamWidth = Math.max(1, Math.min(options.beamWidth ?? 24, 64));
  let beams: Beam[] = [{ choices: [], labels: [], logp: 0 }];
  for (const symbol of symbols) {
    const expanded: Beam[] = [];
    for (const beam of beams) {
      const seen = new Set<string>();
      for (let option = -1; option < maxCandidates; option++) {
        const label = optionLabel(symbol, option);
        if (seen.has(label)) continue;
        seen.add(label);
        expanded.push({ choices: [...beam.choices, option], labels: [...beam.labels, label],
          logp: beam.logp + Math.log(Math.max(1e-12, optionProbability(symbol, option))) });
      }
    }
    expanded.sort((a, b) => b.logp - a.logp);
    beams = expanded.slice(0, beamWidth);
  }
  // The top-1 path is always a candidate, even if a long uncertain line pushed it out of the beam.
  if (!beams.some(b => b.choices.every(c => c === -1))) {
    const logp = symbols.reduce((sum, s) => sum + Math.log(Math.max(1e-12, optionProbability(s, -1))), 0);
    beams.push({ choices: rawChoices, labels: symbols.map(s => optionLabel(s, -1)), logp });
  }
  const parsed = beams.map(beam => {
    const line = parseLine(symbols, beam.choices, options.unitAliases);
    return { ...beam, line, score: beam.logp + prior(line.text, symbols, options) };
  });
  const best = parsed.reduce((a, b) => b.score > a.score ? b : a);
  const rawBeam = parsed.find(b => b.choices.every(c => c === -1));
  const rawScore = rawBeam ? rawBeam.score : best.score;
  const gain = best.score - rawScore;
  const contextualized = best.line.text !== rawText && gain >= (options.minGain ?? .8);
  if (!contextualized) return { text: rawText, confidence: raw.confidence, uncertain: raw.uncertain, rawText, rawConfidence: raw.confidence, contextualized: false, gain };
  return { text: best.line.text, confidence: best.line.confidence, uncertain: best.line.uncertain,
    rawText, rawConfidence: raw.confidence, contextualized: true, gain };
}
