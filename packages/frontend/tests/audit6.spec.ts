import { expect, test } from '@playwright/test';

test.beforeEach(async ({ page }) => {
  await page.route('http://127.0.0.1:4178/**', route => route.abort('connectionrefused'));
});

for (const viewport of [{ width: 390, height: 844 }, { width: 360, height: 640 }, { width: 1024, height: 768 }]) {
  test(`HUD remains clear at ${viewport.width}x${viewport.height}`, async ({ page }) => {
    await page.setViewportSize(viewport);
    await page.goto('/');
    await page.getByRole('button', { name: 'Přeskočit, chci jen volnou tabuli' }).click();
    await page.getByRole('button', { name: 'Kalkulačka', exact: true }).click();
    const calc = page.getByRole('dialog', { name: 'Kalkulačka' });
    await expect(calc).toBeVisible();
    const clear = await calc.evaluate(el => {
      const c = el.getBoundingClientRect();
      const rail = document.querySelector('.rail')!.getBoundingClientRect();
      const hit = (a: DOMRect, b: DOMRect) => a.left < b.right && a.right > b.left && a.top < b.bottom && a.bottom > b.top;
      return c.left >= 0 && c.right <= innerWidth && c.top >= 0 && c.bottom <= innerHeight && !hit(c, rail);
    });
    expect(clear).toBe(true);
    await page.screenshot({ path: `test-results/audit6-calc-${viewport.width}.png` });
    // Rail buttons are genuinely hit-testable, not merely visible through a panel.
    for (const button of await page.locator('.rail-btn').all()) await button.click({ trial: true });
    await page.getByRole('button', { name: 'Zavřít kalkulačku' }).click();
    await page.getByRole('button', { name: 'Nastavení', exact: true }).click();
    await expect(page.locator('.settings-pop')).toHaveClass(/open/);
    expect(await page.locator('.settings-pop').evaluate(el => {
      const r = el.getBoundingClientRect();
      const toolbar = document.querySelector('.excalidraw .App-toolbar')?.getBoundingClientRect();
      return r.top >= (toolbar?.bottom ?? 64) && r.bottom <= innerHeight && r.left >= 0 && r.right <= innerWidth;
    })).toBe(true);
    await page.screenshot({ path: `test-results/audit6-settings-${viewport.width}.png` });
    await page.keyboard.press('Escape');
    expect(await page.locator('.tutor-button').evaluate(el => {
      const r = el.getBoundingClientRect();
      return [...document.querySelectorAll('.excalidraw footer, .excalidraw .layer-ui__wrapper__footer')].every(f => {
        const b = f.getBoundingClientRect();
        return !b.width || !b.height || r.right <= b.left || r.left >= b.right || r.bottom <= b.top || r.top >= b.bottom;
      });
    })).toBe(true);
    await page.screenshot({ path: `test-results/audit6-hud-${viewport.width}.png` });
  });
}

test('Escape finishing a real Excalidraw line keeps the calculator open', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('button', { name: 'Přeskočit, chci jen volnou tabuli' }).click();
  await page.getByRole('button', { name: 'Kalkulačka', exact: true }).click();
  await page.mouse.click(560, 350);
  await expect(page.locator('textarea.excalidraw-wysiwyg')).toBeFocused();
  await page.keyboard.type('3*0,7=2,2');
  await page.keyboard.press('Escape');
  await expect(page.getByRole('dialog', { name: 'Kalkulačka' })).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(page.getByRole('dialog', { name: 'Kalkulačka' })).toHaveCount(0);
});

test('a soft word-problem check-in records nothing until the student confirms', async ({ page }) => {
  await page.addInitScript(() => {
    localStorage.setItem('openmathtutor.frontend.v1', JSON.stringify({ version: 1, activeId: 'audit6', settings: { locale: 'cs', onboardingDismissed: true }, boards: [{
      id: 'audit6', revision: 1, statement: 'Urči hmotnost.', topic: '', skillId: 'chem-moles', elements: [], files: {}, annotations: [], history: [], activeStepId: 'a',
      expected: { value: 175.5, unit: 'g', tolerance: 0.01, wordProblem: true, givens: [3, 58.5] },
      steps: [{ stepId: 'a', latexGuess: '176,4 g', boardRevision: 1, box: { x: 0, y: 0, width: 100, height: 20 }, elementIds: [] }],
    }] }));
  });
  await page.goto('/');
  await expect(page.getByTestId('tutor-bubble')).toHaveAttribute('data-kind', 'check_in');
  expect(await page.evaluate(() => localStorage.getItem('openmathtutor.mastery.v1'))).toBeNull();
  await page.getByRole('button', { name: 'Je to výsledek' }).click();
  await expect(page.getByTestId('tutor-bubble')).toHaveAttribute('data-kind', 'wrong');
  expect(await page.evaluate(() => JSON.parse(localStorage.getItem('openmathtutor.mastery.v1')!)['chem-moles'].attempts)).toBe(1);
  expect(await page.evaluate(() => JSON.parse(localStorage.getItem('openmathtutor.profile.v1')!).skillErrors['chem-moles'].wrong_final)).toBe(1);
});
