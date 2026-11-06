import { parseMathStatement, evaluateMathAst, type BoardAction, type Locale } from '@openmathtutor/shared';
import type { WrittenLine } from './lines';
/** Only constant arithmetic we can independently evaluate is corrected locally.
 * Everything else gets a guiding question, never an invented corrected step. */
export function localTeacherActions(line: WrittenLine | undefined, revision: number, locale: Locale): BoardAction[] {
  if (!line) return [];
  let text = locale === 'cs' ? 'Zkontroluj tenhle krok.' : 'Check this step.';
  const source = line.latexGuess.replace(/[−–]/g, '-').replace(/[×·]/g, '*').replace(/÷|:/g, '/').replace(/(\d),(?=\d)/g, '$1.');
  try {
    const parsed = parseMathStatement(source);
    if (parsed.form === 'relation' && parsed.value.op === 'eq') {
      const lhs = evaluateMathAst(parsed.value.lhs, {}), rhs = evaluateMathAst(parsed.value.rhs, {});
      if (Number.isFinite(lhs) && Number.isFinite(rhs) && lhs !== rhs && Math.abs(lhs) < 1e12) {
        const corrected = Number(lhs.toPrecision(10));
        // Do not present a rounded irrational / repeating decimal as equality.
        if (Math.abs(corrected - lhs) < 1e-12) text = `${line.latexGuess.split('=')[0].trim()}=${String(corrected).replace('.', locale === 'cs' ? ',' : '.')}`;
      }
    }
  } catch { /* algebra, units, incomplete or unsupported input: hint only */ }
  const id = `coach-${line.stepId}`;
  return [
    { id: `${id}-circle`, type: 'circle', boardRevision: revision, targetStepId: line.stepId },
    { id: `${id}-label`, type: 'write_text', boardRevision: revision, text,
      placement: { relativeToStepId: line.stepId, side: 'right', offsetEm: 1.5 } },
  ];
}
