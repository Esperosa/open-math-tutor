import type { ChatMessageKey } from './messages';
import type { FaqId } from './faq';

/** A tap-to-answer chip under the tutor's bubble: the student can converse without typing at all. */
export type ChipId = 'explain' | 'next_step' | 'understand' | 'lost' | 'example' | 'hint' | 'next_problem' | 'why_wrong' | 'faq_marks' | 'faq_modes' | 'faq_delete';
export const CHIP_LABEL: Record<ChipId, ChatMessageKey> = {
  explain: 'chipExplain', next_step: 'chipNextStep', understand: 'chipUnderstand', lost: 'chipLost', example: 'chipExample', hint: 'chipHint',
  next_problem: 'chipNextProblem', why_wrong: 'chipWhyWrong', faq_marks: 'chipFaqMarks', faq_modes: 'chipFaqModes', faq_delete: 'chipFaqDelete',
};
export const CHIP_FAQ: Partial<Record<ChipId, FaqId>> = { faq_marks: 'marks', faq_modes: 'modes', faq_delete: 'delete' };

export interface ReplyContext {
  /** Kind of the tutor's last message, if any. */
  kind: 'wrong' | 'check_in' | 'solved' | 'unclear' | 'info' | 'thinking' | 'error' | null;
  canRequest: boolean;
  lessonActive: boolean;
  /** The last tutor message came from the AI (an answer), not from the local coach. */
  answeredByAi: boolean;
  /** The board has at least one written line. */
  hasLines: boolean;
}

/** At most five chips, chosen by what was just said, so the shortest useful answer is always one tap away. */
export function quickReplies(ctx: ReplyContext): ChipId[] {
  const next: ChipId[] = ctx.lessonActive ? ['next_problem'] : [];
  if (ctx.kind === 'thinking') return [];
  if (!ctx.canRequest) {
    // Without AI only local help is honest to offer.
    if (ctx.kind === 'wrong') return ['hint', 'understand', 'faq_marks', 'faq_delete'];
    if (ctx.kind === 'solved') return [...next, 'faq_modes'];
    return ['faq_marks', 'faq_modes', 'faq_delete'];
  }
  switch (ctx.kind) {
    case 'wrong': return ['hint', 'explain', 'next_step', 'understand', 'lost'];
    case 'check_in': return ['explain', 'hint'];
    case 'unclear': return ['explain', 'hint', 'example'];
    case 'solved': return [...next, 'example', 'explain'];
    case 'error': return ['hint', 'explain'];
    default:
      if (ctx.answeredByAi) return ['understand', 'lost', 'explain', 'example', 'next_step'];
      return ctx.hasLines ? ['hint', 'example', 'faq_marks', 'faq_modes'] : ['example', 'faq_marks', 'faq_modes'];
  }
}
