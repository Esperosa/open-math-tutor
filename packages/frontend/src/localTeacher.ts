import { parseMathStatement, evaluateMathAst, type BoardAction, type Locale } from '@openmathtutor/shared';
import type { WrittenLine } from './lines';

export interface LocalTeacherOptions {
  /** When true, reveals the computed arithmetic solution instead of a guiding question. */
  revealSolution?: boolean;
  /** Number of consecutive errors on this line. When >= 2, reveals the solution. */
  attemptCount?: number;
}

/**
 * Local tutor without AI:
 * On first mistake: circles the line and asks a guiding question ("Zkus ten řádek přepočítat po operacích").
 * The correct value is only written after an explicit hint request or upon repeated mistake (attemptCount >= 2).
 */
export function localTeacherActions(
  line: WrittenLine | undefined,
  revision: number,
  locale: Locale,
  opts: LocalTeacherOptions | boolean = false,
): BoardAction[] {
  if (!line) return [];
  const options: LocalTeacherOptions = typeof opts === 'boolean' ? { revealSolution: opts } : opts;
  const shouldReveal = !!options.revealSolution || (typeof options.attemptCount === 'number' && options.attemptCount >= 2);

  let text = locale === 'cs' ? 'Zkus ten řádek přepočítat po operacích.' : 'Try recalculating that line operation by operation.';

  if (shouldReveal) {
    let correctedText: string | null = null;
    const source = line.latexGuess
      .replace(/[−–]/g, '-')
      .replace(/[×·]/g, '*')
      .replace(/÷|:/g, '/')
      .replace(/(\d),(?=\d)/g, '$1.');
    try {
      const parsed = parseMathStatement(source);
      if (parsed.form === 'relation' && parsed.value.op === 'eq') {
        const lhs = evaluateMathAst(parsed.value.lhs, {});
        const rhs = evaluateMathAst(parsed.value.rhs, {});
        if (Number.isFinite(lhs) && Number.isFinite(rhs) && lhs !== rhs && Math.abs(lhs) < 1e12) {
          const corrected = Number(lhs.toPrecision(10));
          if (Math.abs(corrected - lhs) < 1e-12) {
            correctedText = `${line.latexGuess.split('=')[0]!.trim()}=${String(corrected).replace('.', locale === 'cs' ? ',' : '.')}`;
          }
        }
      }
    } catch {
      /* algebra, units, incomplete or unsupported input: fallback to hint */
    }
    text = correctedText ?? (locale === 'cs' ? 'Zkontroluj tenhle krok.' : 'Check this step.');
  }

  const id = `coach-${line.stepId}`;
  return [
    { id: `${id}-circle`, type: 'circle', boardRevision: revision, targetStepId: line.stepId },
    {
      id: `${id}-label`,
      type: 'write_text',
      boardRevision: revision,
      text,
      placement: { relativeToStepId: line.stepId, side: 'right', offsetEm: 1.5 },
    },
  ];
}
