import { expect, test } from '@playwright/test';
test('built offline shell reloads and accepts board edits without any network', async ({ page, context }) => {
  // Real built static assets/service worker. No mock server or provider response.
  const errors: string[] = []; page.on('pageerror', error => errors.push(error.message));
  await page.goto('/');
  await page.evaluate(async () => { await navigator.serviceWorker.ready; });
  await page.reload();
  await expect.poll(() => page.evaluate(() => !!navigator.serviceWorker.controller)).toBe(true);
  await context.setOffline(true);
  await page.reload();
  await expect(page.getByText(/Lokální bridge není dostupný/)).toBeVisible();
  await page.getByRole('textbox', { name: 'Řádek klávesnicí', exact: true }).fill('x = 2');
  await page.getByRole('button', { name: 'Přidat řádek', exact: true }).click();
  await expect(page.getByTestId('revision')).toHaveText('1');
  await expect(page.locator('.excalidraw__canvas.interactive')).toBeVisible();
  expect(errors).toEqual([]);
});
