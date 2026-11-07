import { expect, test } from '@playwright/test';
import { drawElements, setTask, start } from './inkDriver';
import { noisyElements } from './inkFixture';

test.describe('Visual defect regressions (V1-V4)', () => {
  test('V1: uncertainty popover layout is columnar, width >= 300px, chips >= 44px with order badge, no overlap', async ({ page }) => {
    await start(page);
    await setTask(page, '4');
    await drawElements(page, noisyElements(), 'pen');

    const reading = page.locator('.ink-reading.uncertain').first();
    await expect(reading).toBeVisible({ timeout: 10000 });

    const readingBox = await reading.boundingBox();
    expect(readingBox).not.toBeNull();
    expect(readingBox!.width).toBeGreaterThanOrEqual(300);

    // Section title
    const sectionTitle = reading.locator('.ink-section-title');
    await expect(sectionTitle).toBeVisible();
    await expect(sectionTitle).toContainText('Který znak to je?');

    // Candidate chips
    const chips = reading.locator('.ink-candidate-chip');
    await expect(chips.first()).toBeVisible();
    const count = await chips.count();
    expect(count).toBeGreaterThan(0);

    for (let i = 0; i < count; i++) {
      const chip = chips.nth(i);
      const box = await chip.boundingBox();
      expect(box).not.toBeNull();
      expect(box!.width).toBeGreaterThanOrEqual(44);
      expect(box!.height).toBeGreaterThanOrEqual(44);

      // Order badge and symbol
      await expect(chip.locator('.ink-chip-order')).toBeVisible();
      await expect(chip.locator('.ink-chip-symbol')).toBeVisible();
    }

    // No vertical overlap between header, candidates and actions
    const header = reading.locator('.ink-uncertain-header');
    const headerBox = (await header.boundingBox())!;
    const chipsContainer = reading.locator('.ink-candidates-chips');
    const chipsBox = (await chipsContainer.boundingBox())!;
    const actions = reading.locator('.ink-popover-actions');
    const actionsBox = (await actions.boundingBox())!;

    expect(headerBox.y + headerBox.height).toBeLessThanOrEqual(chipsBox.y + 2);
    expect(chipsBox.y + chipsBox.height).toBeLessThanOrEqual(actionsBox.y + 2);
  });

  test('V2: mascot wrong-line choices are row-wrapped, uniform ~40px height, shortened Smazat radek with full title', async ({ page }) => {
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await page.goto('/');
    await page.getByRole('button', { name: 'Přeskočit, chci jen volnou tabuli', exact: true }).click();
    const canvas = page.locator('.excalidraw__canvas.interactive');
    const rect = await canvas.boundingBox();
    if (!rect) throw new Error('Canvas missing');

    for (const [row, text] of [[0, '2 + 3 = 5'], [1, '4 + 5 = 10']] as const) {
      await page.locator('label:has([data-testid="toolbar-text"])').click();
      await page.mouse.click(rect.x + 560, rect.y + 270 + row * 90);
      await expect(page.locator('textarea.excalidraw-wysiwyg')).toBeFocused();
      await page.keyboard.type(text);
      await page.keyboard.press('Escape');
    }

    const bubble = page.getByTestId('tutor-bubble');
    await expect(bubble).toHaveAttribute('data-kind', 'wrong', { timeout: 10000 });

    const wrongRow = bubble.locator('.tutor-choices-wrong');
    await expect(wrongRow).toBeVisible({ timeout: 12000 });

    const buttons = wrongRow.locator('button');
    const btnCount = await buttons.count();
    expect(btnCount).toBe(4);

    // Primary Hint
    const hintBtn = wrongRow.locator('button.primary');
    await expect(hintBtn).toBeVisible();
    await expect(hintBtn).toHaveText('Nápověda');

    // Secondary Retry Line with shortened text and full title
    const retryBtn = wrongRow.locator('button.secondary');
    await expect(retryBtn).toBeVisible();
    await expect(retryBtn).toHaveText('Smazat řádek');
    await expect(retryBtn).toHaveAttribute('title', 'Smazat chybný řádek a zkusit znovu');
    await expect(retryBtn).toHaveAttribute('aria-label', 'Smazat chybný řádek a zkusit znovu');

    // Explain
    const explainBtn = buttons.nth(2);
    await expect(explainBtn).toHaveText('Vysvětli');

    // Dismiss link-btn
    const dismissBtn = wrongRow.locator('button.link-btn');
    await expect(dismissBtn).toBeVisible();
    await expect(dismissBtn).toHaveText('Zkusím sám');

    // Check heights and no squished columns
    for (let i = 0; i < btnCount; i++) {
      const b = await buttons.nth(i).boundingBox();
      expect(b).not.toBeNull();
      expect(b!.height).toBeGreaterThanOrEqual(36);
      expect(b!.height).toBeLessThanOrEqual(46);
      // Not narrow squished columns
      expect(b!.width).toBeGreaterThanOrEqual(60);
    }
  });

  test('V3: note delete cross is anchored at corner and bubble does not overlap zoom controls', async ({ page }) => {
    await page.goto('/');
    await page.getByRole('button', { name: 'Přeskočit, chci jen volnou tabuli', exact: true }).click();
    const canvas = page.locator('.excalidraw__canvas.interactive');
    const rect = await canvas.boundingBox();
    if (!rect) throw new Error('Canvas missing');

    await page.locator('label:has([data-testid="toolbar-text"])').click();
    await page.mouse.click(rect.x + 560, rect.y + 270);
    await expect(page.locator('textarea.excalidraw-wysiwyg')).toBeFocused();
    await page.keyboard.type('4 + 5 = 10');
    await page.keyboard.press('Escape');

    const deleteBtn = page.locator('.teacher-note-delete').first();
    await expect(deleteBtn).toBeVisible({ timeout: 10000 });

    const dBox = await deleteBtn.boundingBox();
    expect(dBox).not.toBeNull();
    expect(dBox!.width).toBeGreaterThanOrEqual(28);
    expect(dBox!.width).toBeLessThanOrEqual(36);
    expect(dBox!.height).toBeGreaterThanOrEqual(28);
    expect(dBox!.height).toBeLessThanOrEqual(36);

    // Zoom controls in Excalidraw footer
    const zoomControls = page.locator('.zoom-actions');
    if (await zoomControls.isVisible()) {
      const zoomBox = await zoomControls.boundingBox();
      const tutorBubble = page.locator('.tutor-hud');
      const tutorBox = await tutorBubble.boundingBox();
      if (zoomBox && tutorBox) {
        // Must not overlap
        const overlap = !(
          tutorBox.x + tutorBox.width <= zoomBox.x ||
          zoomBox.x + zoomBox.width <= tutorBox.x ||
          tutorBox.y + tutorBox.height <= zoomBox.y ||
          zoomBox.y + zoomBox.height <= tutorBox.y
        );
        expect(overlap).toBe(false);
      }
    }
  });

  test('V4: color legend header and item classes are well styled', async ({ page }) => {
    await page.goto('/');
    await page.getByRole('button', { name: 'Přeskočit, chci jen volnou tabuli', exact: true }).click();
    await page.getByRole('button', { name: 'Učitel', exact: true }).click();
    await page.getByRole('menuitem', { name: 'Co znamenají barvy?', exact: true }).click();

    const dialog = page.getByTestId('color-legend-dialog');
    await expect(dialog).toBeVisible();

    await expect(dialog.locator('.color-legend-title')).toBeVisible();
    await expect(dialog.locator('.legend-item-title').first()).toBeVisible();
    await expect(dialog.locator('.legend-item-desc').first()).toBeVisible();
  });
});
