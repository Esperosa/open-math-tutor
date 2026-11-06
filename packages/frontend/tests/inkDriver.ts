import type { Page } from '@playwright/test';
import { rowElements } from './inkFixture';

export async function start(page: Page) {
  await page.goto('/');
  await page.getByRole('button', { name: 'Přeskočit, chci jen volnou tabuli', exact: true }).click();
}

export async function setTask(page: Page, text: string) {
  await page.getByRole('button', { name: 'Upravit zadání' }).click();
  await page.getByRole('textbox', { name: 'Zadání', exact: true }).fill(text);
  await page.getByRole('button', { name: 'Hotovo', exact: true }).click();
}

/** Draw real Hershey fixture strokes as scene coordinates through the browser input stack. */
export async function drawLine(page: Page, text: string, seed: number, offset: [number, number],
  input: 'mouse' | 'pen' | 'touch' = 'mouse', delay = 0) {
  return drawElements(page, rowElements(text, seed, 40, offset), input, delay);
}

export async function drawElements(page: Page, elements: ReturnType<typeof rowElements>, input: 'mouse' | 'pen' | 'touch' = 'mouse', delay = 0) {
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
  for (const element of elements) {
    const points = element.points!;
    if (!points.length) continue;
    if (input !== 'touch') await move(sx(element.x + points[0][0]), sy(element.y + points[0][1]));
    await down(sx(element.x + points[0][0]), sy(element.y + points[0][1]));
    for (const point of points.slice(1)) { await move(sx(element.x + point[0]), sy(element.y + point[1])); if (delay) await page.waitForTimeout(delay); }
    await up(sx(element.x + points[points.length - 1][0]), sy(element.y + points[points.length - 1][1]));
  }
  await cdp?.detach();
}

