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
  const unit = unitFromLine(text);
  if (unit) {
    if (options.expectedUnit && normalizeUnit(unit) === normalizeUnit(options.expectedUnit)) score += 5;
    else if (options.unitAliases?.includes(unit)) score += 1.5;
    else score -= .5;
  }
  let compatible = true;
  try { parseMathStatement(text); } catch {
    if (!unit) compatible = false;
    else try { parseMathStatement(text.slice(0, -unit.length).trim()); } catch { compatible = false; }
  }
  score += compatible ? .8 : -1.6;
  const bracketBalance = [...compact].reduce((n, ch) => n + (ch === '(' ? 1 : ch === ')' ? -1 : 0), 0);
  if (bracketBalance !== 0) score -= 1.5;
  if ((compact.match(/=/g) ?? []).length > 1) score -= 2;
  if (/[+\-*/×÷=<>]$/.test(compact)) score -= 1.2;
  if (/^[*/×÷=<>]/.test(compact)) score -= 1.2;
  if (/[+\-*/×÷=<>]{2}/.test(compact)) score -= 1.4;
  if (/[.,](?![0-9])|(?<![0-9])[.,]/.test(compact)) score -= 1;
  if (compact.includes('%') && !/[0-9]%$/.test(compact)) score -= 1;
  // A unit must be the suffix, not a word in the middle of arithmetic.
  if (unit && !compact.endsWith(unit)) score -= 1;
  const first = compact[0]!, last = compact[compact.length - 1]!;
  if (symbols.length > 1 && isOperator(first) && first !== '-') score -= .4;
  if (isOperator(last) || last === '.' || last === ',') score -= .4;
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
