import { expect, test, type Page } from '@playwright/test';
import { drawElements, drawLine, setTask, start } from './inkDriver';
import { random, richRowElements, rowElements, type FixtureStroke } from './inkFixture';

test.beforeEach(async ({ page }) => {
  await page.route('http://127.0.0.1:4178/**', route => route.abort('connectionrefused'));
});
test.afterEach(async ({ page }, info) => {
  if (info.status !== info.expectedStatus) {
    const saved = await page.evaluate(() => localStorage.getItem('openmathtutor.frontend.v1'));
    await info.attach('ink-board', { body: saved ?? 'null', contentType: 'application/json' });
  }
});
const readings = (page: Page) => page.locator('[data-testid^="ink-reading-"]');
const bubble = (page: Page) => page.getByTestId('tutor-bubble');

/** The same fixture row with hand tremor: a modelled shaky/sloppy student. */
function jitter(elements: FixtureStroke[], amplitude: number, seed: number): FixtureStroke[] {
  const rng = random(seed);
  return elements.map(element => ({
    ...element,
    points: element.points.map(point => [
      point[0] + (rng() - .5) * amplitude * 2,
      point[1] + (rng() - .5) * amplitude * 2,
    ] as [number, number]),
  }));
}

for (const pause of [700, 1800]) {
  test(`D3(a) a ${pause} ms pause between digits never judges the unfinished line`, async ({ page }) => {
    await start(page);
    await setTask(page, '12+7');
    const first = rowElements('12+7=1', 13, 40, [420, 260]);
    const right = Math.max(...first.flatMap(e => e.points.map(p => e.x + p[0])));
    await drawElements(page, first, 'pen');
    await page.waitForTimeout(pause);
    // While the pen is up but the line is not finished, there is no mistake to
    // report yet. Check inside the quiet window (the finished-line pause is
    // longer than the reported 2 s), then finish the number.
    await expect(page.getByTestId('step-mark-wrong')).toHaveCount(0, { timeout: 250 });
    await expect(page.locator('[data-testid="tutor-bubble"][data-kind="wrong"]')).toHaveCount(0, { timeout: 250 });
    await drawElements(page, rowElements('9', 17, 40, [right + 16, 260]), 'pen');
    await expect(readings(page).locator('strong')).toHaveText('12+7=19', { timeout: 8000 });
    await expect(page.getByTestId('step-mark-ok')).toBeVisible({ timeout: 8000 });
    await expect(page.getByTestId('step-mark-wrong')).toHaveCount(0);
  });
}

test('D3(b) a digit written while the task note animates is not dropped', async ({ page }) => {
  await start(page);
  // A long statement keeps the teacher-note reveal running while the student writes.
  await setTask(page, 'Vypočítej pozorně tento příklad: 5 + 5 = ?');
  // The clickable card starts a long write_text animation; the inner rich text
  // is aria-hidden, so dispatch the click on the card itself.
  await page.locator('.task-card').dispatchEvent('click');
  await page.waitForTimeout(120);
  const first = rowElements('5+5=1', 13, 40, [420, 260]);
  const right = Math.max(...first.flatMap(e => e.points.map(p => e.x + p[0])));
  await drawElements(page, first, 'pen');
  await page.waitForTimeout(60);
  // A single-stroke zero with a fast pen, exactly the reported lost last digit.
  await drawElements(page, rowElements('0', 23, 40, [right + 16, 260]), 'pen', 14);
  await expect(readings(page)).toHaveCount(1);
  await expect(readings(page).locator('strong')).toHaveText('5+5=10');
});

test('D4 a first request for help never reveals the correct result', async ({ page }) => {
  await start(page);
  await setTask(page, '12+7');
  await drawElements(page, rowElements('12+7=18', 13, 40, [420, 260]), 'pen');
  await expect(bubble(page)).toHaveAttribute('data-kind', 'wrong', { timeout: 8000 });
  await expect(page.getByTestId('step-mark-wrong')).toHaveCount(1);
  await bubble(page).getByRole('button', { name: 'Nápověda', exact: true }).click();
  await expect(bubble(page)).toContainText(/přepočítej|operacích/i);
  await expect(page.getByTestId('teacher-annotation').filter({ hasText: '12+7=19' })).toHaveCount(0);
  await expect(page.getByTestId('math-annotation').filter({ hasText: '12+7=19' })).toHaveCount(0);
  // The second explicit request is allowed to show the computed step.
  await bubble(page).getByRole('button', { name: 'Nápověda', exact: true }).click();
  await expect(page.getByTestId('teacher-annotation').filter({ hasText: '12+7=19' }).first()).toBeVisible({ timeout: 5000 });
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

test('D8 a correct bare result in a word problem asks for the unit instead of staying silent', async ({ page }) => {
  await physicsTask(page);
  await drawLine(page, '11', 13, [420, 300], 'pen');
  await expect(bubble(page)).toContainText(/jednotk/i, { timeout: 8000 });
  await expect(bubble(page)).not.toContainText(/neumím|neumim|přečetl/i);
  await expect(page.getByTestId('step-mark-wrong')).toHaveCount(0);
});

test('D8 a correct result with its unit is still solved', async ({ page }) => {
  await physicsTask(page);
  await drawLine(page, '11m/s', 13, [420, 300], 'pen');
  await expect(bubble(page)).toHaveAttribute('data-kind', 'solved', { timeout: 8000 });
  await expect(page.getByTestId('step-mark-ok')).toBeVisible({ timeout: 8000 });
});

test('D9 implausible readings never become a red cross', async ({ page }) => {
  await start(page);
  await setTask(page, '13+8');
  await drawElements(page, richRowElements('83^18=21', 13, 40, [420, 260]), 'pen');
  await expect(page.getByTestId('step-mark-wrong')).toHaveCount(0);
  await drawElements(page, rowElements('6348121', 19, 40, [420, 360]), 'pen');
  await expect(page.getByTestId('step-mark-wrong')).toHaveCount(0);
  await drawElements(page, rowElements('1213=4', 23, 40, [420, 460]), 'pen');
  await expect(page.getByTestId('step-mark-wrong')).toHaveCount(0);
  await expect(readings(page)).not.toHaveCount(0);
});

test('D9 a shaky reading is never a confident red cross', async ({ page }) => {
  await start(page);
  await setTask(page, '13+8');
  await drawElements(page, jitter(rowElements('13+8=21', 13, 40, [420, 260]), 6, 99), 'pen');
  await page.waitForTimeout(4000);
  await expect(page.getByTestId('step-mark-wrong')).toHaveCount(0);
});

test('D7 a slash is division, not a letter or a one', async ({ page }) => {
  await start(page);
  await drawElements(page, rowElements('12/3=4', 13, 40, [420, 260]), 'pen');
  await expect(readings(page).locator('strong')).toHaveText('12/3=4');
  await expect(page.getByTestId('step-mark-ok')).toBeVisible({ timeout: 8000 });
  await expect(page.getByTestId('step-mark-wrong')).toHaveCount(0);
});
