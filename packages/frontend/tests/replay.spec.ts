import { expect, test, type Page } from '@playwright/test';
import type { AnalyzeBoardRequest, AnalyzeBoardResponse, ContinueLessonRequest } from '@openmathtutor/shared';

// DETERMINISTIC REPLAY using test-only HTTP mocks. This is NOT a real-inference/provider/verifier test.
async function mockBridge(page: Page, requests: AnalyzeBoardRequest[], manuals: ContinueLessonRequest[]) {
  await page.route('http://127.0.0.1:4178/**', async route => {
    const request = route.request(), url = new URL(request.url());
    const headers = { 'Access-Control-Allow-Origin': 'http://localhost:5173',
      'Access-Control-Allow-Headers': 'content-type', 'Access-Control-Allow-Methods': 'GET, POST, OPTIONS' };
    if (request.method() === 'OPTIONS') { await route.fulfill({ status: 204, headers }); return; }
    if (url.pathname === '/health') { await route.fulfill({ json: { status: 'ok', verifier: 'ok' }, headers }); return; }
    if (url.pathname === '/providers') {
      await route.fulfill({ json: { providers: [{ id: 'codex', detect: { installed: true }, authStatus: { providerId: 'codex', authenticated: true, tutoringAvailable: true },
        models: [{ id: 'replay-model', label: 'Replay model (test only)', supportsImageInput: true }] }] }, headers }); return;
    }
    if (url.pathname.endsWith('/cancel')) { await route.fulfill({ status: 204, headers }); return; }
    const body = request.postDataJSON() as AnalyzeBoardRequest & ContinueLessonRequest;
    if (url.pathname.endsWith('/analyze-board')) requests.push(body); else manuals.push(body);
    const fixed = body.stepHistory.some(s => s.latexGuess.includes('x = 2'));
    const firstId = body.stepHistory[0]?.stepId;
    const response: AnalyzeBoardResponse = { requestId: body.requestId, boardRevision: body.boardRevision,
      recognizedSteps: body.stepHistory, confidence: 0.99, firstErrorStepId: fixed ? null : firstId,
      verifierStatus: fixed ? 'correct' : 'incorrect', pedagogicalResponse: fixed ? 'Teď je postup správný.' : 'První chyba: odečti 3 od obou stran.',
      ttsText: fixed ? 'Správně.' : 'Odečti tři od obou stran.', needsClarification: null,
      boardActions: fixed ? [] : [
        { id: 'underline-first', type: 'underline', targetStepId: firstId, boardRevision: body.boardRevision },
        { id: 'math-hint', type: 'write_math', latex: '2x = 7-3', anchor: { x: 250, y: 240 }, boardRevision: body.boardRevision },
        { id: 'text-hint', type: 'show_hint', text: '−3', anchor: { x: 560, y: 120 }, boardRevision: body.boardRevision },
        { id: 'arrow', type: 'draw_arrow', from: { x: 450, y: 150 }, to: { x: 500, y: 240 }, boardRevision: body.boardRevision },
      ] };
    await route.fulfill({ json: response, headers });
  });
}
// Tests never talk to a real bridge, even on a machine that has one running; mocks registered later take precedence.
test.beforeEach(async ({ page }) => { await page.route('http://127.0.0.1:4178/**', route => route.abort('connectionrefused')); });
async function skipOnboarding(page: Page) {
  await page.getByRole('button', { name: 'Přeskočit, chci jen volnou tabuli', exact: true }).click();
}
async function openSettings(page: Page) {
  const button = page.getByRole('button', { name: 'Nastavení', exact: true });
  if ((await button.getAttribute('aria-expanded')) !== 'true') await button.click();
}
async function openPanel(page: Page, name: string) {
  const button = page.getByRole('button', { name, exact: true });
  if ((await button.getAttribute('aria-pressed')) !== 'true') await button.click();
}
async function openTutorMenu(page: Page) {
  const button = page.getByRole('button', { name: 'Učitel', exact: true });
  if ((await button.getAttribute('aria-expanded')) !== 'true') await button.click();
}
async function selectProvider(page: Page) {
  await openSettings(page);
  await page.getByRole('combobox', { name: 'Poskytovatel', exact: true }).selectOption('codex');
  await page.getByRole('combobox', { name: 'Model', exact: true }).selectOption('replay-model');
}
/** The board is the only input: click where the line goes, type, press Escape to finish the line. */
async function writeOnBoard(page: Page, text: string, row: number) {
  const canvas = page.locator('.excalidraw__canvas.interactive');
  const rect = await canvas.boundingBox(); if (!rect) throw new Error('Canvas missing');
  await page.mouse.click(rect.x + 560, rect.y + 270 + row * 90);
  await expect(page.locator('textarea.excalidraw-wysiwyg')).toBeFocused();
  await page.keyboard.type(text);
  await page.keyboard.press('Escape');
}
async function setTask(page: Page, text: string) {
  await page.getByRole('button', { name: 'Upravit zadání' }).click();
  await page.getByRole('textbox', { name: 'Zadání', exact: true }).fill(text);
  await page.getByRole('button', { name: 'Hotovo', exact: true }).click();
}
const bubble = (page: Page) => page.getByTestId('tutor-bubble');

test('deterministic replay: stroke → settled crop → first error annotations → correction → success', async ({ page }) => {
  const requests: AnalyzeBoardRequest[] = [], manuals: ContinueLessonRequest[] = [];
  const exceptions: string[] = []; page.on('pageerror', e => exceptions.push(e.message));
  await mockBridge(page, requests, manuals);
  await page.goto('/');
  await skipOnboarding(page);
  await selectProvider(page);
  await page.getByLabel(/AI smí sama zkontrolovat/).check();
  await writeOnBoard(page, '2x + 3 = 7', 0);
  // A real pointer stroke on the real Excalidraw canvas, not an application test hook.
  const canvas = page.locator('.excalidraw__canvas.interactive');
  await expect(canvas).toBeVisible();
  await page.keyboard.press('p');
  const rect = await canvas.boundingBox(); if (!rect) throw new Error('Canvas missing');
  await page.mouse.move(rect.x + 600, rect.y + 272);
  await page.mouse.down();
  await page.mouse.move(rect.x + 625, rect.y + 275, { steps: 5 });
  await page.mouse.up();
  await expect.poll(() => requests.length, { timeout: 12000 }).toBe(1);
  expect(requests[0].imageCrop.dataUrl).toMatch(/^data:image\/png;base64,/);
  expect(requests[0].imageCrop.width).toBeLessThanOrEqual(1024);
  await expect(page.getByTestId('annotation-item')).toHaveCount(4);
  await expect(page.getByTestId('math-annotation')).toContainText('2x');
  await expect(page.getByTestId('math-annotation')).toBeVisible();
  await expect(page.getByTestId('math-annotation')).toHaveCSS('opacity', '1');
  await expect(page.getByTestId('explanation')).toContainText('První chyba');
  await expect(bubble(page)).toContainText('První chyba');
  await page.screenshot({ path: 'test-results/replay-annotated.png', fullPage: true });
  await openSettings(page);
  await page.getByLabel('Zobrazit poznámky AI').uncheck();
  await expect(page.getByTestId('math-annotation')).toHaveCount(0);
  await page.getByLabel('Zobrazit poznámky AI').check();
  await expect(page.getByTestId('math-annotation')).toHaveCount(1);
  // A corrected line written on the board settles, is analysed again and the old annotations disappear.
  await page.getByTitle(/^Text — T/).click();
  await writeOnBoard(page, 'x = 2', 2);
  await expect.poll(() => requests.length, { timeout: 12000 }).toBe(2);
  expect(requests[1].boardRevision).toBeGreaterThan(requests[0].boardRevision);
  expect(requests[1].stepHistory[0].stepId).toBe(requests[0].stepHistory[0].stepId);
  await expect(page.getByTestId('annotation-item')).toHaveCount(0);
  await expect(page.getByTestId('explanation')).toHaveCount(2);
  await expect(page.getByTestId('explanation').last()).toContainText('Teď je postup správný');
  for (const [name, mode] of [['Zkontrolovat', 'check'], ['Poradit', 'hint'], ['Ukaž další krok', 'next_step'], ['Vysvětli jinak', 'explain_differently']] as const) {
    await openTutorMenu(page);
    await page.getByRole('menuitem', { name, exact: true }).click();
    await expect.poll(() => manuals.at(-1)?.mode).toBe(mode);
    await expect(page.getByTestId('tutor-bubble')).not.toHaveAttribute('data-kind', 'thinking');
  }
  expect(manuals.every(m => typeof m.learnerContext === 'string' && m.learnerContext.length > 0)).toBe(true);
  await page.screenshot({ path: 'test-results/replay-corrected.png', fullPage: true });
  expect(exceptions).toEqual([]);
});

test('test-only delayed bridge replay: Stop aborts in-flight work and calls the cancel endpoint', async ({ page }) => {
  const requests: AnalyzeBoardRequest[] = [], manuals: ContinueLessonRequest[] = [];
  await mockBridge(page, requests, manuals);
  let release!: () => void;
  const gate = new Promise<void>(resolve => { release = resolve; });
  let started = false;
  await page.route('**/providers/codex/continue-lesson', async route => {
    started = true;
    await gate;
    await route.abort().catch(() => {});
  });
  const cancels: string[] = [];
  page.on('request', request => { if (request.url().endsWith('/cancel')) cancels.push(request.postDataJSON().requestId); });
  await page.goto('/');
  await skipOnboarding(page);
  await selectProvider(page);
  await openTutorMenu(page);
  await page.getByRole('menuitem', { name: 'Zkontrolovat', exact: true }).click();
  await expect.poll(() => started).toBe(true);
  await openTutorMenu(page);
  await page.getByRole('menuitem', { name: 'Zastavit', exact: true }).click();
  await expect.poll(() => cancels.length).toBe(1);
  await expect(bubble(page)).toContainText('Kontrola zastavena.');
  release();
  await expect(page.getByTestId('annotation-item')).toHaveCount(0);
  await expect(page.getByTestId('explanation')).toHaveCount(0);
});

test('curriculum mode: picking a skill starts a lesson and a correct check advances mastery', async ({ page }) => {
  const requests: AnalyzeBoardRequest[] = [], manuals: ContinueLessonRequest[] = [];
  await mockBridge(page, requests, manuals);
  await page.route('**/providers/codex/continue-lesson', async route => {
    const request = route.request();
    const headers = { 'Access-Control-Allow-Origin': 'http://localhost:5173',
      'Access-Control-Allow-Headers': 'content-type', 'Access-Control-Allow-Methods': 'GET, POST, OPTIONS' };
    if (request.method() === 'OPTIONS') { await route.fulfill({ status: 204, headers }); return; }
    const body = request.postDataJSON() as ContinueLessonRequest;
    manuals.push(body);
    const correct = body.mode === 'check';
    const response: AnalyzeBoardResponse = { requestId: body.requestId, boardRevision: body.boardRevision,
      recognizedSteps: body.stepHistory, confidence: 0.99, firstErrorStepId: null,
      verifierStatus: correct ? 'correct' : 'needs_domain_check',
      pedagogicalResponse: correct ? 'Výborně, máš to správně.' : 'Pojďme na tuhle dovednost: nejdřív si zopakujeme záporná čísla.',
      ttsText: 'ok', needsClarification: null, boardActions: [] };
    await route.fulfill({ json: response, headers });
  });
  await page.goto('/');
  await skipOnboarding(page);
  await selectProvider(page);
  await openPanel(page, 'Kurzy');
  await page.getByRole('combobox', { name: 'Kurz', exact: true }).selectOption({ label: 'Přijímačky na střední školu' });
  await page.getByRole('combobox', { name: 'Téma kurzu', exact: true }).selectOption({ label: 'Základy čísel' });
  const skillItem = page.getByTestId('skill-item').filter({ hasText: 'Počítání se zápornými čísly' });
  await expect(skillItem.getByText('Nezačato')).toBeVisible();
  await skillItem.getByRole('button').click();
  await page.keyboard.press('Escape');
  await expect(bubble(page)).toContainText('Pojďme na');
  expect(manuals).toHaveLength(0);
  await expect(page.getByTestId('task-text')).not.toHaveText('');
  await openTutorMenu(page);
  await page.getByRole('menuitem', { name: 'Zkontrolovat', exact: true }).click();
  await expect.poll(() => manuals.at(-1)?.mode).toBe('check');
  await openPanel(page, 'Kurzy');
  await expect(skillItem.getByText('Rozpracováno')).toBeVisible();
});

test('real unavailable-bridge state remains usable, persistent, bilingual and responsive', async ({ page }) => {
  // Genuinely exercise connection refusal, even on a machine that has a real bridge running.
  await page.route('http://127.0.0.1:4178/**', route => route.abort('connectionrefused'));
  await page.goto('/');
  await skipOnboarding(page);
  await expect(page.getByText(/Lokální bridge není dostupný/).first()).toBeVisible();
  await setTask(page, 'x + 1 = 3');
  await writeOnBoard(page, 'x = 2', 0);
  await page.waitForTimeout(600);
  await page.reload();
  await expect(page.getByTestId('task-text')).toHaveText('x + 1 = 3');
  await openSettings(page);
  await page.getByRole('button', { name: 'Tmavý režim' }).click();
  await page.getByRole('combobox', { name: 'Jazyk', exact: true }).selectOption('en');
  await page.getByRole('button', { name: 'Teacher', exact: true }).click();
  await expect(page.getByRole('menuitem', { name: 'Check', exact: true })).toBeDisabled();
  await page.setViewportSize({ width: 390, height: 844 });
  await page.screenshot({ path: 'test-results/unavailable-dark-mobile.png', fullPage: true });
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
});

test('canvas controls: pressing and holding on empty board opens a menu, a short click does not', async ({ page }) => {
  await page.goto('/');
  await skipOnboarding(page);
  const canvas = page.locator('.excalidraw__canvas.interactive');
  await expect(canvas).toBeVisible();
  const rect = await canvas.boundingBox(); if (!rect) throw new Error('Canvas missing');
  await page.mouse.click(rect.x + 600, rect.y + 450);
  await page.keyboard.press('Escape');
  await page.waitForTimeout(700);
  await expect(page.getByRole('menu', { name: 'Nabídka tabule' })).toHaveCount(0);
  await page.mouse.move(rect.x + 600, rect.y + 450);
  await page.mouse.down();
  await page.waitForTimeout(700);
  await page.mouse.up();
  await expect(page.getByRole('menu', { name: 'Nabídka tabule' })).toBeVisible();
  await page.getByRole('menuitem', { name: 'Zeptat se na tohle' }).click();
  await expect(page.getByRole('menu', { name: 'Nabídka tabule' })).toHaveCount(0);
  await expect(page.getByRole('textbox', { name: 'Zeptej se na cokoli' })).toBeVisible();
});

test('canvas controls: arrow keys pan the board when nothing is selected', async ({ page }) => {
  await page.goto('/');
  await skipOnboarding(page);
  await writeOnBoard(page, '2x + 3 = 7', 0);
  const canvas = page.locator('.excalidraw__canvas.interactive');
  const rect = await canvas.boundingBox(); if (!rect) throw new Error('Canvas missing');
  const clip = { x: rect.x + 100, y: rect.y + 100, width: 700, height: 300 };
  const before = await page.screenshot({ clip });
  await page.keyboard.press('ArrowRight');
  await page.keyboard.press('ArrowDown');
  await page.waitForTimeout(200);
  const after = await page.screenshot({ clip });
  expect(Buffer.compare(before, after)).not.toBe(0);
});

test('coach: a wrong line is flagged and explanation is offered without pressing any button', async ({ page }) => {
  await page.goto('/');
  await skipOnboarding(page);
  await setTask(page, '5+1');
  await writeOnBoard(page, '5+1=6', 0);
  await expect(page.getByTestId('step-mark-ok')).toBeVisible();
  await expect(bubble(page)).toHaveAttribute('data-kind', 'solved');
  await page.getByRole('button', { name: 'Zkusím sám' }).click();
  await writeOnBoard(page, '5+1=8', 1);
  await expect(page.getByTestId('step-mark-wrong')).toBeVisible();
  await expect(bubble(page)).toHaveAttribute('data-kind', 'wrong');
  await expect(page.getByTestId('tutor')).toHaveAttribute('data-mood', 'concerned');
  await page.getByRole('button', { name: 'Zkusím sám' }).click();
  await expect(bubble(page)).toHaveCount(0);
});

test('coach modes: "at the end" waits for a result, "off" stays silent', async ({ page }) => {
  await page.goto('/');
  await skipOnboarding(page);
  await setTask(page, '2x+3=7');
  await openTutorMenu(page);
  await page.getByRole('radio', { name: 'Až na konec' }).click();
  await page.keyboard.press('Escape');
  await writeOnBoard(page, '2x = 5', 0);
  await page.waitForTimeout(3200);
  await expect(bubble(page)).toHaveCount(0);
  await writeOnBoard(page, 'x = 2', 1);
  await expect(bubble(page)).toHaveAttribute('data-kind', 'wrong', { timeout: 8000 });
  await page.getByRole('button', { name: 'Zkusím sám' }).click();
  await openTutorMenu(page);
  await page.getByRole('radio', { name: 'Vypnuto' }).click();
  await page.keyboard.press('Escape');
  await writeOnBoard(page, 'x = 9', 2);
  await page.waitForTimeout(2500);
  await expect(bubble(page)).toHaveCount(0);
});

test('course search: Ctrl+K finds a specific skill by what the student calls it and starts it', async ({ page }) => {
  await page.goto('/');
  await skipOnboarding(page);
  await page.keyboard.press('Control+k');
  const search = page.getByRole('searchbox', { name: 'Hledat v kurzech' });
  await expect(search).toBeFocused();
  await search.fill('diskriminant');
  await page.getByRole('button', { name: /Kvadratické rovnice/ }).first().click();
  await expect(page.getByTestId('task-text')).toContainText('x^2');
  await page.keyboard.press('Control+k');
  await search.fill('zzzz nic takového');
  await expect(page.getByText('Nic nenalezeno.')).toBeVisible();
  await expect(page.getByRole('button', { name: /Zeptat se AI/ })).toBeVisible();
});

test('calculator: evaluates safely, writes to the board, and is hidden where the exam forbids it', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('button', { name: /Chystám se na střední školu/ }).click();
  await page.getByRole('button', { name: /^Přijímačky na střední školu/ }).click();
  await expect(page.getByRole('button', { name: 'Kalkulačka', exact: true })).toHaveCount(0);
  await page.getByRole('button', { name: 'Změnit kurz' }).click();
  await page.getByRole('button', { name: /středoškolák nebo maturant/ }).click();
  await page.getByRole('button', { name: /^Maturita z matematiky/ }).click();
  await page.getByRole('button', { name: 'Kalkulačka', exact: true }).click();
  const display = page.getByRole('textbox', { name: 'Kalkulačka' });
  await display.fill('2+3*4');
  await display.press('Enter');
  await expect(display).toHaveValue('14');
  await page.getByRole('button', { name: '√' }).click();
  await expect(display).toHaveValue('3,741657387');
  await display.fill('1/0');
  await display.press('Enter');
  await expect(page.getByRole('alert').filter({ hasText: 'Chyba ve výrazu' })).toBeVisible();
  await display.fill('7*6');
  await page.getByRole('button', { name: 'Do řádku' }).click();
  await expect(page.getByTestId('revision')).not.toHaveText('0');
});

test('notes: progress panel, markdown and image export carry the student work', async ({ page }) => {
  await page.goto('/');
  await skipOnboarding(page);
  await setTask(page, '2x+3=7');
  await writeOnBoard(page, '2x=4', 0);
  await expect(page.getByTestId('step-mark-ok')).toBeVisible();
  await openPanel(page, 'Zápisky a pokrok');
  await expect(page.getByText('Zatím není z čeho hodnotit')).toBeVisible();
  const md = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Stáhnout zápisky (.md)' }).click();
  const mdFile = await md;
  expect(mdFile.suggestedFilename()).toBe('zapisky.md');
  const stream = await mdFile.createReadStream();
  let text = ''; for await (const chunk of stream) text += chunk;
  expect(text).toContain('2x+3=7');
  expect(text).toContain('`2x=4` ✓');
  const png = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Tabule jako PNG' }).click();
  expect((await png).suggestedFilename()).toBe('tabule.png');
});

test('progressive tooltip: short label right away, longer explanation if the pointer stays', async ({ page }) => {
  await page.goto('/');
  await skipOnboarding(page);
  await openPanel(page, 'Kurzy');
  await page.getByRole('button', { name: 'Zápisky a pokrok' }).hover();
  const tip = page.getByRole('tooltip');
  await expect(tip).toContainText('Zápisky a pokrok');
  await expect(tip).not.toContainText('export zápisků');
  await expect(tip).toContainText('export zápisků', { timeout: 3000 });
});

test('physics lesson: the numeric answer is checked without any AI call', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('button', { name: /fyziku nebo chemii/ }).click();
  await page.getByRole('button', { name: /^Fyzika/ }).click();
  const task = page.getByTestId('task-text');
  await expect(task).toContainText('Auto ujede');
  const match = /ujede (\d+) m za (\d+) s/.exec((await task.textContent()) ?? '');
  const a = Number(match![1]), b = Number(match![2]);
  await writeOnBoard(page, `v = ${a} / ${b} = ${Math.round((a / b + 7) * 100) / 100} m/s`, 0);
  await expect(bubble(page)).toHaveAttribute('data-kind', 'wrong', { timeout: 8000 });
  await page.getByRole('button', { name: 'Zkusím sám' }).click();
  await writeOnBoard(page, `v = ${a} / ${b} = ${Math.round(a / b * 1000) / 1000} m/s`, 1);
  await expect(bubble(page)).toHaveAttribute('data-kind', 'solved', { timeout: 8000 });
  await expect(page.getByRole('button', { name: 'Další příklad' })).toBeVisible();
});

test('plan: solving a problem moves the percentage, and a printable test with an answer key is built from the course', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('button', { name: /Chystám se na střední školu/ }).click();
  await page.getByRole('button', { name: /^Přijímačky na střední školu/ }).click();
  const task = ((await page.getByTestId('task-text').textContent()) ?? '').trim();
  const match = /^(-?\d+)([+-])(\d+)$/.exec(task);
  expect(match, `unexpected first task: ${task}`).not.toBeNull();
  const sum = match![2] === '+' ? Number(match![1]) + Number(match![3]) : Number(match![1]) - Number(match![3]);
  await openPanel(page, 'Plán a cesta');
  await expect(page.getByTestId('plan-percent')).toHaveText('0 %');
  await page.keyboard.press('Escape');
  await writeOnBoard(page, `${task} = ${sum}`, 0);
  await expect(bubble(page)).toHaveAttribute('data-kind', 'solved', { timeout: 8000 });
  await openPanel(page, 'Plán a cesta');
  await expect(page.getByTestId('plan-percent')).not.toHaveText('0 %');
  await expect(page.getByTestId('track-breadcrumb')).not.toContainText('0 %');
  const download = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Stáhnout test (HTML)' }).click();
  const file = await download;
  expect(file.suggestedFilename()).toBe('test.html');
  const stream = await file.createReadStream();
  let html = ''; for await (const chunk of stream) html += chunk;
  expect(html).toContain('Klíč správných odpovědí');
  expect(html).toContain('Počítání se zápornými čísly');
});

test('popovers: settings, calculator and the teacher menu never stack, Escape closes them all', async ({ page }) => {
  await page.goto('/');
  await skipOnboarding(page);
  await page.getByRole('button', { name: 'Nastavení', exact: true }).click();
  await expect(page.locator('.settings-pop')).toHaveClass(/open/);
  await page.getByRole('button', { name: 'Kalkulačka', exact: true }).click();
  await expect(page.locator('.settings-pop')).not.toHaveClass(/open/);
  await expect(page.getByRole('dialog', { name: 'Kalkulačka' })).toBeVisible();
  await page.getByRole('button', { name: 'Učitel', exact: true }).click();
  await expect(page.getByRole('dialog', { name: 'Kalkulačka' })).toHaveCount(0);
  await expect(page.getByRole('menu', { name: 'Učitel' })).toBeVisible();
  await page.getByRole('button', { name: 'Kalkulačka', exact: true }).click();
  await expect(page.getByRole('menu', { name: 'Učitel' })).toHaveCount(0);
  await page.getByRole('button', { name: 'Učitel', exact: true }).click();
  await page.keyboard.press('Escape');
  await expect(page.getByRole('dialog', { name: 'Kalkulačka' })).toHaveCount(0);
  await expect(page.getByRole('menu', { name: 'Učitel' })).toHaveCount(0);
});

test('lesson started from the course drawer adopts its course: breadcrumb, plan and percentage work', async ({ page }) => {
  await page.goto('/');
  await skipOnboarding(page);
  await expect(page.getByTestId('track-breadcrumb')).toHaveCount(0);
  await page.keyboard.press('Control+k');
  await page.getByRole('searchbox', { name: 'Hledat v kurzech' }).fill('zlomky');
  await page.getByTestId('search-results').getByRole('button').first().click();
  await expect(page.getByTestId('track-breadcrumb')).toBeVisible();
  await openPanel(page, 'Plán a cesta');
  await expect(page.getByTestId('plan-percent')).toBeVisible();
});

test('coach "off" really is off: no marks, no bubble', async ({ page }) => {
  await page.goto('/');
  await skipOnboarding(page);
  await setTask(page, '5+1');
  await openTutorMenu(page);
  await page.getByRole('radio', { name: 'Vypnuto' }).click();
  await page.keyboard.press('Escape');
  await writeOnBoard(page, '5+1=8', 0);
  await page.waitForTimeout(2500);
  await expect(page.getByTestId('step-mark-wrong')).toHaveCount(0);
  await expect(bubble(page)).toHaveCount(0);
});

test('settings: "delete all saved data" really starts from scratch', async ({ page }) => {
  await page.goto('/');
  await skipOnboarding(page);
  await setTask(page, '2+2');
  await page.waitForTimeout(500);
  await openSettings(page);
  page.once('dialog', dialog => void dialog.accept());
  await page.getByRole('button', { name: 'Smazat všechna uložená data' }).click();
  await expect(page.getByRole('heading', { name: 'Na co se připravuješ?' })).toBeVisible();
  expect(await page.evaluate(() => JSON.parse(localStorage.getItem('openmathtutor.frontend.v1') ?? '{"boards":[{"statement":""}]}').boards[0].statement)).toBe('');
});

test('a drawing task says plainly that it cannot be checked and offers a self-report that moves progress', async ({ page }) => {
  await page.goto('/');
  await skipOnboarding(page);
  await page.keyboard.press('Control+k');
  await page.getByRole('searchbox', { name: 'Hledat v kurzech' }).fill('schéma obvodu');
  await page.getByTestId('search-results').getByRole('button').first().click();
  await page.keyboard.press('Escape');
  await expect(bubble(page)).toContainText('kresba');
  await openTutorMenu(page);
  await page.getByRole('menuitem', { name: 'Zvládl(a) jsem to' }).click();
  await expect(bubble(page)).toContainText('Zapsáno');
  await openPanel(page, 'Plán a cesta');
  await expect(page.getByTestId('plan-percent')).not.toHaveText('0 %');
});

test('word problem: given data and intermediate lines are not judged, a correct answer after a slip still earns progress', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('button', { name: /fyziku nebo chemii/ }).click();
  await page.getByRole('button', { name: /^Fyzika/ }).click();
  const match = /ujede (\d+) m za (\d+) s/.exec((await page.getByTestId('task-text').textContent()) ?? '');
  const a = Number(match![1]), b = Number(match![2]);
  await page.keyboard.press('Escape');
  await writeOnBoard(page, `s = ${a} m`, 0);
  await writeOnBoard(page, `t = ${b} s`, 1);
  await page.waitForTimeout(2800);
  await expect(page.getByTestId('step-mark-wrong')).toHaveCount(0);
  await expect(bubble(page)).not.toHaveAttribute('data-kind', 'wrong');
  await writeOnBoard(page, `v = ${a} / ${b} = ${Math.round(a / b + 9)} m/s`, 2);
  await expect(bubble(page)).toHaveAttribute('data-kind', 'wrong', { timeout: 8000 });
  await page.getByRole('button', { name: 'Zkusím sám' }).click();
  await writeOnBoard(page, `v = ${a} / ${b} = ${Math.round(a / b)} m/s`, 3);
  await expect(bubble(page)).toHaveAttribute('data-kind', 'solved', { timeout: 8000 });
  await openPanel(page, 'Plán a cesta');
  await expect(page.getByTestId('plan-percent')).not.toHaveText('0 %');
});

test('free example is labelled as such and the course is one click away', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('button', { name: /fyziku nebo chemii/ }).click();
  await page.getByRole('button', { name: /^Fyzika/ }).click();
  await openTutorMenu(page);
  await page.getByRole('menuitem', { name: 'Vlastní příklad' }).click();
  await expect(page.getByTestId('free-chip')).toBeVisible();
  await page.getByRole('button', { name: 'Zpět do kurzu' }).click();
  await expect(page.getByTestId('track-breadcrumb')).toBeVisible();
});

test('the header follows the lesson on the board, and "next problem" never repeats the same statement', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('button', { name: /fyziku nebo chemii/ }).click();
  await page.getByRole('button', { name: /^Chemie/ }).click();
  await expect(page.getByTestId('track-breadcrumb')).toContainText('Molární hmotnost');
  await page.keyboard.press('Control+k');
  await page.getByRole('searchbox', { name: 'Hledat v kurzech' }).fill('Ohm');
  await page.getByTestId('search-results').getByRole('button').first().click();
  await page.keyboard.press('Escape');
  const before = await page.getByTestId('task-text').textContent();
  await openTutorMenu(page);
  await page.getByRole('menuitem', { name: 'Další příklad' }).click();
  await expect(page.getByTestId('task-text')).not.toHaveText(before ?? '');
});
