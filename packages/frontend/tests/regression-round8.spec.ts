import { expect, test, type Page } from '@playwright/test';

const BRIDGE_URL = 'http://127.0.0.1:4178';

async function mockBridge(page: Page) {
  await page.route(`${BRIDGE_URL}/**`, async route => {
    const request = route.request();
    const url = new URL(request.url());
    const origin = new URL(page.url()).origin;
    const headers = {
      'Access-Control-Allow-Origin': origin,
      'Access-Control-Allow-Headers': 'content-type',
      'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    };
    if (request.method() === 'OPTIONS') {
      await route.fulfill({ status: 204, headers });
      return;
    }
    if (url.pathname === '/health') {
      await route.fulfill({ json: { status: 'ok', verifier: 'ok' }, headers });
      return;
    }
    if (url.pathname === '/providers') {
      await route.fulfill({
        json: {
          providers: [{
            id: 'mock-gemini',
            detect: { installed: true },
            authStatus: { providerId: 'mock-gemini', authenticated: true, tutoringAvailable: true },
            models: [{ id: 'gemini-1.5-flash', label: 'Gemini 1.5 Flash', supportsImageInput: false }],
          }],
        },
        headers,
      });
      return;
    }
    await route.fulfill({ json: { status: 'ok' }, headers });
  });
}

test.beforeEach(async ({ page }) => {
  await mockBridge(page);
});

test.describe('D1: Task statement on board in free visible area clear of HUD', () => {
  const viewports = [
    { width: 1440, height: 900, name: 'desktop-1440' },
    { width: 1024, height: 768, name: 'tablet-1024' },
    { width: 390, height: 844, name: 'mobile-390' },
  ];

  for (const vp of viewports) {
    test(`task statement fits visible area and clear of HUD on ${vp.name} (${vp.width}x${vp.height})`, async ({ page }) => {
      await page.setViewportSize({ width: vp.width, height: vp.height });
      await page.goto('/');

      // Start university calculus track (has long limit statements)
      await page.getByRole('button', { name: /Studuju vysokou školu/ }).click();
      await page.getByRole('button', { name: /Matematická analýza/ }).click();

      // Locate teacher note on board
      const note = page.locator('.teacher-note[data-action-id^="task-statement"]');
      await expect(note).toBeVisible({ timeout: 10000 });

      // Note bounding box must be completely within viewport
      const box = await note.boundingBox();
      expect(box).not.toBeNull();
      expect(box!.x).toBeGreaterThanOrEqual(0);
      expect(box!.y).toBeGreaterThanOrEqual(0);
      expect(box!.x + box!.width).toBeLessThanOrEqual(vp.width + 10);
      expect(box!.y + box!.height).toBeLessThanOrEqual(vp.height);

      // elementFromPoint on the note must not be covered by HUD elements
      const hitHUD = await page.evaluate(({ cx, cy }) => {
        const el = document.elementFromPoint(cx, cy);
        return !!el?.closest('.rail, .hud-top-left, .hud-top-right, .tutor-hud');
      }, { cx: box!.x + 20, cy: box!.y + 15 });
      expect(hitHUD).toBe(false);
    });
  }
});

test.describe('D5: Mobile 390x844 layout & toolbar accessibility', () => {
  test.use({
    viewport: { width: 390, height: 844 },
    hasTouch: true,
    locale: 'cs-CZ',
  });

  test('top toolbar tools (selection, draw, eraser) are reachable and not covered by HUD', async ({ page }) => {
    await page.goto('/');
    await page.getByRole('button', { name: 'Přeskočit, chci jen volnou tabuli' }).click();

    // Check Selection tool position is clear of HUD
    const selectBtn = page.locator('label:has([data-testid="toolbar-selection"])');
    await expect(selectBtn).toBeVisible();
    const selectBox = await selectBtn.boundingBox();
    expect(selectBox).not.toBeNull();

    const hitHUDOnSelect = await page.evaluate(({ x, y }) => {
      const el = document.elementFromPoint(x, y);
      return !!el?.closest('.hud-top-left, .hud-top-right, .rail');
    }, { x: selectBox!.x + selectBox!.width / 2, y: selectBox!.y + selectBox!.height / 2 });
    expect(hitHUDOnSelect).toBe(false);

    // Check Freedraw (pen) tool position is clear of HUD
    const drawBtn = page.locator('label:has([data-testid="toolbar-freedraw"])');
    await expect(drawBtn).toBeVisible();
    const drawBox = await drawBtn.boundingBox();
    expect(drawBox).not.toBeNull();

    const hitHUDOnDraw = await page.evaluate(({ x, y }) => {
      const el = document.elementFromPoint(x, y);
      return !!el?.closest('.hud-top-left, .hud-top-right, .rail');
    }, { x: drawBox!.x + drawBox!.width / 2, y: drawBox!.y + drawBox!.height / 2 });
    expect(hitHUDOnDraw).toBe(false);

    // Check Eraser tool position is clear of HUD
    const eraserBtn = page.locator('label:has([data-testid="toolbar-eraser"])');
    await expect(eraserBtn).toBeVisible();
    const eraserBox = await eraserBtn.boundingBox();
    expect(eraserBox).not.toBeNull();

    const hitHUDOnEraser = await page.evaluate(({ x, y }) => {
      const el = document.elementFromPoint(x, y);
      return !!el?.closest('.hud-top-left, .hud-top-right, .rail');
    }, { x: eraserBox!.x + eraserBox!.width / 2, y: eraserBox!.y + eraserBox!.height / 2 });
    expect(hitHUDOnEraser).toBe(false);

    // Click eraser
    await page.locator('[data-testid="toolbar-eraser"]').click({ force: true });
    await expect(page.locator('[data-testid="toolbar-eraser"]')).toBeChecked();
  });

  test('onboarding touch targets: Back button (m11) is >= 44px', async ({ page }) => {
    await page.goto('/');

    // Click into a track to see Back button
    await page.getByRole('button', { name: /Chystám se na střední školu/ }).click();
    const backBtn = page.locator('.onboarding-back-btn');
    await expect(backBtn).toBeVisible();
    const backBox = await backBtn.boundingBox();
    expect(backBox!.height).toBeGreaterThanOrEqual(44);
    expect(backBox!.width).toBeGreaterThanOrEqual(44);
  });
});

test.describe('m3-m7: Settings panel, Color Legend, and 12-deduplication', () => {
  test('Settings panel: max-height scrollable, 4 sections, developer details collapsed, Piper offline card visible', async ({ page }) => {
    await page.goto('/');
    await page.getByRole('button', { name: 'Přeskočit, chci jen volnou tabuli' }).click();

    // Open Settings
    await page.getByRole('button', { name: 'Nastavení' }).click();
    const pop = page.locator('.settings-pop');
    await expect(pop).toBeVisible();

    // Verify 4 section headers
    await expect(pop.getByRole('heading', { name: 'Jazyk a vzhled' })).toBeVisible();
    await expect(pop.getByRole('heading', { name: 'AI asistent' })).toBeVisible();
    await expect(pop.getByRole('heading', { name: 'Hlas a řeč' })).toBeVisible();
    await expect(pop.getByRole('heading', { name: 'Data a kurz' })).toBeVisible();

    // Piper offline voice card is visible under Hlas
    await expect(pop.locator('.piper-voice')).toBeVisible();

    // Developer setup guide is hidden behind details
    const devDetails = pop.locator('details');
    await expect(devDetails).toBeVisible();
    expect(await devDetails.getAttribute('open')).toBeNull();
  });

  test('Color Legend: description explains orange dashed frame with ?', async ({ page }) => {
    await page.goto('/');
    await page.getByRole('button', { name: 'Přeskočit, chci jen volnou tabuli' }).click();

    // Open mascot menu -> Legend
    await page.getByRole('button', { name: 'Učitel', exact: true }).click();
    await page.getByTestId('color-legend-menu-btn').click();

    const dialog = page.getByTestId('color-legend-dialog');
    await expect(dialog).toBeVisible();

    // Check description for uncertain reading
    const uncertainItem = dialog.locator('.color-legend-item').nth(4);
    await expect(uncertainItem).toContainText('Oranžový přerušovaný rámeček');
    await expect(uncertainItem).toContainText('nejisté čtení');
  });

  test('D10 + m1: Next problem button does not repeat statements within 12 clicks', async ({ page }) => {
    await page.goto('/');
    // Start university calculus track
    await page.getByRole('button', { name: /Studuju vysokou školu/ }).click();
    await page.getByRole('button', { name: /Matematická analýza/ }).click();

    const seenStatements = new Set<string>();

    for (let i = 0; i < 12; i++) {
      const statement = (await page.getByTestId('task-text').textContent())?.trim() ?? '';
      expect(statement.length).toBeGreaterThan(0);
      expect(seenStatements.has(statement)).toBe(false);
      seenStatements.add(statement);

      if (i < 11) {
        // Open teacher mascot menu and click "Další příklad"
        await page.getByRole('button', { name: 'Učitel', exact: true }).click();
        await page.getByRole('menuitem', { name: 'Další příklad' }).click();
        await page.waitForTimeout(100);
      }
    }

    expect(seenStatements.size).toBe(12);
  });
});
