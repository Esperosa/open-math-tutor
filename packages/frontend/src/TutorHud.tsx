import { useState } from 'react';
import type { CoachMode } from '@openmathtutor/shared';
import type { MessageKey } from './i18n';
import { Tutor, type TutorMood } from './Tutor';

export interface TutorMessage {
  id: string;
  kind: 'wrong' | 'solved' | 'unclear' | 'info' | 'thinking' | 'error';
  text: string;
}
export type TutorAction = 'check' | 'hint' | 'next_step' | 'explain_differently' | 'next_problem' | 'free' | 'stop';
export type TutorChoice = 'explain' | 'hint' | 'dismiss' | 'next' | 'ask_ai';

interface Props {
  t: Record<MessageKey, string>;
  mood: TutorMood;
  speaking: boolean;
  message: TutorMessage | null;
  menuOpen: boolean;
  running: boolean;
  canRequest: boolean;
  lessonActive: boolean;
  mode: CoachMode;
  voiceOn: boolean;
  micAvailable: boolean;
  listening: boolean;
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
  return <div className="tutor-hud">
    {message && <div className={`tutor-bubble tutor-bubble-${message.kind}`} role="group" aria-live="polite" data-testid="tutor-bubble" data-kind={message.kind}>
      <BubbleText id={message.id} text={message.text} more={t.moreText} less={t.lessText} />
      {message.kind === 'wrong' && <div className="row">
        <button className="primary" disabled={!p.canRequest || p.running} onClick={() => p.onChoice('explain')}>{t.offerExplain}</button>
        <button disabled={!p.canRequest || p.running} onClick={() => p.onChoice('hint')}>{t.offerHint}</button>
        <button onClick={() => p.onChoice('dismiss')}>{t.offerDismiss}</button>
      </div>}
      {message.kind === 'solved' && <div className="row">
        {p.lessonActive && <button className="primary" onClick={() => p.onChoice('next')}>{t.nextProblem}</button>}
        <button onClick={() => p.onChoice('dismiss')}>{t.offerDismiss}</button>
      </div>}
      {message.kind === 'unclear' && <div className="row">
        <button className="primary" disabled={!p.canRequest || p.running} onClick={() => p.onChoice('ask_ai')}>{t.askTeacher}</button>
        <button onClick={() => p.onChoice('dismiss')}>{t.offerDismiss}</button>
      </div>}
    </div>}
    {p.menuOpen && <div className="tutor-menu" role="menu" aria-label={t.tutorMenu}>
      <div className="tutor-modes" role="radiogroup" aria-label={t.coachModeLabel}>
        {MODES.map(m => <button key={m.mode} role="radio" aria-checked={p.mode === m.mode} className={p.mode === m.mode ? 'primary' : ''} onClick={() => p.onMode(m.mode)}>{t[m.label]}</button>)}
      </div>
      <small className="muted">{t[p.mode === 'live' ? 'coachLiveHint' : p.mode === 'final' ? 'coachFinalHint' : 'coachOffHint']}</small>
      <div className="tutor-actions">
        {(['check', 'hint', 'next_step', 'explain_differently'] as const).map(action =>
          <button key={action} role="menuitem" disabled={!p.canRequest || p.running} onClick={() => p.onAction(action)}>{t[action]}</button>)}
        {p.lessonActive && <button role="menuitem" onClick={() => p.onAction('next_problem')}>{t.nextProblem}</button>}
        <button role="menuitem" onClick={() => p.onAction('free')}>{t.freeProblem}</button>
        <button role="menuitem" className="stop" disabled={!p.running} onClick={() => p.onAction('stop')}>{t.stop}</button>
      </div>
      <label className="check-label"><input type="checkbox" checked={p.voiceOn} onChange={e => p.onVoice(e.target.checked)} />{t.tutorSpeaks}</label>
      {p.micAvailable && <button role="menuitem" className={p.listening ? 'primary' : ''} aria-pressed={p.listening} onClick={p.onMic}>{p.listening ? t.micListening : t.micAsk}</button>}
    </div>}
    <button className="tutor-button" aria-label={t.tutorMenu} aria-expanded={p.menuOpen} onClick={p.onToggleMenu}>
      <Tutor mood={p.mood} speaking={p.speaking} />
    </button>
  </div>;
}

const LIMIT = 220;
/** A tutor speaks briefly: long answers show the first sentences and expand on request. */
function BubbleText({ id, text, more, less }: { id: string; text: string; more: string; less: string }) {
  const [open, setOpen] = useState<string | null>(null);
  if (text.length <= LIMIT || open === id) return <p>{text}{open === id && <button className="link-btn" onClick={() => setOpen(null)}>{less}</button>}</p>;
  const cut = text.slice(0, LIMIT).replace(/[^.!?…]*$/, '') || text.slice(0, LIMIT);
  return <p>{cut.trim()}… <button className="link-btn" onClick={() => setOpen(id)}>{more}</button></p>;
}
