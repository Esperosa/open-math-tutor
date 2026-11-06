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
test('deterministic replay: stroke → settled crop → first error annotations → correction → success', async ({ page }) => {
  const requests: AnalyzeBoardRequest[] = [], manuals: ContinueLessonRequest[] = [];
  const exceptions: string[] = []; page.on('pageerror', e => exceptions.push(e.message));
  await mockBridge(page, requests, manuals);
  await page.goto('/');
  await page.getByRole('combobox', { name: 'Poskytovatel', exact: true }).selectOption('codex');
  await page.getByRole('combobox', { name: 'Model', exact: true }).selectOption('replay-model');
  await page.getByText('Nastavení', { exact: true }).click();
  await page.getByLabel(/Povolit automatickou kontrolu/).check();
  await page.getByRole('textbox', { name: 'Řádek klávesnicí', exact: true }).fill('2x + 3 = 7');
  await page.getByRole('button', { name: 'Přidat řádek', exact: true }).click();
  // A real pointer stroke on the real Excalidraw canvas, not an application test hook.
  const canvas = page.locator('.excalidraw__canvas.interactive');
  await expect(canvas).toBeVisible();
  await canvas.click({ position: { x: 550, y: 180 } });
  await page.keyboard.press('p');
  const rect = await canvas.boundingBox(); if (!rect) throw new Error('Canvas missing');
  await page.mouse.move(rect.x + 430, rect.y + 130);
  await page.mouse.down();
  await page.mouse.move(rect.x + 455, rect.y + 133, { steps: 5 });
  await page.mouse.up();
  expect(requests).toHaveLength(0);
  await expect.poll(() => requests.length, { timeout: 10000 }).toBe(1);
  expect(requests[0].imageCrop.dataUrl).toMatch(/^data:image\/png;base64,/);
  expect(requests[0].imageCrop.width).toBeLessThanOrEqual(1024);
  await expect(page.getByTestId('annotation-item')).toHaveCount(4);
  await expect(page.getByTestId('math-annotation')).toContainText('2x');
  await expect(page.getByTestId('math-annotation')).toBeVisible();
  await expect(page.getByTestId('math-annotation')).toHaveCSS('opacity', '1');
  await expect(page.getByTestId('explanation')).toContainText('První chyba');
  await page.screenshot({ path: 'test-results/replay-annotated.png', fullPage: true });
  await page.getByLabel('Zobrazit poznámky AI').uncheck();
  await expect(page.getByTestId('math-annotation')).toHaveCount(0);
  await page.getByLabel('Zobrazit poznámky AI').check();
  await expect(page.getByTestId('math-annotation')).toHaveCount(1);
  // Correct the same stable step ID through the keyboard-accessible editing path.
  const stepId = requests[0].stepHistory[0].stepId;
  await page.getByRole('combobox', { name: 'Řádky postupu', exact: true }).selectOption(stepId);
  await page.getByRole('textbox', { name: 'Řádek klávesnicí', exact: true }).fill('x = 2');
  await page.getByRole('button', { name: 'Opravit vybraný řádek' }).click();
  await expect.poll(() => requests.length, { timeout: 10000 }).toBe(2);
  expect(requests[1].boardRevision).toBeGreaterThan(requests[0].boardRevision);
  expect(requests[1].stepHistory[0].stepId).toBe(stepId);
  await expect(page.getByTestId('annotation-item')).toHaveCount(0);
  await expect(page.getByTestId('explanation')).toHaveCount(2);
  await expect(page.getByTestId('explanation').last()).toContainText('Teď je postup správný');
  for (const [name, mode] of [['Zkontrolovat', 'check'], ['Poradit', 'hint'], ['Ukaž další krok', 'next_step'], ['Vysvětli jinak', 'explain_differently']] as const) {
    await page.getByRole('button', { name, exact: true }).click();
    await expect.poll(() => manuals.at(-1)?.mode).toBe(mode);
    await expect(page.getByRole('button', { name, exact: true })).toBeEnabled();
  }
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
  await page.getByRole('combobox', { name: 'Poskytovatel', exact: true }).selectOption('codex');
  await page.getByRole('combobox', { name: 'Model', exact: true }).selectOption('replay-model');
  await page.getByRole('button', { name: 'Zkontrolovat', exact: true }).click();
  await expect.poll(() => started).toBe(true);
  await page.getByRole('button', { name: 'Zastavit', exact: true }).click();
  await expect.poll(() => cancels.length).toBe(1);
  await expect(page.getByText('Kontrola zastavena.', { exact: true })).toBeVisible();
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
  await page.getByRole('combobox', { name: 'Poskytovatel', exact: true }).selectOption('codex');
  await page.getByRole('combobox', { name: 'Model', exact: true }).selectOption('replay-model');
  await page.getByRole('combobox', { name: 'Kurz', exact: true }).selectOption({ label: 'Přijímačky na střední školu' });
  await page.getByRole('combobox', { name: 'Téma kurzu', exact: true }).selectOption({ label: 'Základy čísel' });
  const skillItem = page.getByTestId('skill-item').filter({ hasText: 'Počítání se zápornými čísly' });
  await expect(skillItem.getByText('Nezačato')).toBeVisible();
  await skillItem.getByRole('button').click();
  await expect.poll(() => manuals.at(-1)?.mode).toBe('next_problem');
  expect(manuals.at(-1)?.curriculumContext?.skillId).toBe('arithmetic-integers');
  await expect(page.getByRole('textbox', { name: 'Zadání', exact: true })).not.toHaveValue('');
  await page.getByRole('button', { name: 'Zkontrolovat', exact: true }).click();
  await expect.poll(() => manuals.at(-1)?.mode).toBe('check');
  await expect(skillItem.getByText('Rozpracováno')).toBeVisible();
});

test('real unavailable-bridge state remains usable, persistent, bilingual and responsive', async ({ page }) => {
  // No mocks or bridge server: genuinely exercise connection refusal.
  await page.goto('/');
  await expect(page.getByText(/Lokální bridge není dostupný/)).toBeVisible();
  await page.getByRole('textbox', { name: 'Zadání', exact: true }).fill('x + 1 = 3');
  await page.getByRole('textbox', { name: 'Řádek klávesnicí', exact: true }).fill('x = 2');
  await page.getByRole('button', { name: 'Přidat řádek', exact: true }).click();
  await page.waitForTimeout(500);
  await page.reload();
  await expect(page.getByRole('textbox', { name: 'Zadání', exact: true })).toHaveValue('x + 1 = 3');
  await page.getByRole('button', { name: 'Tmavý režim' }).click();
  await page.getByRole('combobox', { name: 'Jazyk', exact: true }).selectOption('en');
  await expect(page.getByRole('button', { name: 'Check', exact: true })).toBeDisabled();
  await page.setViewportSize({ width: 390, height: 844 });
  await page.screenshot({ path: 'test-results/unavailable-dark-mobile.png', fullPage: true });
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
});
