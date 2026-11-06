import { expect, test } from '@playwright/test';
test('built offline shell reloads and accepts board edits without any network', async ({ page, context }) => {
  // Real built static assets/service worker. No mock server or provider response.
  const errors: string[] = []; page.on('pageerror', error => errors.push(error.message));
  await page.goto('/');
  // The first-run wizard would hide the HUD; skip it so the bridge chip can appear later.
  await page.getByRole('button', { name: 'Přeskočit, chci jen volnou tabuli' }).click();
  await page.evaluate(async () => { await navigator.serviceWorker.ready; });
  await page.reload();
  await expect.poll(() => page.evaluate(() => !!navigator.serviceWorker.controller)).toBe(true);
  await context.setOffline(true);
  await page.reload();
  await expect(page.getByText(/Lokální bridge není dostupný/)).toBeVisible();
  // The old keyboard-line box is gone; editing the task statement is the board edit
  // that still bumps the revision, and it must work fully offline.
  await page.getByRole('button', { name: 'Upravit zadání', exact: true }).click();
  await page.getByRole('textbox', { name: 'Zadání', exact: true }).fill('x = 2');
  await page.getByRole('button', { name: 'Hotovo', exact: true }).click();
  await expect(page.getByTestId('revision')).toHaveText('1');
  await expect(page.locator('.excalidraw__canvas.interactive')).toBeVisible();
  expect(errors).toEqual([]);
});
