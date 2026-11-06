import { useState } from 'react';
import type { MessageKey } from './i18n';

interface Props {
  t: Record<MessageKey, string>;
  disabled: boolean;
  onAsk: (message: string) => void;
}

export function AskPanel({ t, disabled, onAsk }: Props) {
  const [message, setMessage] = useState('');
  return <form className="ask-panel" onSubmit={e => {
    e.preventDefault();
    const trimmed = message.trim();
    if (!trimmed) return;
    onAsk(trimmed);
    setMessage('');
  }}>
    <label>{t.askLabel}
      <textarea rows={2} maxLength={2000} value={message} placeholder={t.askPlaceholder}
        onChange={e => setMessage(e.target.value)} />
    </label>
    <button type="submit" disabled={disabled || !message.trim()}>{t.askSend}</button>
  </form>;
}
