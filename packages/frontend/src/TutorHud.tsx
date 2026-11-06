import { useEffect, useState } from 'react';
import type { CoachMode } from '@openmathtutor/shared';
import type { MessageKey } from './i18n';
import { Tutor, type TutorMood } from './Tutor';
import { useReducedMotion } from './useReducedMotion';
import { useTutorVisit } from './useTutorVisit';
import type { TutorRect } from './tutorPosition';

export interface TutorMessage {
  id: string;
  kind: 'wrong' | 'check_in' | 'solved' | 'unclear' | 'info' | 'thinking' | 'error';
  text: string;
  /** Exact written line (including a multiline suffix), scoped to the current board. */
  stepId?: string;
  /** Why the local checker flagged the line; picks the local, AI-free hint. */
  reason?: 'arithmetic' | 'not_equivalent' | 'wrong_value';
}
export type TutorAction = 'check' | 'hint' | 'next_step' | 'explain_differently' | 'next_problem' | 'free' | 'self_done' | 'self_fail' | 'stop';
export type TutorChoice = 'explain' | 'hint' | 'local_hint' | 'retry_line' | 'dismiss' | 'next' | 'ask_ai' | 'confirm_final' | 'report_failed';

interface Props {
  t: Record<MessageKey, string>;
  mood: TutorMood;
  speaking: boolean;
  message: TutorMessage | null;
  locateStep?(id: string): TutorRect | null;
  menuOpen: boolean;
  /** A settings panel or drawer is open: only the mascot stays, bubble and menu wait. */
  quiet?: boolean;
  /** The lesson's task cannot be checked automatically: offer the student to report how it went. */
  selfAssess?: boolean;
  running: boolean;
  canRequest: boolean;
  lessonActive: boolean;
  mode: CoachMode;
  voiceOn: boolean;
  micAvailable: boolean;
  listening: boolean;
  notesVisible?: boolean;
  hasNotes?: boolean;
  onToggleNotes?(): void;
  onClearNotes?(): void;
  onToggleMenu(): void;
  onMode(mode: CoachMode): void;
  onVoice(on: boolean): void;
  onMic(): void;
  onAction(action: TutorAction): void;
  onChoice(choice: TutorChoice): void;
}

const MODES: { mode: CoachMode; label: MessageKey }[] = [
  { mode: 'live', label: 'coachLive' }, { mode: 'final', label: 'coachFinal' }, { mode: 'off', label: 'coachOff' },
];

export function TutorHud(p: Props) {
  const { t, message } = p;
  const reduced = useReducedMotion();
  const visit = useTutorVisit(message?.id, message?.text ?? '', message?.stepId, !!p.quiet || p.menuOpen, reduced, p.locateStep);
  const key = `${message?.id}:${message?.text}`;
  const [reveal, setReveal] = useState({ key, count: 1 });
  const brief = message ? briefText(message.text) : '';
  const count = reduced ? brief.length : reveal.key === key ? reveal.count : 1;
  const visible = !!message && !p.quiet && !p.menuOpen;
  const writing = visible && count < brief.length;
  useEffect(() => {
    if (!visible || reduced) return;
    setReveal({ key, count: 1 });
    const start = Date.now() + 650;
    const timer = setInterval(() => {
      const count = Math.min(brief.length, Math.max(1, Math.floor((Date.now() - start) / 24)));
      setReveal({ key, count });
      if (count === brief.length) clearInterval(timer);
    }, 24);
    return () => clearInterval(timer);
  }, [key, brief.length, visible, reduced]);
  return <div ref={visit.ref} className={`tutor-hud${visit.away ? ' tutor-visiting' : ''}`} data-testid="tutor-hud" data-visiting={visit.visiting} data-returning={visit.returning}
    style={{ transform: `translate(${visit.x}px, ${visit.y}px)`, ...(visit.snap ? { transition: 'none' } : {}) }}
    onTransitionEnd={e => { if (e.target === e.currentTarget && e.propertyName === 'transform') visit.finishReturn(); }}>
    {message && visible && <div className={`tutor-bubble tutor-bubble-${message.kind}`} role="group" data-testid="tutor-bubble" data-kind={message.kind}>
      <BubbleText id={message.id} text={message.text} count={count} away={visit.away} more={t.moreText} less={t.lessText} />
      <fieldset className="tutor-choices" disabled={visit.away} aria-hidden={visit.away || undefined}>
      {message.kind === 'check_in' && <div className="row">
        <button onClick={() => p.onChoice('report_failed')}>{t.checkInFailed}</button>
        <button onClick={() => p.onChoice('confirm_final')}>{t.checkInFinal}</button>
        <button onClick={() => p.onChoice('dismiss')}>{t.offerDismiss}</button>
      </div>}
      {message.kind === 'wrong' && message.stepId && <div className="row">
        <button onClick={() => p.onChoice('local_hint')}>{t.offerLocalHint}</button>
        <button onClick={() => p.onChoice('retry_line')}>{t.offerRetryLine}</button>
      </div>}
      {message.kind === 'wrong' && <div className="row">
        <button className="primary" disabled={p.running} onClick={() => p.onChoice('explain')}>{t.offerExplain}</button>
        <button disabled={p.running} onClick={() => p.onChoice('hint')}>{t.offerHint}</button>
        <button onClick={() => p.onChoice('dismiss')}>{t.offerDismiss}</button>
      </div>}
      {message.kind === 'solved' && <div className="row">
        {p.lessonActive && <button className="primary" onClick={() => p.onChoice('next')}>{t.nextProblem}</button>}
        <button onClick={() => p.onChoice('dismiss')}>{t.offerDismiss}</button>
      </div>}
      {message.kind === 'unclear' && <div className="row">
        <button className="primary" disabled={p.running} onClick={() => p.onChoice('ask_ai')}>{t.askTeacher}</button>
        <button onClick={() => p.onChoice('dismiss')}>{t.offerDismiss}</button>
      </div>}
      </fieldset>
    </div>}
    {p.menuOpen && !p.quiet && <div className="tutor-menu" role="menu" aria-label={t.tutorMenu}>
      <div className="tutor-modes" role="radiogroup" aria-label={t.coachModeLabel}>
        {MODES.map(m => <button key={m.mode} role="radio" aria-checked={p.mode === m.mode} className={p.mode === m.mode ? 'primary' : ''} onClick={() => p.onMode(m.mode)}>{t[m.label]}</button>)}
      </div>
      <small className="muted">{t[p.mode === 'live' ? 'coachLiveHint' : p.mode === 'final' ? 'coachFinalHint' : 'coachOffHint']}</small>
      <div className="tutor-actions">
        {(['check', 'hint', 'next_step', 'explain_differently'] as const).map(action =>
          <button key={action} role="menuitem" disabled={!p.canRequest || p.running} onClick={() => p.onAction(action)}>{t[action]}</button>)}
        {p.lessonActive && <button role="menuitem" onClick={() => p.onAction('next_problem')}>{t.nextProblem}</button>}
        {p.selfAssess && <button role="menuitem" className="primary" onClick={() => p.onAction('self_done')}>{t.selfDone}</button>}
        {p.selfAssess && <button role="menuitem" onClick={() => p.onAction('self_fail')}>{t.selfFail}</button>}
        <button role="menuitem" onClick={() => p.onAction('free')}>{t.freeProblem}</button>
        {p.hasNotes && <button role="menuitem" onClick={p.onToggleNotes}>{p.notesVisible ? t.hideTeacherNotes : t.showTeacherNotes}</button>}
        {p.hasNotes && <button role="menuitem" onClick={p.onClearNotes}>{t.clearTeacherNotes}</button>}
        {p.running && <button role="menuitem" className="stop" onClick={() => p.onAction('stop')}>{t.stop}</button>}
      </div>
      <label className="check-label"><input type="checkbox" checked={p.voiceOn} onChange={e => p.onVoice(e.target.checked)} />{t.tutorSpeaks}</label>
      {p.micAvailable && <button role="menuitem" className={p.listening ? 'primary' : ''} aria-pressed={p.listening} onClick={p.onMic}>{p.listening ? t.micListening : t.micAsk}</button>}
    </div>}
    <button className="tutor-button" aria-label={t.tutorMenu} aria-expanded={p.menuOpen} disabled={visit.away} onClick={p.onToggleMenu}>
      <Tutor mood={p.mood} speaking={p.speaking} writing={writing} />
    </button>
  </div>;
}

const LIMIT = 220;
function briefText(text: string) {
  if (text.length <= LIMIT) return text;
  return `${(text.slice(0, LIMIT).replace(/[^.!?…]*$/, '') || text.slice(0, LIMIT)).trim()}…`;
}
/** A tutor speaks briefly: long answers show the first sentences and expand on request. */
function BubbleText({ id, text, count, away, more, less }: { id: string; text: string; count: number; away: boolean; more: string; less: string }) {
  const [open, setOpen] = useState<string | null>(null);
  const brief = briefText(text);
  const shown = open === id ? text : brief;
  return <>
    {/* Announce the complete sentence once, never every typewriter character. */}
    <span className="sr" role="status" aria-live="polite" aria-atomic="true">{shown}</span>
    <p className="tutor-handwriting" aria-hidden="true">
      <span className="tutor-text-space">{shown}</span>
      <span className="tutor-text-reveal" data-testid="tutor-typewriter" data-complete={open === id || count >= brief.length}>{open === id ? text : shown.slice(0, count)}</span>
    </p>
    {text.length > LIMIT && <button className="link-btn" disabled={away} onClick={() => setOpen(open === id ? null : id)}>{open === id ? less : more}</button>}
  </>;
}
