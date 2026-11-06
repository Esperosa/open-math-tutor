import { judgeLines, type ExpectedAnswer, type StepVerdict } from '@openmathtutor/shared';
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
  return judgeLines(statement, lines, expected, confirmedFinals);
}
