import { expect, test, type Locator } from '@playwright/test';

async function boxOf(target: Locator) {
  await expect(target).toBeVisible();
  const box = await target.boundingBox();
  expect(box).not.toBeNull();
  return box!;
}

for (const viewport of [
  { width: 390, height: 844 }, { width: 360, height: 740 },
  { width: 430, height: 932 }, { width: 844, height: 390 },
  { width: 768, height: 1024 }, { width: 1024, height: 768 },
]) {
  test(`rail and drawing controls remain reachable at ${viewport.width}x${viewport.height}`, async ({ page }) => {
    await page.setViewportSize(viewport);
    await page.goto('/');
    await page.getByRole('button', { name: 'Přeskočit, chci jen volnou tabuli' }).press('Enter');
    const rail = page.locator('.rail button');
    await expect(rail).toHaveCount(7);
    const controls = page.locator([
      '.excalidraw [data-testid="button-undo"]',
      '.excalidraw [data-testid="button-redo"]',
      '.excalidraw button[aria-label="Edit"]',
      '.excalidraw label:has([data-testid^="toolbar-"])',
      '.excalidraw .App-toolbar__extra-tools-trigger',
    ].join(', ')).filter({ visible: true });
    await expect(page.getByTestId('button-undo')).toBeVisible();
    await expect(page.getByTestId('button-redo')).toBeVisible();
    await expect(page.locator('label:has([data-testid="toolbar-eraser"])')).toBeVisible();
    if (await page.locator('.excalidraw--mobile').count()) {
      await expect(page.getByRole('button', { name: 'Edit', exact: true })).toBeVisible();
    }
    expect(await controls.count()).toBeGreaterThan(10);
    const railBoxes = await Promise.all((await rail.all()).map(boxOf));
    for (const target of [...await rail.all(), ...await controls.all()]) {
      const box = await boxOf(target);
      expect(box.width, await target.getAttribute('aria-label') ?? 'target width').toBeGreaterThanOrEqual(44);
      expect(box.height).toBeGreaterThanOrEqual(44);
      expect(box.x).toBeGreaterThanOrEqual(0);
      expect(box.y).toBeGreaterThanOrEqual(0);
      expect(box.x + box.width).toBeLessThanOrEqual(viewport.width);
      expect(box.y + box.height).toBeLessThanOrEqual(viewport.height);
      if (!await target.evaluate(el => !!el.closest('.rail'))) {
        for (const r of railBoxes) {
          const intersection = Math.max(0, Math.min(r.x + r.width, box.x + box.width) - Math.max(r.x, box.x))
            * Math.max(0, Math.min(r.y + r.height, box.y + box.height) - Math.max(r.y, box.y));
          expect(intersection, 'rail must not intersect a drawing control').toBe(0);
        }
      }
      // Includes disabled undo/redo: geometry must remain available when enabled.
      expect(await target.evaluate(el => {
        const r = el.getBoundingClientRect();
        const hit = document.elementFromPoint(r.x + r.width / 2, r.y + r.height / 2);
        return !!hit && (el.contains(hit) || hit === el) ? true : hit?.outerHTML.slice(0, 400);
      }), await target.evaluate(el => JSON.stringify({html:el.outerHTML.slice(0,150),box:el.getBoundingClientRect().toJSON()}))).toBe(true);
    }
    await page.locator('label:has([data-testid="toolbar-eraser"])').click();
    await expect(page.getByTestId('toolbar-eraser')).toBeChecked();
  });
}
