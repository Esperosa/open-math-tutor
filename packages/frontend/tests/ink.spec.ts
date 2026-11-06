import { expect, test } from '@playwright/test';
import { start, setTask, drawLine } from './inkDriver';

test.beforeEach(async ({ page }) => {
  await page.route('http://127.0.0.1:4178/**', route => route.abort('connectionrefused'));
});

test('freehand writing is read locally and checked without choosing a tool', async ({ page }) => {
  await start(page);
  await expect(page.getByTestId('ai-status')).toHaveAttribute('data-state', 'offline');
  await setTask(page, '5+2');
  await drawLine(page, '5+2=15', 21, [420, 260]);
  const reading = page.locator('[data-testid^="ink-reading-"]');
  await expect(reading).toContainText('5+2=15', { timeout: 8000 });
  await expect(reading).toHaveAttribute('data-confidence', /\d/);
  await expect(page.getByTestId('step-mark-wrong')).toBeVisible({ timeout: 8000 });
  await page.screenshot({ path: 'test-results/ink-freehand-wrong.png' });
});

test('a correct handwritten calculation gets the right mark', async ({ page }) => {
  await start(page);
  await setTask(page, '12+7');
  await drawLine(page, '12+7=19', 13, [420, 260], 'mouse', 3);
  await expect(page.locator('[data-testid^="ink-reading-"]')).toContainText('12+7=19', { timeout: 8000 });
  await expect(page.getByTestId('step-mark-ok')).toBeVisible({ timeout: 8000 });
});

test('pen input is read at 200% zoom after panning', async ({ page }) => {
  await start(page);
  await setTask(page, '3*4');
  await page.keyboard.down('Control');
  await page.mouse.move(720, 500);
  await page.mouse.wheel(0, -400);
  await page.keyboard.up('Control');
  for (let i = 0; i < 2; i++) await page.keyboard.press('Shift+ArrowRight');
  await expect.poll(async () => Number(await page.getByTestId('board').getAttribute('data-zoom'))).toBeGreaterThan(1);
  await drawLine(page, '3*4=12', 17, [400, 260], 'pen');
  await expect(page.locator('[data-testid^="ink-reading-"]')).toContainText('3*4=12', { timeout: 8000 });
});

test('typing still works after switching the default tool to text', async ({ page }) => {
  await start(page);
  await page.getByRole('button', { name: 'Nastavení', exact: true }).click();
  await page.locator('.settings-pop [data-tool="text"]').click();
  await page.keyboard.press('Escape');
  const canvas = page.locator('.excalidraw__canvas.interactive');
  const rect = await canvas.boundingBox(); if (!rect) throw new Error('Canvas missing');
  await page.mouse.click(rect.x + 560, rect.y + 360);
  await expect(page.locator('textarea.excalidraw-wysiwyg')).toBeFocused();
  await page.keyboard.type('7+8=15');
  await page.keyboard.press('Escape');
  await expect(page.getByTestId('task-text')).toHaveText('7+8=15');
});

test.describe('touch', () => {
  test.use({ hasTouch: true, viewport: { width: 390, height: 844 } });

  test('touch input is read on a phone-sized board', async ({ page }) => {
    await start(page);
    await drawLine(page, '2+3=5', 31, [120, 340], 'touch');
    await expect(page.locator('[data-testid^="ink-reading-"]')).toContainText('2+3=5', { timeout: 8000 });
  });
});
