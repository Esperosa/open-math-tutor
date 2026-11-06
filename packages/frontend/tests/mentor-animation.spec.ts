import { expect, test, type Page } from '@playwright/test';
import type { AnalyzeBoardResponse, ContinueLessonRequest } from '@openmathtutor/shared';

const tutor = (page: Page) => page.getByTestId('tutor');
const hud = (page: Page) => page.getByTestId('tutor-hud');
const gaze = (page: Page) => page.getByRole('button', { name: 'Učitel', exact: true }).evaluate(el => ({
  x: Number.parseFloat(el.style.getPropertyValue('--gaze-x') || '0'), y: Number.parseFloat(el.style.getPropertyValue('--gaze-y') || '0') }));

async function start(page: Page, task?: string) {
  await page.goto('/');
  await page.getByRole('button', { name: 'Přeskočit, chci jen volnou tabuli', exact: true }).click();
  if (task) {
    await page.getByRole('button', { name: 'Upravit zadání' }).click();
    await page.getByRole('textbox', { name: 'Zadání', exact: true }).fill(task);
    await page.getByRole('button', { name: 'Hotovo', exact: true }).click();
  }
}
async function writeLine(page: Page, text: string, y = 360) {
  await page.mouse.click(560, y);
  await expect(page.locator('textarea.excalidraw-wysiwyg')).toBeFocused();
  await page.keyboard.type(text); await page.keyboard.press('Escape');
}
async function stroke(page: Page, from: { x: number; y: number }, to: { x: number; y: number }) {
  await page.mouse.move(from.x, from.y); await page.mouse.down();
  await page.mouse.move(to.x, to.y, { steps: 8 });
}
const animationNames = (page: Page, selector: string) => page.locator(selector).evaluateAll(els => els.map(e => getComputedStyle(e).animationName));

test.describe('offline', () => {
  test.beforeEach(async ({ page }) => { await page.route('http://127.0.0.1:4178/**', route => route.abort('connectionrefused')); });

  test('the mascot watches the pen: eyes and pencil follow the last stroke, then it looks at the line it is checking', async ({ page }) => {
    await start(page);
    await page.getByTitle(/^(Kreslení|Draw) — P/).click();
    await stroke(page, { x: 300, y: 500 }, { x: 330, y: 520 });
    await expect(tutor(page)).toHaveAttribute('data-mood', 'watching');
    await expect.poll(async () => (await gaze(page)).x, { message: 'a stroke on the far left pulls the gaze left' }).toBeLessThan(-0.7);
    await page.mouse.move(700, 150, { steps: 6 });
    await expect.poll(async () => (await gaze(page)).y, { message: 'a stroke high up pulls the gaze up' }).toBeLessThan(-0.5);
    await page.mouse.up();
    await expect(tutor(page)).toHaveAttribute('data-mood', 'checking');
    await expect(tutor(page).locator('.tutor-dots')).toBeVisible();
    await expect(tutor(page)).not.toHaveAttribute('data-mood', 'checking', { timeout: 3000 });
  });

  test('the verdict marks are painted on, a mistake makes the mascot frown, the right result makes it celebrate', async ({ page }) => {
    await start(page, '5+1');
    await writeLine(page, '5+1=8');
    await expect(page.getByTestId('step-mark-wrong')).toBeVisible();
    expect((await animationNames(page, '[data-testid="step-mark-wrong"]'))[0]).toBe('mark-wrong-in');
    await expect(tutor(page)).toHaveAttribute('data-mood', 'concerned');
    await expect(tutor(page).locator('.tutor-brows')).toHaveCount(1);
    await writeLine(page, '5+1=6', 440);
    await expect(page.getByTestId('step-mark-ok')).toBeVisible();
    expect((await animationNames(page, '[data-testid="step-mark-ok"]'))[0]).toBe('mark-ok-in');
    await expect(page.getByTestId('tutor-bubble')).toHaveAttribute('data-kind', 'solved');
    await expect(tutor(page)).toHaveAttribute('data-mood', 'happy');
    expect(await tutor(page).locator('.tutor-confetti rect').count()).toBeGreaterThan(4);
    await page.screenshot({ path: 'test-results/mentor-solved.png' });
  });

  test('the greeting is a wave, the visit to a line is a smooth walk that ends pointing at it', async ({ page }) => {
    await start(page);
    await expect(tutor(page)).toHaveAttribute('data-mood', 'waving');
    await expect(tutor(page)).toHaveAttribute('data-mood', 'idle', { timeout: 5000 });
    await page.getByRole('button', { name: 'Upravit zadání' }).click();
    await page.getByRole('textbox', { name: 'Zadání', exact: true }).fill('5+1');
    await page.getByRole('button', { name: 'Hotovo', exact: true }).click();
    await writeLine(page, '5+1=8');
    await expect(hud(page)).toHaveAttribute('data-visiting', 'true');
    await expect(tutor(page)).toHaveAttribute('data-pointing', 'true');
    const duration = await hud(page).evaluate(el => Number.parseFloat(getComputedStyle(el).transitionDuration) * 1000);
    expect(duration).toBeGreaterThanOrEqual(500); expect(duration).toBeLessThanOrEqual(700);
    // Position changes in many small steps (a glide), never one jump.
    const xs: number[] = [];
    await expect(hud(page)).toHaveAttribute('data-returning', 'true', { timeout: 14000 });
    for (let i = 0; i < 8; i++) { xs.push((await hud(page).boundingBox())!.x); await page.waitForTimeout(60); }
    expect(new Set(xs.map(x => Math.round(x))).size).toBeGreaterThan(2);
    await expect(hud(page)).toHaveAttribute('data-visiting', 'false', { timeout: 14000 });
  });

  test('reduced motion switches every animation off and still shows every state', async ({ page }) => {
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await start(page, '5+1');
    await expect(tutor(page)).toHaveAttribute('data-mood', 'idle'); // no wave
    await writeLine(page, '5+1=8');
    await expect(page.getByTestId('step-mark-wrong')).toBeVisible();
    await writeLine(page, '5+1=6', 440);
    await expect(tutor(page)).toHaveAttribute('data-mood', 'happy');
    await page.getByRole('button', { name: 'Povídat si s učitelem', exact: true }).click();
    await page.getByRole('button', { name: 'Jak přepnu hlídání?', exact: true }).click();
    const names = [
      ...await animationNames(page, '.tutor, .tutor *'), ...await animationNames(page, '.step-mark'), ...await animationNames(page, '.chat-msg'),
      ...await animationNames(page, '.chat'),
    ];
    expect(names.length).toBeGreaterThan(10);
    expect(names.every(n => n === 'none')).toBe(true);
    expect(await hud(page).evaluate(el => getComputedStyle(el).transitionProperty)).toBe('none');
  });
});

test('while the AI works the bubble and the mascot show it at once, animated, and the mascot calms down afterwards', async ({ page }) => {
  await page.route('http://127.0.0.1:4178/**', async route => {
    const request = route.request(), url = new URL(request.url());
    const headers = { 'Access-Control-Allow-Origin': new URL(page.url()).origin, 'Access-Control-Allow-Headers': 'content-type', 'Access-Control-Allow-Methods': 'GET, POST, OPTIONS' };
    if (request.method() === 'OPTIONS') { await route.fulfill({ status: 204, headers }); return; }
    if (url.pathname === '/health') { await route.fulfill({ json: { status: 'ok', verifier: 'ok' }, headers }); return; }
    if (url.pathname === '/providers') {
      await route.fulfill({ json: { providers: [{ id: 'codex', detect: { installed: true }, authStatus: { providerId: 'codex', authenticated: true, tutoringAvailable: true },
        models: [{ id: 'replay-model', label: 'Replay model (test only)', supportsImageInput: true }] }] }, headers }); return;
    }
    if (url.pathname.endsWith('/cancel')) { await route.fulfill({ status: 204, headers }); return; }
    const body = request.postDataJSON() as ContinueLessonRequest;
    await new Promise(resolve => setTimeout(resolve, 1800));
    const response: AnalyzeBoardResponse = { requestId: body.requestId, boardRevision: body.boardRevision, recognizedSteps: [], confidence: 0.9, firstErrorStepId: null,
      verifierStatus: 'ambiguous', pedagogicalResponse: 'Zkus to rozložit na menší kroky.', ttsText: '', needsClarification: null, boardActions: [] };
    await route.fulfill({ json: response, headers }).catch(() => {});
  });
  await start(page);
  await page.getByRole('button', { name: 'Nastavení', exact: true }).click();
  await page.getByRole('combobox', { name: 'Poskytovatel', exact: true }).selectOption('codex');
  await page.getByRole('combobox', { name: 'Model', exact: true }).selectOption('replay-model');
  await page.getByRole('button', { name: 'Nastavení', exact: true }).click();
  await page.getByRole('button', { name: 'Učitel', exact: true }).click();
  await page.getByRole('menuitem', { name: 'Poradit', exact: true }).click();
  await expect(tutor(page)).toHaveAttribute('data-mood', 'thinking');
  await expect(tutor(page).locator('.tutor-dots')).toBeVisible();
  const bubble = page.getByTestId('tutor-bubble');
  await expect(bubble).toHaveAttribute('data-kind', 'thinking');
  await expect(bubble.locator('.think-dots i')).toHaveCount(3);
  expect((await animationNames(page, '.think-dots i'))[0]).toBe('tutor-dot');
  await expect(bubble.getByRole('button', { name: 'Zrušit', exact: true })).toBeVisible();
  await expect(bubble).toContainText('Zkus to rozložit', { timeout: 6000 });
  await expect(tutor(page)).not.toHaveAttribute('data-mood', 'thinking');
});
