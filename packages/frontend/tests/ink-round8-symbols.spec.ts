import { expect, test } from '@playwright/test';
import { drawElements, setTask, start } from './inkDriver';
import { rowElements } from './inkFixture';

for (const digit of ['8', '1', '7']) test(`m10 ${digit} a horizontal strike removes only the last digit and undo restores it`, async ({ page }) => {
  await start(page);
  await setTask(page, '12+7');
  const ink = rowElements(`12+7=1${digit}`, 13, 60, [420, 260]);
  await drawElements(page, ink, 'pen');
  const reading = page.locator('[data-testid^="ink-reading-"] strong');
  await expect(reading).toHaveText(`12+7=1${digit}`);
  const last = ink.at(-1)!;
  const glyph = ink.filter(e => e.id.split('-')[0] === last.id.split('-')[0]);
  const xs = glyph.flatMap(e => e.points.map(p => e.x + p[0])), ys = glyph.flatMap(e => e.points.map(p => e.y + p[1]));
  const x = Math.min(...xs), width = Math.max(...xs) - x;
  await drawElements(page, [{ id: 'strike', type: 'freedraw', x: x - 7,
    y: (Math.min(...ys) + Math.max(...ys)) / 2,
    points: [[0, 0], [width + 14, 1]], strokeWidth: 2 }], 'pen');
  await expect(reading).toHaveText('12+7=1');
  await page.keyboard.press('Control+z');
  await expect(reading).toHaveText(`12+7=1${digit}`);
});

for (const text of ['10+2=99', '4×3=99']) {
  test(`m12 readable ${text} does not require confirming zero or multiplication`, async ({ page }) => {
    await start(page);
    await setTask(page, 'Volná tabule');
    await drawElements(page, rowElements(text, 9001, 60, [420, 260]), 'pen');
    const reading = page.locator('[data-testid^="ink-reading-"]');
    await expect(reading.locator('strong')).toHaveText(text.replace('×', '*'));
    await expect(reading).not.toContainText('NEJIST');
  });
}
