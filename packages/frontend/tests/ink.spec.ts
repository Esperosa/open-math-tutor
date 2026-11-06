import { expect, test, type Page } from '@playwright/test';
import { rowElements } from './inkFixture';

test.beforeEach(async ({ page }) => {
  await page.route('http://127.0.0.1:4178/**', route => route.abort('connectionrefused'));
});

async function start(page: Page) {
  await page.goto('/');
  await page.getByRole('button', { name: 'Přeskočit, chci jen volnou tabuli', exact: true }).click();
}

async function setTask(page: Page, text: string) {
  await page.getByRole('button', { name: 'Upravit zadání' }).click();
  await page.getByRole('textbox', { name: 'Zadání', exact: true }).fill(text);
  await page.getByRole('button', { name: 'Hotovo', exact: true }).click();
}

/** Draw real Hershey fixture strokes as scene coordinates through the browser input stack. */
async function drawLine(page: Page, text: string, seed: number, offset: [number, number],
  input: 'mouse' | 'pen' | 'touch' = 'mouse', delay = 0) {
  const board = page.getByTestId('board');
  const view = await board.evaluate(el => ({
    x: Number(el.dataset.scrollX), y: Number(el.dataset.scrollY), zoom: Number(el.dataset.zoom),
  }));
  const canvas = page.locator('.excalidraw__canvas.interactive');
  const rect = await canvas.boundingBox(); if (!rect) throw new Error('Canvas missing');
  const sx = (sceneX: number) => rect!.x + (sceneX + view.x) * view.zoom;
  const sy = (sceneY: number) => rect!.y + (sceneY + view.y) * view.zoom;
  const cdp = input === 'mouse' ? null : await page.context().newCDPSession(page);
  const down = async (x: number, y: number) => {
    if (!cdp) return page.mouse.down();
    if (input === 'pen') return cdp.send('Input.dispatchMouseEvent', { type: 'mousePressed', x, y, button: 'left', buttons: 1, clickCount: 1, pointerType: 'pen' });
    return cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x, y, id: 1, radiusX: 2, radiusY: 2, force: 1 }] });
  };
  const move = async (x: number, y: number) => {
    if (!cdp) return page.mouse.move(x, y, { steps: 1 });
    if (input === 'pen') return cdp.send('Input.dispatchMouseEvent', { type: 'mouseMoved', x, y, button: 'left', buttons: 1, pointerType: 'pen' });
    return cdp.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ x, y, id: 1, radiusX: 2, radiusY: 2, force: 1 }] });
  };
  const up = async (x: number, y: number) => {
    if (!cdp) return page.mouse.up();
    if (input === 'pen') return cdp.send('Input.dispatchMouseEvent', { type: 'mouseReleased', x, y, button: 'left', buttons: 0, clickCount: 1, pointerType: 'pen' });
    return cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
  };
  for (const element of rowElements(text, seed, 40, offset)) {
    const points = element.points!;
    if (!points.length) continue;
    if (input !== 'touch') await move(sx(element.x + points[0][0]), sy(element.y + points[0][1]));
    await down(sx(element.x + points[0][0]), sy(element.y + points[0][1]));
    for (const point of points.slice(1)) { await move(sx(element.x + point[0]), sy(element.y + point[1])); if (delay) await page.waitForTimeout(delay); }
    await up(sx(element.x + points[points.length - 1][0]), sy(element.y + points[points.length - 1][1]));
  }
}

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
