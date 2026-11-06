import { isMastered, getTopicSkills, getTrackTopics, expectedAnswerFor, type CourseCatalog, type Locale } from '@openmathtutor/shared';
import { computeLineVerdicts, effectiveStatement, writtenLines } from './lines';
import type { BoardState } from './boardState';
import type { MasteryMap } from './curriculumStorage';
import type { MessageKey } from './i18n';

type T = Record<MessageKey, string>;

export interface SkillLine { skillId: string; title: string; track: string; attempts: number }
export interface Strengths { strong: SkillLine[]; weak: SkillLine[]; practising: SkillLine[] }

/** Splits practised skills by mastery data only; a skill with no attempts is not judged. */
export function summarizeStrengths(catalog: CourseCatalog, mastery: MasteryMap, locale: Locale): Strengths {
  const result: Strengths = { strong: [], weak: [], practising: [] };
  const seen = new Set<string>();
  for (const track of catalog.tracks) {
    for (const topic of getTrackTopics(catalog, track.id)) {
      for (const skill of getTopicSkills(catalog, topic.id)) {
        const state = mastery[skill.id];
        if (!state || state.attempts === 0 || seen.has(skill.id)) continue;
        seen.add(skill.id);
        const line = { skillId: skill.id, title: skill.title[locale], track: track.title[locale], attempts: state.attempts };
        if (isMastered(state)) result.strong.push(line);
        else if (state.incorrectStreak > 0 && state.correctStreak === 0) result.weak.push(line);
        else result.practising.push(line);
      }
    }
  }
  return result;
}

/** Prompt asking the tutor for a personal study text; the answer is shown as unverified AI text. */
export function studyTextRequest(strengths: Strengths, locale: Locale): string {
  const list = (lines: SkillLine[]) => lines.map(l => l.title).join('; ');
  const focus = strengths.weak.length ? strengths.weak : strengths.practising;
  if (locale === 'cs') {
    return `Napiš mi krátký studijní text (do 350 slov) přesně pro mě. Potřebuju zapracovat na: ${list(focus) || 'základech, které jsem zatím nezačal(a)'}. `
      + `Už mi jde: ${list(strengths.strong) || 'zatím nic zvládnutého'}. Vysvětli princip, ukaž jeden vzorový příklad a dej 3 otázky na ověření.`;
  }
  return `Write me a short study text (under 350 words) made for me. I need to work on: ${list(focus) || 'the basics I have not started yet'}. `
    + `I already manage: ${list(strengths.strong) || 'nothing mastered yet'}. Explain the idea, show one worked example and give 3 check questions.`;
}

const escapeHtml = (s: string) => s.replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]!));

function boardSection(board: BoardState, index: number, t: T) {
  const lines = writtenLines(board.steps);
  const task = effectiveStatement(board.statement, lines);
  const verdicts = computeLineVerdicts(task, lines, board.expected ?? expectedAnswerFor(task));
  const steps = lines.map((l, i) => {
    const v = verdicts[l.stepId]?.status;
    return { text: l.latexGuess, mark: v === 'ok' ? '✓' : v === 'wrong' ? '✗' : '', n: i + 1 };
  });
  return { index, title: task || t.emptyExercise, topic: board.topic.trim(), steps,
    notes: board.history.map(h => ({ status: t[h.status], text: h.text })) };
}
export function buildNotesMarkdown(boards: readonly BoardState[], t: T, strengths?: Strengths): string {
  const out = [`# ${t.notesTitle}`, ''];
  boards.filter(b => b.statement.trim() || b.steps.length || b.history.length).forEach((board, i) => {
    const s = boardSection(board, i + 1, t);
    out.push(`## ${s.index}. ${s.title}`, '');
    if (s.topic) out.push(`*${s.topic}*`, '');
    if (s.steps.length) { out.push(`**${t.steps}**`, ''); s.steps.forEach(st => out.push(`${st.n}. \`${st.text.replace(/`/g, "'")}\` ${st.mark}`.trimEnd())); out.push(''); }
    if (s.notes.length) { out.push(`**${t.history}**`, ''); s.notes.forEach(n => out.push(`- **${n.status}:** ${n.text.replace(/\n+/g, ' ')}`)); out.push(''); }
  });
  if (strengths && (strengths.strong.length || strengths.weak.length)) {
    out.push(`## ${t.progressTitle}`, '');
    if (strengths.strong.length) out.push(`**${t.strong}:** ${strengths.strong.map(l => l.title).join(', ')}`, '');
    if (strengths.weak.length) out.push(`**${t.weak}:** ${strengths.weak.map(l => l.title).join(', ')}`, '');
  }
  out.push(`---`, `*${t.unverified}*`);
  return out.join('\n');
}

export function buildNotesHtml(boards: readonly BoardState[], t: T, strengths?: Strengths): string {
  const body = boards.filter(b => b.statement.trim() || b.steps.length || b.history.length).map((board, i) => {
    const s = boardSection(board, i + 1, t);
    return `<section><h2>${s.index}. ${escapeHtml(s.title)}</h2>${s.topic ? `<p><em>${escapeHtml(s.topic)}</em></p>` : ''}`
      + (s.steps.length ? `<h3>${escapeHtml(t.steps)}</h3><ol>${s.steps.map(st => `<li><code>${escapeHtml(st.text)}</code> ${st.mark}</li>`).join('')}</ol>` : '')
      + (s.notes.length ? `<h3>${escapeHtml(t.history)}</h3><ul>${s.notes.map(n => `<li><strong>${escapeHtml(n.status)}:</strong> ${escapeHtml(n.text)}</li>`).join('')}</ul>` : '')
      + '</section>';
  }).join('');
  const progress = strengths && (strengths.strong.length || strengths.weak.length)
    ? `<section><h2>${escapeHtml(t.progressTitle)}</h2>`
      + (strengths.strong.length ? `<p><strong>${escapeHtml(t.strong)}:</strong> ${escapeHtml(strengths.strong.map(l => l.title).join(', '))}</p>` : '')
      + (strengths.weak.length ? `<p><strong>${escapeHtml(t.weak)}:</strong> ${escapeHtml(strengths.weak.map(l => l.title).join(', '))}</p>` : '') + '</section>' : '';
  return `<!doctype html><html><head><meta charset="utf-8"><title>${escapeHtml(t.notesTitle)}</title>`
    + `<style>body{font:15px/1.55 system-ui,sans-serif;max-width:720px;margin:32px auto;padding:0 16px;color:#202f30}h1{font-size:24px}h2{font-size:18px;margin-top:28px}`
    + `code{background:#f1f3ef;padding:1px 5px;border-radius:4px}section{break-inside:avoid}small{color:#526464}</style></head>`
    + `<body><h1>${escapeHtml(t.notesTitle)}</h1>${body}${progress}<p><small>${escapeHtml(t.unverified)}</small></p></body></html>`;
}

let lastDownload = { name: '', at: 0 };
export function downloadBlob(blob: Blob, name: string) {
  // One click is one file: ignore a repeat of the same download within a second.
  const now = Date.now();
  if (lastDownload.name === name && now - lastDownload.at < 1000) return;
  lastDownload = { name, at: now };
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url; link.download = name; link.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export function printHtml(html: string) {
  const frame = document.createElement('iframe');
  frame.style.cssText = 'position:fixed;width:0;height:0;border:0;';
  frame.srcdoc = html;
  frame.onload = () => { frame.contentWindow?.print(); setTimeout(() => frame.remove(), 2000); };
  document.body.appendChild(frame);
}
