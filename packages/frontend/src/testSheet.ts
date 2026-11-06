import { answerKeyText, type GeneratedTest, type Locale } from '@openmathtutor/shared';
import type { MessageKey } from './i18n';

const escapeHtml = (s: string) => s.replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]!));

/** A printable test (task pages with working space, answer key on its own last page). Print it, or save it as PDF from the print dialog. */
export function buildTestHtml(test: GeneratedTest, title: string, t: Record<MessageKey, string>, locale: Locale): string {
  const tasks = test.items.map(item => `<section class="task${item.drawing ? ' draw' : ''}"><h3>${item.n}. <small>${escapeHtml(item.skillTitle)}</small></h3>`
    + `<p>${escapeHtml(item.statement)}</p><div class="space"></div></section>`).join('');
  const key = test.items.map(item => `<li><strong>${item.n}.</strong> ${escapeHtml(answerKeyText(item, locale))}</li>`).join('');
  return `<!doctype html><html lang="${locale}"><head><meta charset="utf-8"><title>${escapeHtml(title)}</title><style>
@page{size:A4;margin:18mm}body{font:14px/1.5 system-ui,sans-serif;color:#202f30}h1{font-size:22px;margin:0 0 4px}h3{font-size:15px;margin:0 0 6px}small{color:#526464;font-weight:400}
.head{display:flex;gap:24px;margin:10px 0 18px;font-size:13px}.head span{flex:1;border-bottom:1px solid #202f30;padding-bottom:14px}
.task{break-inside:avoid;margin-bottom:10px;border-bottom:1px dashed #c9d2d0}.space{height:150px}.task.draw .space{height:240px;border:1px solid #c9d2d0;border-radius:6px}
.key{break-before:page}.key li{margin:4px 0}</style></head><body>
<h1>${escapeHtml(title)}</h1><div class="head"><span>${escapeHtml(t.testSheetName)}:</span><span>${escapeHtml(t.testSheetDate)}:</span><span>${escapeHtml(t.testPoints)}: &nbsp;/ ${test.items.length}</span></div>
${tasks}<section class="key"><h1>${escapeHtml(t.testAnswers)}</h1><ol style="list-style:none;padding:0">${key}</ol></section></body></html>`;
}
