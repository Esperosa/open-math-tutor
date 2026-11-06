import { Icon } from './Hud';
import { useRef, useState } from 'react';
import type { MessageKey } from './i18n';
import { extractText, TextExtractError } from './textExtract';
import type { CustomSource } from './customSources';

interface Props {
  t: Record<MessageKey, string>;
  sources: CustomSource[];
  onAdd: (title: string, text: string) => void;
  onRemove: (id: string) => void;
}

export function CustomSourcesPanel({ t, sources, onAdd, onRemove }: Props) {
  const input = useRef<HTMLInputElement>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function handleFile(file: File) {
    setError(null); setBusy(true);
    try {
      const text = await extractText(file);
      onAdd(file.name, text);
    } catch (e) {
      setError(e instanceof TextExtractError ? t.sourceEmpty : t.sourceExtractFailed);
    } finally {
      setBusy(false);
    }
  }

  return <section className="custom-sources">
    <h2>{t.customSources}</h2>
    <p className="muted">{t.customSourcesHelp}</p>
    <label className="upload-board" data-hint="PDF · TXT">
      <Icon name="materials" /><span className="upload-title">{busy ? t.sourceProcessing : t.addSource}</span>
      <input ref={input} type="file" accept=".txt,.pdf,text/plain,application/pdf" disabled={busy}
        onChange={e => {
          const file = e.target.files?.[0];
          if (file) void handleFile(file);
          if (input.current) input.current.value = '';
        }} />
    </label>
    {error && <p role="alert" className="warning">{error}</p>}
    {sources.length > 0 && <ul className="sources-list">
      {sources.map(source => <li key={source.id} data-testid="source-item">
        <span>{source.title}</span>
        <button onClick={() => onRemove(source.id)}>{t.removeSource}</button>
      </li>)}
    </ul>}
  </section>;
}
