import { checkAnswerLine, expectedAnswerFor, looksLikeFinalLine, numbersIn, normalizeUnit, unitFromLine, type ExpectedAnswer } from "./answers.js";
import { checkStep, statementHasSymbols, type StepVerdict } from "./stepCheck.js";
export interface JudgedLine { stepId: string; latexGuess: string; uncertain?: boolean }

/** One policy shared by margin marks and the coach. Unreadable ink is never evidence. */
export function judgeLines(statement: string, lines: readonly JudgedLine[], expected?: ExpectedAnswer, confirmedFinals: readonly string[] = []): Record<string, StepVerdict> {
  const task = statement.trim() || (lines[0]?.uncertain ? '' : lines[0]?.latexGuess ?? '');
  expected ??= expectedAnswerFor(task);
  const symbols = statementHasSymbols(task), result: Record<string, StepVerdict> = {};
  let previous: string | null = task || null;
  for (const [index, line] of lines.entries()) {
    if (line.uncertain) { result[line.stepId] = { status: 'unknown' }; continue; }
    const firstEquation = index === 0 && symbols && task.replace(/[\s*]/g, '') === line.latexGuess.replace(/[\s*]/g, '');
    const final = looksLikeFinalLine(line.latexGuess, symbols);
    // A root is compared with the original equation, not a possibly wrong
    // previous attempt. The task equation itself is not an answer.
    let verdict = firstEquation ? { status: 'unknown' as const } : checkStep(line.latexGuess, symbols && final ? task : previous);
    previous = line.latexGuess;
    if (expected && final && !firstEquation && verdict.status !== 'wrong') {
      const answer = checkAnswerLine(confirmedFinals.includes(`${line.stepId}:${line.latexGuess}`)
        ? { ...expected, wordProblem: false, givens: [] } : expected, line.latexGuess);
      if (answer === 'wrong' || answer === 'unit') verdict = { status: 'wrong', reason: 'wrong_value' };
      else if (answer === 'correct' && (!symbols || verdict.status === 'ok' || (!line.latexGuess.includes('=') && /^[\d.,\s+\-−*/()·×÷^]+$/.test(line.latexGuess)))) {
        verdict = expected.wordProblem && expected.unit && !unitFromLine(line.latexGuess) ? { status: 'unknown' } : { status: 'ok' };
      } else if (expected.wordProblem) verdict = { status: 'unknown' };
    }
    // Arithmetic correctness alone is not task correctness for a word problem.
    if (expected?.wordProblem && verdict.status === 'ok' && !final) verdict = { status: 'unknown' };
    if (expected?.wordProblem && expected.givens?.length && verdict.status === 'ok') {
      const computations = line.latexGuess.split('=').slice(0, -1).filter(part => /[+\-*/:]/.test(part) && /\d/.test(part));
      const permitted = [...expected.givens, ...conversionNumbers(task, expected.unit)];
      if (computations.some(part => {
        const operands = numbersIn(part);
        return operands.some(n => !permitted.some(g => Math.abs(n - Math.abs(g)) < 1e-9))
          || !operands.some(n => expected.givens!.some(g => Math.abs(n - Math.abs(g)) < 1e-9));
      })) {
        verdict = { status: 'unknown' };
      }
    }
    result[line.stepId] = verdict;
  }
  return result;
}

/** Unit-derived conversion factors, not arbitrary constants inferred from a matching result. */
function conversionNumbers(statement: string, unit?: string): number[] {
  if (!unit) return [];
  const expected = normalizeUnit(unit), factors: number[] = [];
  if (/\bmin\b|minut/i.test(statement) && /\/(?:h|s)$/.test(expected)) factors.push(60);
  if (/\bh\b|hodin/i.test(statement) && expected.endsWith('/s')) factors.push(3600);
  if (/\bs\b|sekund/i.test(statement) && expected.endsWith('/h')) factors.push(3600);
  if (/\bkm\b|kilometr/i.test(statement) && /^m(?:\/|$)/.test(expected)) factors.push(1000);
  if (/\bm\b|metr/i.test(statement) && /^km(?:\/|$)/.test(expected)) factors.push(1000);
  return factors;
}
