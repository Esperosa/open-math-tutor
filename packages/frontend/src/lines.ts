import { checkAnswerLine, checkSteps, looksLikeFinalLine, statementHasSymbols, type ExpectedAnswer, type StepVerdict } from '@openmathtutor/shared';
import type { Step } from './boardState';

export interface WrittenLine { stepId: string; latexGuess: string; parentId: string; uncertain?: boolean }

/** One entry per written line: a text element holding several lines (Enter) is split so each line is judged on its own. */
export function writtenLines(steps: readonly Step[]): WrittenLine[] {
  return steps.flatMap(step => {
    const parts = step.latexGuess.split(/\n+/).map(p => p.trim()).filter(Boolean);
    if (parts.length <= 1) return step.latexGuess.trim() ? [{ stepId: step.stepId, latexGuess: step.latexGuess.trim(), parentId: step.stepId, uncertain: step.uncertain }] : [];
    return parts.map((part, i) => ({ stepId: `${step.stepId}#${i}`, latexGuess: part, parentId: step.stepId, uncertain: step.uncertain }));
  });
}

/** The task is the lesson statement, or - on a free board - the first thing the student wrote. */
export function effectiveStatement(statement: string, lines: readonly WrittenLine[]): string {
  return statement.trim() || lines[0]?.latexGuess || '';
}

/** One verdict per board step for the margin mark: any wrong line wins, then ok, otherwise unknown. */
export function markPerStep(lineVerdicts: Record<string, StepVerdict>, lines: readonly WrittenLine[]): Record<string, StepVerdict> {
  const result: Record<string, StepVerdict> = {};
  for (const line of lines) {
    const verdict = lineVerdicts[line.stepId];
    if (!verdict) continue;
    const current = result[line.parentId];
    if (!current || verdict.status === 'wrong' || (verdict.status === 'ok' && current.status === 'unknown')) {
      if (!(current?.status === 'wrong' && verdict.status !== 'wrong')) result[line.parentId] = verdict;
    }
  }
  return result;
}

/** Step-by-step verdicts, then the final answer line judged against the expected answer (number and unit). */
export function computeLineVerdicts(statement: string, lines: readonly WrittenLine[], expected?: ExpectedAnswer, confirmedFinals: readonly string[] = []): Record<string, StepVerdict> {
  const byLine = checkSteps(statement, lines);
  // A low-confidence reading is not a student error. Leave it unknown so the
  // coach asks or the student taps the correct character instead of marking ✗.
  for (const line of lines) if (line.uncertain) byLine[line.stepId] = { status: 'unknown' };
  if (!expected) return byLine;
  const symbols = statementHasSymbols(statement);
  for (const line of lines) {
    if (line.uncertain || byLine[line.stepId]?.status === 'wrong' || !looksLikeFinalLine(line.latexGuess, symbols)) continue;
    const answer = checkAnswerLine(confirmedFinals.includes(`${line.stepId}:${line.latexGuess}`) ? { ...expected, wordProblem: false, givens: [] } : expected, line.latexGuess);
    if (answer === 'correct') byLine[line.stepId] = { status: 'ok' };
    else if (answer === 'wrong' || answer === 'unit') byLine[line.stepId] = { status: 'wrong', reason: 'wrong_value' };
  }
  return byLine;
}
