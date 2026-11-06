import { useEffect, useRef, useState } from 'react';
import type { Locale } from '@openmathtutor/shared';
import { chatMessages } from './messages';
import { CHIP_LABEL, type ChipId } from './replies';
import type { ChatMessage } from './chatStore';

export interface ChatProps {
  locale: Locale;
  thread: readonly ChatMessage[];
  chips: readonly ChipId[];
  /** The AI is working on an answer. */
  busy: boolean;
  /** The request has been running for a long time. */
  slow: boolean;
  large: boolean;
  micAvailable: boolean;
  listening: boolean;
  onChip(id: ChipId): void;
  onSend(text: string): void;
  onMic(): void;
  onCollapse(): void;
  onToggleSize(): void;
  onClear(): void;
  onCancel(): void;
}

const Svg = ({ children }: { children: React.ReactNode }) => <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">{children}</svg>;
export const ChatIcon = () => <Svg><path d="M4 5h16v11H9l-5 4z" /></Svg>;
const MicIcon = () => <Svg><rect x="9" y="3" width="6" height="11" rx="3" /><path d="M5 11a7 7 0 0 0 14 0M12 18v3" /></Svg>;

/** The conversation window: history, one-tap answers, and a message field that stays folded away until asked for. */
export function ChatPanel(p: ChatProps) {
  const c = chatMessages[p.locale];
  const [composing, setComposing] = useState(true);
  const [draft, setDraft] = useState('');
  const log = useRef<HTMLOListElement>(null);
  const input = useRef<HTMLInputElement>(null);
  useEffect(() => { const el = log.current; if (el) el.scrollTop = el.scrollHeight; }, [p.thread.length, p.busy]);
  useEffect(() => { if (composing) input.current?.focus(); }, [composing]);
  const send = (event: React.FormEvent) => {
    event.preventDefault();
    const text = draft.trim();
    if (!text) return;
    p.onSend(text); setDraft('');
  };
  return <section className={`chat${p.large ? ' chat-large' : ''}`} data-testid="chat" aria-label={c.chatTitle}>
    <header className="chat-head">
      <strong>{c.chatTitle}</strong>
      <span className="chat-tools">
        <button type="button" className="chat-tool" aria-label={p.large ? c.chatSmaller : c.chatBigger} title={p.large ? c.chatSmaller : c.chatBigger} onClick={p.onToggleSize}>{p.large ? '▾' : '▴'}</button>
        <button type="button" className="chat-tool" aria-label={c.chatClear} title={c.chatClear} disabled={!p.thread.length} onClick={p.onClear}>⌫</button>
        <button type="button" className="chat-tool" aria-label={c.chatClose} title={c.chatClose} onClick={p.onCollapse}>✕</button>
      </span>
    </header>
    <ol ref={log} className="chat-log" role="log" aria-live="polite" aria-label={c.chatLog} data-testid="chat-log">
      {!p.thread.length && <li className="chat-empty">{c.chatEmpty}</li>}
      {p.thread.map(m => <li key={m.id} className={`chat-msg chat-${m.role}`} data-role={m.role}>
        <span className="sr">{m.role === 'student' ? c.chatYou : c.chatTeacher}: </span>{m.text}
      </li>)}
    </ol>
    {p.busy && <div className="chat-typing" data-testid="chat-typing" role="status">
      <span className="think-dots" aria-hidden="true"><i /><i /><i /></span>
      <span>{p.slow ? c.stillThinking : c.thinkingStart}</span>
      <button type="button" className="link-btn" onClick={p.onCancel}>{c.cancelRequest}</button>
    </div>}
    {p.chips.length > 0 && <div className="chat-chips" role="group" aria-label={c.chatTitle}>
      {p.chips.map(id => <button key={id} type="button" className="chat-chip" data-chip={id} onClick={() => p.onChip(id)}>{c[CHIP_LABEL[id]]}</button>)}
    </div>}
    <div className="chat-compose">
      {composing
        ? <form className="chat-form" onSubmit={send}>
            <input ref={input} value={draft} maxLength={400} aria-label={c.composeLabel} placeholder={c.composePlaceholder} autoComplete="off"
              onChange={e => setDraft(e.target.value)} onKeyDown={e => { if (e.key === 'Escape') { e.stopPropagation(); setComposing(false); } }} />
            <button type="submit" className="primary" disabled={!draft.trim()}>{c.composeSend}</button>
          </form>
        : <button type="button" className="link-btn" onClick={() => setComposing(true)}>{c.composeOpen}</button>}
      {p.micAvailable && <button type="button" className={`chat-mic${p.listening ? ' primary' : ''}`} aria-pressed={p.listening}
        aria-label={p.listening ? c.micStop : c.micHold} title={p.listening ? c.micStop : c.micHold} onClick={p.onMic}><MicIcon /></button>}
    </div>
  </section>;
}
