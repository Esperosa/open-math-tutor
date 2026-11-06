import { expect, test, type Page } from '@playwright/test';
import type { AnalyzeBoardResponse, BoardAction, ContinueLessonRequest } from '@openmathtutor/shared';

// Test-only HTTP mock of the bridge: every board action type the tutor may write, all through relative anchors.
const TYPES = ['circle', 'underline', 'highlight', 'strike_through', 'write_text', 'write_math', 'show_hint', 'draw_arrow'];
async function mockBridge(page: Page) {
  await page.route('http://127.0.0.1:4178/**', async route => {
    const request = route.request(), url = new URL(request.url());
    const headers = { 'Access-Control-Allow-Origin': new URL(page.url()).origin,
      'Access-Control-Allow-Headers': 'content-type', 'Access-Control-Allow-Methods': 'GET, POST, OPTIONS' };
    if (request.method() === 'OPTIONS') { await route.fulfill({ status: 204, headers }); return; }
    if (url.pathname === '/health') { await route.fulfill({ json: { status: 'ok', verifier: 'ok' }, headers }); return; }
    if (url.pathname === '/providers') {
      await route.fulfill({ json: { providers: [{ id: 'codex', detect: { installed: true }, authStatus: { providerId: 'codex', authenticated: true, tutoringAvailable: true },
        models: [{ id: 'replay-model', label: 'Replay model (test only)', supportsImageInput: true }] }] }, headers }); return;
    }
    if (url.pathname.endsWith('/cancel')) { await route.fulfill({ status: 204, headers }); return; }
    const body = request.postDataJSON() as ContinueLessonRequest;
    const first = body.stepHistory[0]!.stepId, revision = body.boardRevision;
    const at = (side: 'right' | 'below' | 'above', offsetEm: number) => ({ relativeToStepId: first, side, offsetEm });
    const boardActions: BoardAction[] = [
      { id: 'a-circle', type: 'circle', targetStepId: first, boardRevision: revision },
      { id: 'a-underline', type: 'underline', targetStepId: first, boardRevision: revision },
      { id: 'a-highlight', type: 'highlight', targetStepId: first, boardRevision: revision },
      { id: 'a-strike', type: 'strike_through', targetStepId: first, targetSymbolIndex: 5, boardRevision: revision },
      { id: 'a-text', type: 'write_text', text: 'Co uděláš s oběma stranami?', placement: at('right', 1.5), boardRevision: revision },
      { id: 'a-math', type: 'write_math', latex: '2x = 7 - 3', placement: at('below', 0.5), boardRevision: revision },
      { id: 'a-hint', type: 'show_hint', text: 'Odečti trojku.', placement: at('above', 0.5), boardRevision: revision },
      { id: 'a-arrow', type: 'draw_arrow', from: at('right', 1), to: at('below', 1), boardRevision: revision },
    ];
    const response: AnalyzeBoardResponse = { requestId: body.requestId, boardRevision: revision,
      recognizedSteps: body.stepHistory, confidence: 0.99, firstErrorStepId: first, verifierStatus: 'incorrect',
      pedagogicalResponse: 'Koukni na první řádek.', ttsText: 'Koukni na první řádek.', needsClarification: null, boardActions };
    await route.fulfill({ json: response, headers });
  });
}
test.beforeEach(async ({ page }) => { await page.route('http://127.0.0.1:4178/**', route => route.abort('connectionrefused')); });

async function openTutorMenu(page: Page) {
  const button = page.getByRole('button', { name: 'Učitel', exact: true });
  if ((await button.getAttribute('aria-expanded')) !== 'true') await button.click();
}
async function setup(page: Page) {
  await mockBridge(page);
  await page.goto('/');
  await page.getByRole('button', { name: 'Přeskočit, chci jen volnou tabuli', exact: true }).click();
  await page.getByRole('button', { name: 'Nastavení', exact: true }).click();
  await page.getByRole('combobox', { name: 'Poskytovatel', exact: true }).selectOption('codex');
  await page.getByRole('combobox', { name: 'Model', exact: true }).selectOption('replay-model');
  await page.getByRole('button', { name: 'Nastavení', exact: true }).click();
  const canvas = page.locator('.excalidraw__canvas.interactive');
  const rect = await canvas.boundingBox(); if (!rect) throw new Error('Canvas missing');
  await page.mouse.click(rect.x + 560, rect.y + 340);
  await expect(page.locator('textarea.excalidraw-wysiwyg')).toBeFocused();
  await page.keyboard.type('2x + 3 = 7');
  await page.keyboard.press('Escape');
  await openTutorMenu(page);
  await page.getByRole('menuitem', { name: 'Zkontrolovat', exact: true }).click();
}
const notes = (page: Page) => page.locator('.teacher-note-delete');
interface Box { x: number; y: number; width: number; height: number }
const overlap = (a: Box, b: Box) => a.x < b.x + b.width && a.x + a.width > b.x && a.y < b.y + b.height && a.y + a.height > b.y;

test('tutor writes every action type on the board: progressive, exported, deletable and never over the student text', async ({ page }) => {
  const exceptions: string[] = []; page.on('pageerror', e => exceptions.push(e.message));
  await setup(page);
  await expect(notes(page)).toHaveCount(TYPES.length);
  const types = await notes(page).evaluateAll(els => els.map(e => e.getAttribute('data-action-type')));
  expect([...types].sort()).toEqual([...TYPES].sort());
  // Progressive writing: at least one note is still being written right after the response, and all finish.
  await expect.poll(() => page.locator('[data-writing="true"]').count(), { timeout: 3000 }).toBeGreaterThan(0);
  await expect.poll(() => page.locator('[data-writing="true"]').count(), { timeout: 15000 }).toBe(0);
  await expect(page.getByTestId('tutor-bubble')).toContainText('Koukni na první řádek');

  // The labels never cover the student's line. Marks (circle, underline, ...) deliberately point at it.
  const studentBox = () => page.evaluate(() => (JSON.parse(localStorage.getItem('openmathtutor.frontend.v1') ?? '{}').boards?.[0]?.steps?.[0]?.box ?? null) as Box | null);
  await expect.poll(studentBox).not.toBeNull();
  const student = (await studentBox())!;
  const boxes = await notes(page).evaluateAll(els => els.map(e => ({ type: e.getAttribute('data-action-type'), box: JSON.parse(e.getAttribute('data-scene-box')!) as Box })));
  for (const note of boxes.filter(b => ['write_text', 'write_math', 'show_hint'].includes(b.type!))) {
    expect(overlap(note.box, student), `${note.type} must not cover the student's writing`).toBe(false);
  }
  const labels = boxes.filter(b => ['write_text', 'write_math', 'show_hint'].includes(b.type!));
  for (const [i, a] of labels.entries()) for (const b of labels.slice(i + 1)) expect(overlap(a.box, b.box), `${a.type} vs ${b.type}`).toBe(false);

  // PNG export contains both teacher pens (red correction, teal explanation) and the white background.
  await page.getByRole('button', { name: 'Zápisky a pokrok', exact: true }).click();
  const pixels = async () => {
    const [download] = await Promise.all([page.waitForEvent('download'), page.getByRole('button', { name: 'Tabule jako PNG' }).click()]);
    const bytes = (await (await download.createReadStream()).toArray()).map(c => Buffer.from(c));
    const base64 = Buffer.concat(bytes).toString('base64');
    return page.evaluate(async data => {
      const bitmap = await createImageBitmap(new Blob([Uint8Array.from(atob(data), c => c.charCodeAt(0))], { type: 'image/png' }));
      const canvas = document.createElement('canvas'); canvas.width = bitmap.width; canvas.height = bitmap.height;
      const ctx = canvas.getContext('2d')!; ctx.drawImage(bitmap, 0, 0);
      const px = ctx.getImageData(0, 0, canvas.width, canvas.height).data;
      const near = (r: number, g: number, b: number, c: number[]) => Math.abs(r - c[0]) + Math.abs(g - c[1]) + Math.abs(b - c[2]) < 90;
      let red = 0, teal = 0;
      for (let i = 0; i < px.length; i += 4) {
        if (near(px[i], px[i + 1], px[i + 2], [0xb4, 0x23, 0x18])) red++;
        if (near(px[i], px[i + 1], px[i + 2], [0x08, 0x7f, 0x8c])) teal++;
      }
      return { red, teal };
    }, base64);
  };
  const withNotes = await pixels();
  expect(withNotes.red).toBeGreaterThan(50); expect(withNotes.teal).toBeGreaterThan(50);

  // One tap deletes one note, the student's text stays.
  await page.getByRole('button', { name: 'Zápisky a pokrok', exact: true }).click();
  await page.locator('[data-annotation-id="a-text"]').click();
  await expect(notes(page)).toHaveCount(TYPES.length - 1);
  await expect(page.locator('[data-annotation-id="a-text"]')).toHaveCount(0);
  const stored = await page.evaluate(() => JSON.parse(localStorage.getItem('openmathtutor.frontend.v1')!).boards[0].steps[0].latexGuess as string);
  expect(stored).toContain('2x + 3 = 7');

  // Hide / show / delete all from the mascot menu.
  await openTutorMenu(page);
  await page.getByRole('menuitem', { name: 'Skrýt poznámky učitele' }).click();
  await expect(notes(page)).toHaveCount(0);
  await openTutorMenu(page);
  await page.getByRole('menuitem', { name: 'Zobrazit poznámky učitele' }).click();
  await expect(notes(page)).toHaveCount(TYPES.length - 1);
  await page.getByRole('button', { name: 'Zápisky a pokrok', exact: true }).click();
  await openTutorMenu(page);
  await page.getByRole('menuitem', { name: 'Smazat poznámky učitele' }).click();
  await expect(notes(page)).toHaveCount(0);
  await page.getByRole('button', { name: 'Zápisky a pokrok', exact: true }).click();
  const cleared = await pixels();
  expect(cleared.red + cleared.teal).toBeLessThan(withNotes.red + withNotes.teal);
  expect(cleared.teal).toBeLessThan(10);
  expect(exceptions).toEqual([]);
});

test('with reduced motion the notes appear at once', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await setup(page);
  await expect(notes(page)).toHaveCount(TYPES.length);
  await expect(page.locator('[data-writing="true"]')).toHaveCount(0);
});

test('without AI the local coach circles the wrong line, writes a short correction, and offers hint and retry', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('button', { name: 'Přeskočit, chci jen volnou tabuli', exact: true }).click();
  const canvas = page.locator('.excalidraw__canvas.interactive');
  const rect = await canvas.boundingBox(); if (!rect) throw new Error('Canvas missing');
  for (const [row, text] of [[0, '2 + 3 = 5'], [1, '4 + 5 = 10']] as const) {
    await page.mouse.click(rect.x + 560, rect.y + 270 + row * 90);
    await expect(page.locator('textarea.excalidraw-wysiwyg')).toBeFocused();
    await page.keyboard.type(text);
    await page.keyboard.press('Escape');
  }
  const bubble = page.getByTestId('tutor-bubble');
  await expect(bubble).toHaveAttribute('data-kind', 'wrong', { timeout: 10000 });
  await expect(notes(page)).toHaveCount(2);
  await expect(page.locator('[data-action-type="write_text"]')).toContainText('4 + 5=9');
  await bubble.getByRole('button', { name: 'Nápověda', exact: true }).click();
  await expect(notes(page)).toHaveCount(3);
  await expect(page.locator('[data-action-type="show_hint"]')).toContainText('Přepočítej');
  await bubble.getByRole('button', { name: 'Smazat chybný řádek a zkusit znovu' }).click();
  await expect(notes(page)).toHaveCount(0);
  await expect.poll(() => page.evaluate(() => JSON.parse(localStorage.getItem('openmathtutor.frontend.v1')!).boards[0].steps
    .map((s: { latexGuess: string }) => s.latexGuess).join('|'))).not.toContain('4 + 5');
});
