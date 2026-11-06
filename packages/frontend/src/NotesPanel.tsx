import type { MessageKey } from './i18n';
import type { Strengths } from './notes';

interface Props {
  t: Record<MessageKey, string>;
  strengths: Strengths;
  canAsk: boolean;
  onExportImage(kind: 'png' | 'svg'): void;
  onExportMarkdown(): void;
  onPrint(): void;
  onStudyText(): void;
}

function SkillList({ title, lines }: { title: string; lines: { skillId: string; title: string; track: string }[] }) {
  if (!lines.length) return null;
  return <div><h3 className="h3-small">{title}</h3>
    <ul className="progress-list">{lines.map(l => <li key={l.skillId}>{l.title}<small> · {l.track}</small></li>)}</ul></div>;
}

export function NotesPanel({ t, strengths, canAsk, onExportImage, onExportMarkdown, onPrint, onStudyText }: Props) {
  const nothing = !strengths.strong.length && !strengths.weak.length && !strengths.practising.length;
  return <div className="notes-panel">
    <h2>{t.progressTitle}</h2>
    {nothing && <p className="muted">{t.progressEmpty}</p>}
    <SkillList title={t.weak} lines={strengths.weak} />
    <SkillList title={t.practising} lines={strengths.practising} />
    <SkillList title={t.strong} lines={strengths.strong} />
    <button className="primary" disabled={!canAsk} onClick={onStudyText}>{t.studyTextButton}</button>
    <p className="muted">{t.studyTextHelp}</p>
    <h2>{t.notesTitle}</h2>
    <div className="row">
      <button onClick={onExportMarkdown}>{t.exportMarkdown}</button>
      <button onClick={onPrint}>{t.exportPdf}</button>
    </div>
    <div className="row">
      <button onClick={() => onExportImage('png')}>{t.exportPng}</button>
      <button onClick={() => onExportImage('svg')}>{t.exportSvg}</button>
    </div>
  </div>;
}
