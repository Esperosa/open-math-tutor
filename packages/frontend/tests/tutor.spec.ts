import { expect, test, type Page } from '@playwright/test';

test.beforeEach(async ({ page }) => {
  await page.route('http://127.0.0.1:4178/**', route => route.abort('connectionrefused'));
});
async function start(page: Page) {
  await page.goto('/');
  await page.getByRole('button', { name: 'Přeskočit, chci jen volnou tabuli', exact: true }).click();
}
async function wrongLine(page: Page) {
  await page.getByRole('button', { name: 'Upravit zadání' }).click();
  await page.getByRole('textbox', { name: 'Zadání', exact: true }).fill('5+1');
  await page.getByRole('button', { name: 'Hotovo', exact: true }).click();
  await page.mouse.click(560, 360);
  await expect(page.locator('textarea.excalidraw-wysiwyg')).toBeFocused();
  await page.keyboard.type('5+1=8'); await page.keyboard.press('Escape');
}
const hud = (page: Page) => page.getByTestId('tutor-hud');
const bubble = (page: Page) => page.getByTestId('tutor-bubble');

test('live teacher: greeting, typewriter/pencil, safe visit, click-through and return without editing the scene', async ({ page }) => {
  await start(page);
  await expect(bubble(page)).toBeVisible();
  await expect(page.getByTestId('tutor-typewriter')).toHaveAttribute('data-complete', 'false');
  await expect(page.getByTestId('tutor')).toHaveAttribute('data-writing', 'true');
  const home = await hud(page).boundingBox();
  await wrongLine(page);
  await expect(bubble(page)).toHaveAttribute('data-kind', 'wrong');
  await expect(hud(page)).toHaveAttribute('data-visiting', 'true');
  await expect(page.getByTestId('tutor-typewriter')).toHaveAttribute('data-complete', 'true');
  const revision = await page.getByTestId('revision').textContent();
  const rect = await hud(page).boundingBox();
  expect(rect).not.toBeNull();
  expect(rect!.y).toBeLessThan(home!.y);
  expect(rect!.x).toBeGreaterThanOrEqual(0); expect(rect!.x + rect!.width).toBeLessThanOrEqual(1440);
  expect(rect!.y).toBeGreaterThanOrEqual(0); expect(rect!.y + rect!.height).toBeLessThanOrEqual(1000);
  const safe = await hud(page).evaluate(el => {
    const r = el.getBoundingClientRect();
    const controls = [...document.querySelectorAll('.hud-top-left, .hud-top-right, .rail, .excalidraw .Island, .excalidraw footer')];
    return controls.every(c => { const b = c.getBoundingClientRect(); return !b.width || !b.height || !(r.left < b.right && r.right > b.left && r.top < b.bottom && r.bottom > b.top); });
  });
  expect(safe).toBe(true);
  // The overlay cannot eat a student's click, including directly over the mascot.
  const clickThrough = await hud(page).evaluate(el => {
    const button = el.querySelector('.tutor-button')!.getBoundingClientRect();
    return !document.elementFromPoint(button.x + button.width / 2, button.y + button.height / 2)?.closest('.tutor-hud');
  });
  expect(clickThrough).toBe(true);
  await page.screenshot({ path: 'test-results/tutor-visit.png' });
  await expect(hud(page)).toHaveAttribute('data-returning', 'true', { timeout: 14000 });
  await expect(page.getByRole('button', { name: 'Učitel', exact: true })).toBeDisabled();
  await expect(hud(page)).toHaveAttribute('data-visiting', 'false', { timeout: 14000 });
  await expect(hud(page)).toHaveAttribute('data-returning', 'false');
  await expect(page.getByTestId('revision')).toHaveText(revision!);
  await expect(bubble(page).getByRole('button', { name: 'Zkusím sám' })).toBeVisible();
});

test('reduced motion shows readable lesson greeting immediately and disables every mascot animation', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.goto('/');
  await page.getByRole('button', { name: /Chystám se na střední školu/ }).click();
  await page.getByRole('button', { name: /^Přijímačky na střední školu/ }).click();
  await expect(bubble(page)).toBeVisible();
  await expect(page.getByTestId('tutor-typewriter')).toHaveAttribute('data-complete', 'true');
  await expect(page.getByTestId('tutor-typewriter')).toContainText('Piš řešení');
  const motion = await hud(page).evaluate(el => [...el.querySelectorAll('.tutor, .tutor *')].every(e => getComputedStyle(e).animationName === 'none') && getComputedStyle(el).transitionProperty === 'none');
  expect(motion).toBe(true);
  await page.setViewportSize({ width: 390, height: 844 });
  await page.screenshot({ path: 'test-results/tutor-greeting-phone.png' });
  const r = await bubble(page).boundingBox();
  expect(r!.x).toBeGreaterThanOrEqual(0); expect(r!.x + r!.width).toBeLessThanOrEqual(390);
  expect(r!.y).toBeGreaterThanOrEqual(0); expect(r!.y + r!.height).toBeLessThanOrEqual(844);
  await page.getByRole('button', { name: 'Nastavení', exact: true }).click();
  await expect(bubble(page)).toHaveCount(0);
  await page.getByRole('button', { name: 'Tmavý režim', exact: true }).click();
  await page.keyboard.press('Escape');
  await expect(bubble(page)).toBeVisible();
  await page.screenshot({ path: 'test-results/tutor-greeting-phone-dark.png' });
  const clearsFooter = await hud(page).evaluate(el => {
    const teacher = el.getBoundingClientRect();
    const footer = document.querySelector('.excalidraw footer')?.getBoundingClientRect();
    return !footer || teacher.bottom <= footer.top;
  });
  expect(clearsFooter).toBe(true);
  const contrast = await page.getByTestId('tutor-typewriter').evaluate(el => {
    const rgb = (value: string) => value.match(/\d+/g)!.slice(0, 3).map(Number).map(c => c / 255).map(c => c <= .04045 ? c / 12.92 : ((c + .055) / 1.055) ** 2.4);
    const luminance = (value: string) => { const [r, g, b] = rgb(value); return .2126 * r + .7152 * g + .0722 * b; };
    const text = luminance(getComputedStyle(el).color), bg = luminance(getComputedStyle(el.closest('.tutor-bubble')!).backgroundColor);
    return (Math.max(text, bg) + .05) / (Math.min(text, bg) + .05);
  });
  expect(contrast).toBeGreaterThanOrEqual(4.5);
});

test('a pan that loses the target cancels the visit; a new board never keeps the old comment', async ({ page }) => {
  await start(page); await wrongLine(page);
  await expect(hud(page)).toHaveAttribute('data-visiting', 'true');
  // Pan the real Excalidraw viewport, not test-only injected geometry.
  for (let i = 0; i < 8; i++) await page.keyboard.press('Shift+ArrowUp');
  await expect(hud(page)).toHaveAttribute('data-visiting', 'false');
  await page.getByRole('button', { name: 'Učitel', exact: true }).click();
  await page.getByRole('menuitem', { name: 'Vlastní příklad', exact: true }).click();
  await expect(bubble(page)).toHaveCount(0);
  await expect(hud(page)).toHaveAttribute('data-visiting', 'false');
});
