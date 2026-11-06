import { expect, test, type Page } from '@playwright/test';
import { drawElements, drawLine, setTask, start } from './inkDriver';
import { decimalElements, noisyElements, rowElements, standingFractionElements } from './inkFixture';
import type { ContinueLessonRequest } from '@openmathtutor/shared';

test.beforeEach(async ({ page }) => {
  await page.route('http://127.0.0.1:4178/**', route => route.abort('connectionrefused'));
});
const readings = (page: Page) => page.locator('[data-testid^="ink-reading-"]');

for (const statement of ['12+7', '5+2=7', '12 + 7', '12+7=', 'Vypočítej 12+7']) {
  test(`D1 edited course task: ${statement}`, async ({ page }) => {
    await page.goto('/');
    await page.getByRole('button', { name: /Chystám se na střední školu/ }).click();
    await page.getByRole('button', { name: /^Přijímačky na střední školu/ }).click();
    await setTask(page, statement);
    const text = statement === '5+2=7' ? '5+2=7' : '12+7=19';
    await drawLine(page, text, 13, [420, 260], 'pen');
    await expect(readings(page).locator('strong')).toHaveText(text);
    await expect(page.getByTestId('step-mark-ok')).toBeVisible();
    await expect(page.getByTestId('tutor-bubble')).toHaveAttribute('data-kind', 'solved');
    await expect(page.getByTestId('step-mark-wrong')).toHaveCount(0);
  });
}

for (const shape of ['dot', 'slash', 'hook'] as const) {
  test(`D2 decimal separator ${shape} is not a one or division slash`, async ({ page }) => {
    await start(page);
    await drawElements(page, decimalElements(shape), 'pen');
    await expect(readings(page).locator('strong')).toHaveText('(25/10)+(15/10)=4');
    await expect(page.getByTestId('step-mark-ok')).toBeVisible();
    await expect(page.getByTestId('step-mark-wrong')).toHaveCount(0);
  });
}

test('D3 standing fraction equality is one correct row', async ({ page }) => {
  await start(page);
  await drawElements(page, standingFractionElements(), 'pen');
  await expect(readings(page)).toHaveCount(1);
  await expect(readings(page).locator('strong')).toHaveText('(1)/(2)+(1)/(3)=(5)/(6)');
  await expect(page.getByTestId('step-mark-ok')).toBeVisible();
});

test('D4 free equation is a task, then roots are judged against it', async ({ page }) => {
  await start(page);
  await drawLine(page, '2x+3=11', 13, [420, 260], 'pen');
  await expect(readings(page).locator('strong')).toHaveText('2*x+3=11');
  await expect(page.locator('[data-testid^="step-mark-"]')).toHaveCount(0);
  await drawLine(page, 'x=4', 17, [420, 350], 'pen');
  await expect(page.getByTestId('step-mark-ok')).toHaveCount(1);
  await drawLine(page, 'x=5', 19, [420, 440], 'pen');
  await expect(page.getByTestId('step-mark-wrong')).toHaveCount(1);
});

test('D5 noisy pen input stays uncertain; correction chips are labelled and touch-sized', async ({ page }) => {
  await start(page);
  await setTask(page, '4');
  await drawElements(page, noisyElements(), 'pen');
  await expect(readings(page).filter({ hasText: 'NEJISTÝ' }).first()).toContainText('Zkontroluj, jestli jsem to přečetl správně');
  await expect(page.getByTestId('step-mark-wrong')).toHaveCount(0);
  const chips = readings(page).getByRole('button');
  expect(await chips.count()).toBeGreaterThan(0);
  for (const chip of await chips.all()) {
    await expect(chip).toHaveAccessibleName(/\d+\. znak/);
    const rect = await chip.boundingBox();
    expect(rect!.width).toBeGreaterThanOrEqual(44); expect(rect!.height).toBeGreaterThanOrEqual(44);
  }
  await page.screenshot({ path: 'test-results/round7-uncertain.png' });
  const before = await readings(page).locator('strong').allTextContents();
  await chips.first().click();
  await expect(readings(page).locator('strong')).toHaveText(before);
});

test('D2/D5 even a provider response cannot write an arithmetic correction from uncertain pen input', async ({ page }) => {
  await page.route('http://127.0.0.1:4178/**', async route => {
    const req = route.request(), path = new URL(req.url()).pathname;
    const headers = { 'Access-Control-Allow-Origin': new URL(page.url()).origin, 'Access-Control-Allow-Headers': 'content-type', 'Access-Control-Allow-Methods': 'GET, POST, OPTIONS' };
    if (req.method() === 'OPTIONS') return route.fulfill({ status: 204, headers });
    if (path === '/health') return route.fulfill({ json: { status: 'ok', verifier: 'ok' }, headers });
    if (path === '/providers') return route.fulfill({ json: { providers: [{ id: 'codex', detect: { installed: true }, authStatus: { providerId: 'codex', authenticated: true, tutoringAvailable: true },
      models: [{ id: 'ink-model', label: 'Ink mock', supportsImageInput: false }] }] }, headers });
    if (path.endsWith('/cancel')) return route.fulfill({ status: 204, headers });
    const body = req.postDataJSON() as ContinueLessonRequest;
    return route.fulfill({ headers, json: { requestId: body.requestId, boardRevision: body.boardRevision, recognizedSteps: body.stepHistory,
      confidence: .99, firstErrorStepId: body.stepHistory[0].stepId, verifierStatus: 'incorrect', needsClarification: null,
      pedagogicalResponse: '215+115=330', ttsText: '330', boardActions: [{ id: 'unsafe-correction', type: 'write_math', latex: '215+115=330',
        boardRevision: body.boardRevision, placement: { relativeToStepId: body.stepHistory[0].stepId, side: 'right', offsetEm: 1 } }] } });
  });
  await start(page);
  await setTask(page, '4');
  await drawElements(page, noisyElements(), 'pen');
  await expect(readings(page).first()).toHaveClass(/uncertain/);
  await page.getByRole('button', { name: 'Učitel', exact: true }).click();
  await page.getByRole('menuitem', { name: 'Zkontrolovat', exact: true }).click();
  await expect(page.getByTestId('tutor-bubble')).toContainText('Zkontroluj, jestli jsem to přečetl správně');
  await expect(page.locator('[data-annotation-id="unsafe-correction"]')).toHaveCount(0);
  await expect(page.getByTestId('step-mark-wrong')).toHaveCount(0);
});

async function physicsTask(page: Page) {
  await page.addInitScript(() => {
    localStorage.setItem('openmathtutor.frontend.v1', JSON.stringify({ version: 1, activeId: 'physics', settings: { locale: 'cs', onboardingDismissed: true }, boards: [{
      id: 'physics', revision: 0, statement: 'Auto ujede 77 m za 7 s. Jakou má průměrnou rychlost (v m/s)?', topic: 'Rychlost',
      expected: { value: 11, unit: 'm/s', tolerance: 1e-9, wordProblem: true, givens: [77, 7] },
      elements: [], files: {}, annotations: [], history: [], activeStepId: null, steps: [],
    }] }));
  });
  await page.goto('/');
}
test('D6 unrelated true arithmetic cannot pass the physics task', async ({ page }) => {
  await physicsTask(page);
  await drawLine(page, '72:12=6', 13, [420, 300], 'pen');
  await expect(readings(page).locator('strong')).toHaveText('72/12=6');
  await expect(page.getByTestId('step-mark-ok')).toHaveCount(0);
});
test('D6 context suggests a handwritten unit but never turns a guess into a tick', async ({ page }) => {
  await physicsTask(page);
  await drawLine(page, '77/7=11m/s', 13, [420, 300], 'pen');
  await expect(readings(page).locator('strong')).toHaveText('77/7=11 m/s');
  await expect(readings(page)).toHaveClass(/uncertain/);
  await expect(page.getByTestId('step-mark-ok')).toHaveCount(0);
});

test('D10 reading labels cannot steal pen strokes between close rows', async ({ page }) => {
  await start(page);
  await drawLine(page, '12:4=3', 13, [420, 260], 'pen');
  await expect(readings(page).locator('strong')).toHaveText('12/4=3');
  expect(await readings(page).evaluate(el => getComputedStyle(el).pointerEvents)).toBe('none');
  await drawLine(page, '12:4=3', 17, [420, 318], 'pen');
  await expect(readings(page).locator('strong')).toHaveText(['12/4=3', '12/4=3']);
  await page.screenshot({ path: 'test-results/round7-close-rows.png' });
});

test('D13 a stray pen tap produces no reading or uncertainty warning', async ({ page }) => {
  await start(page);
  await drawElements(page, [{ id: 'tap', type: 'freedraw', x: 600, y: 400, points: [[0, 0]], strokeWidth: 2 }], 'pen');
  await page.waitForTimeout(1600);
  await expect(readings(page)).toHaveCount(0);
  await expect(page.getByTestId('tutor-bubble').filter({ hasText: 'přečetl' })).toHaveCount(0);
});
test('D13 a wide cross-out removes the glyph without an invented correction', async ({ page }) => {
  await start(page);
  await drawElements(page, rowElements('3', 78, 40, [420, 260]), 'pen');
  await drawElements(page, [{ id: 'cross', type: 'freedraw', x: 408, y: 280, points: [[0, 0], [60, 0]], strokeWidth: 2 }], 'pen');
  await expect(readings(page)).toHaveCount(0);
});
