import { expect, test } from '@playwright/test';

test.use({
  viewport: { width: 390, height: 844 },
  hasTouch: true,
});

test.beforeEach(async ({ page }) => {
  await page.route('http://127.0.0.1:4178/**', route => route.abort('connectionrefused'));
});

test('D11: Phone 390x844 layout, collapsed bottom rail, visible AI status and unobstructed canvas touch', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('button', { name: 'Přeskočit, chci jen volnou tabuli' }).click();

  // 1. Rail is positioned at the bottom (bottom dock), not occupying 60px on the left
  const rail = page.locator('.rail');
  await expect(rail).toBeVisible();
  const railRect = await rail.boundingBox();
  expect(railRect).not.toBeNull();
  expect(railRect!.y + railRect!.height).toBeGreaterThan(800); // at the bottom of 844px viewport
  expect(railRect!.width).toBeGreaterThan(300); // spans horizontally across bottom

  // Canvas area on the left (e.g. x=20, y=300) is clear of the rail
  const leftPointBlockedByRail = await page.evaluate(() => {
    const r = document.querySelector('.rail')?.getBoundingClientRect();
    if (!r) return false;
    return 20 >= r.left && 20 <= r.right && 300 >= r.top && 300 <= r.bottom;
  });
  expect(leftPointBlockedByRail).toBe(false);

  // 2. AI status and Settings: clear label & icon, not two lonely green dots in bottom-left
  const aiStatus = page.getByTestId('ai-status');
  await expect(aiStatus).toBeVisible();
  const aiLabel = aiStatus.locator('.ai-status-label');
  await expect(aiLabel).toBeVisible();
  const labelText = await aiLabel.textContent();
  expect(labelText?.trim().length).toBeGreaterThan(0);

  // Settings button has gear icon and no duplicate status-dot
  const settingsBtn = page.getByRole('button', { name: 'Nastavení' });
  await expect(settingsBtn).toBeVisible();
  expect(await settingsBtn.locator('.status-dot').count()).toBe(0);

  // Both sit at top-right, not stranded in bottom-left
  const hudTopRight = page.locator('.hud-top-right');
  const hudRightBox = await hudTopRight.boundingBox();
  expect(hudRightBox!.y).toBeLessThan(100);
  expect(hudRightBox!.x).toBeGreaterThan(150);

  // 3. Compact bubble above bottom bar
  const tutorHud = page.locator('.tutor-hud');
  await expect(tutorHud).toBeVisible();
  const tutorBox = await tutorHud.boundingBox();
  expect(tutorBox!.y + tutorBox!.height).toBeLessThan(840);

  // 4. Touch/stroke starting at (25, 300) where left rail previously blocked is not lost
  const touchTargetTag = await page.evaluate(() => {
    const el = document.elementFromPoint(25, 300);
    return el?.tagName.toLowerCase() ?? '';
  });
  // Must hit canvas or excalidraw surface, NOT a HUD container
  expect(['canvas', 'svg', 'div']).toContain(touchTargetTag);
  const hitsHudContainer = await page.evaluate(() => {
    const el = document.elementFromPoint(25, 300);
    return !!el?.closest('.rail, .hud-top-left, .hud-top-right, .drawer:not(.open), .settings-pop:not(.open)');
  });
  expect(hitsHudContainer).toBe(false);

  // 5. Open settings and verify title exists
  await settingsBtn.click();
  const settingsPop = page.locator('.settings-pop');
  await expect(settingsPop).toHaveClass(/open/);
  await expect(settingsPop.locator('h2')).toHaveText('Nastavení');
});
