import { expect, test, type Locator, type Page } from '@playwright/test';

test.beforeEach(async ({ page }) => {
  await page.route('http://127.0.0.1:4178/**', route => route.abort('connectionrefused'));
});

async function startLesson(page: Page) {
  await page.goto('/');
  await page.getByRole('button', { name: /Chystám se na střední školu/ }).click();
  await page.getByRole('button', { name: /^Přijímačky na střední školu/ }).click();
}

async function verifyElementFromPoint(target: Locator, label: string) {
  await expect(target).toBeVisible();
  const hitResult = await target.evaluate(el => {
    const r = el.getBoundingClientRect();
    const hit = document.elementFromPoint(r.x + r.width / 2, r.y + r.height / 2);
    if (!hit) return { ok: false, hit: null, el: el.outerHTML.slice(0, 100) };
    const matches = el === hit || el.contains(hit);
    return { ok: matches, hit: hit.outerHTML.slice(0, 150), el: el.outerHTML.slice(0, 100) };
  });
  expect(hitResult.ok, `${label} obscured by ${hitResult.hit}`).toBe(true);
}

const VIEWPORTS = [
  { width: 844, height: 390, name: '844x390 landscape' },
  { width: 1440, height: 900, name: '1440x900 desktop' },
  { width: 1024, height: 768, name: '1024x768 tablet' },
  { width: 390, height: 844, name: '390x844 mobile' },
  { width: 360, height: 740, name: '360x740 small phone' },
];

for (const vp of VIEWPORTS) {
  test(`buttons are not obscured in ${vp.name} (elementFromPoint)`, async ({ page }) => {
    await page.setViewportSize({ width: vp.width, height: vp.height });
    await startLesson(page);

    const settingsBtn = page.getByRole('button', { name: 'Nastavení', exact: true });
    const taskEditBtn = page.getByRole('button', { name: 'Upravit zadání' });
    const reconnectBtn = page.getByRole('button', { name: 'Zkusit připojení' });

    await verifyElementFromPoint(settingsBtn, 'Settings button');
    await verifyElementFromPoint(taskEditBtn, 'Task edit button');
    if (await reconnectBtn.isVisible()) {
      await verifyElementFromPoint(reconnectBtn, 'Reconnect button');
    }

    if (vp.width === 844 && vp.height === 390) {
      await expect(reconnectBtn).toBeVisible();
      const bubble = page.getByTestId('tutor-bubble');
      await expect(bubble).toBeVisible();
      const closeBtn = page.locator('.tutor-bubble-close');
      await expect(closeBtn).toBeVisible();
      await closeBtn.click();
      await expect(bubble).toHaveCount(0);
    }
  });
}

test('touch target sizes meet WCAG min 44x44 (or >=32px with >=44px hit area)', async ({ page }) => {
  await page.setViewportSize({ width: 1024, height: 768 });
  await startLesson(page);

  // 1. Color legend button: min 44x44 clickable area
  const legendBtn = page.locator('.layer-badge-legend-btn');
  await expect(legendBtn).toBeVisible();
  const legendBox = await legendBtn.boundingBox();
  expect(legendBox).not.toBeNull();
  expect(legendBox!.width).toBeGreaterThanOrEqual(44);
  expect(legendBox!.height).toBeGreaterThanOrEqual(44);

  // 2. Task edit pencil: min 44x44
  const taskEdit = page.getByRole('button', { name: 'Upravit zadání' });
  const editBox = await taskEdit.boundingBox();
  expect(editBox).not.toBeNull();
  expect(editBox!.width).toBeGreaterThanOrEqual(44);
  expect(editBox!.height).toBeGreaterThanOrEqual(44);

  // 3. Reconnect button: >= 44px hit height
  const reconnect = page.getByRole('button', { name: 'Zkusit připojení' });
  const reconnectBox = await reconnect.boundingBox();
  expect(reconnectBox).not.toBeNull();
  expect(reconnectBox!.height).toBeGreaterThanOrEqual(44);

  // 4. Change track button: >= 44px height
  const changeTrack = page.locator('.track-breadcrumb-change');
  const changeTrackBox = await changeTrack.boundingBox();
  expect(changeTrackBox).not.toBeNull();
  expect(changeTrackBox!.height).toBeGreaterThanOrEqual(44);

  // 5. Settings close button: min 44x44
  await page.getByRole('button', { name: 'Nastavení', exact: true }).click();
  const closeSettings = page.locator('.settings-pop .close-btn');
  await expect(closeSettings).toBeVisible();
  const closeBox = await closeSettings.boundingBox();
  expect(closeBox).not.toBeNull();
  expect(closeBox!.width).toBeGreaterThanOrEqual(44);
  expect(closeBox!.height).toBeGreaterThanOrEqual(44);
  await closeSettings.click();

  // 6. Teacher note delete: >= 32px height and >= 44px clickable target via pseudo-element
  const noteRule = await page.evaluate(() => {
    const el = document.createElement("button");
    el.className = "teacher-note-delete";
    document.body.appendChild(el);
    const style = window.getComputedStyle(el);
    const beforeStyle = window.getComputedStyle(el, "::before");
    const w = parseFloat(style.width) || parseFloat(style.minWidth);
    const h = parseFloat(style.height) || parseFloat(style.minHeight);
    const topInset = Math.abs(parseFloat(beforeStyle.top) || 0);
    const leftInset = Math.abs(parseFloat(beforeStyle.left) || 0);
    const hitW = w + leftInset * 2;
    const hitH = h + topInset * 2;
    el.remove();
    return { w, h, hitW, hitH };
  });
  expect(noteRule.w).toBeGreaterThanOrEqual(32);
  expect(noteRule.h).toBeGreaterThanOrEqual(32);
  expect(noteRule.hitW).toBeGreaterThanOrEqual(44);
  expect(noteRule.hitH).toBeGreaterThanOrEqual(44);
});

test('360x740: task card bottom is not cropped', async ({ page }) => {
  await page.setViewportSize({ width: 360, height: 740 });
  await startLesson(page);

  const container = page.locator('.hud-top-left');
  const taskCard = page.locator('.task-card');
  await expect(container).toBeVisible();
  await expect(taskCard).toBeVisible();

  const isCropped = await page.evaluate(() => {
    const cont = document.querySelector('.hud-top-left') as HTMLElement;
    const card = document.querySelector('.task-card') as HTMLElement;
    if (!cont || !card) return true;
    const contRect = cont.getBoundingClientRect();
    const cardRect = card.getBoundingClientRect();
    return cardRect.bottom > contRect.bottom + 1;
  });
  expect(isCropped, 'task card should fit within hud-top-left without cropping').toBe(false);
});

test('existing tutor bubble translates upon language change', async ({ page }) => {
  await page.setViewportSize({ width: 1024, height: 768 });
  await startLesson(page);

  const bubble = page.getByTestId('tutor-bubble');
  await expect(bubble).toBeVisible();

  // Initial greeting is in Czech
  await expect(page.getByTestId('tutor-typewriter')).toContainText('Pojďme na:');

  // Switch language to English
  await page.getByRole('button', { name: 'Nastavení', exact: true }).click();
  await page.locator('.settings-pop select').first().selectOption('en');
  await page.locator('.settings-pop .close-btn').click();

  // Bubble text should now be translated to English
  await expect(bubble).toBeVisible();
  await expect(page.getByTestId('tutor-typewriter')).toContainText('Let us do:');
});

test('offline excalidraw fonts: zero requests to esm.sh and no font CSP errors', async ({ page }) => {
  const esmRequests: string[] = [];
  const cspErrors: string[] = [];

  page.on('request', req => {
    const url = req.url();
    if (url.includes('esm.sh')) {
      esmRequests.push(url);
    }
  });

  page.on('console', msg => {
    const text = msg.text();
    if (
      msg.type() === 'error' &&
      (text.includes('Content Security Policy') || text.includes('font-src')) &&
      text.includes('font')
    ) {
      cspErrors.push(text);
    }
  });

  await page.goto('/');
  await page.getByRole('button', { name: 'Přeskočit, chci jen volnou tabuli' }).click();

  // Wait for board to be loaded
  await expect(page.locator('.excalidraw__canvas.interactive')).toBeVisible({ timeout: 15000 });

  // Give any font face requests time to fire
  await page.waitForTimeout(2000);

  expect(esmRequests, 'Zero requests should be made to esm.sh').toEqual([]);
  expect(cspErrors, 'No font CSP violations should occur').toEqual([]);
});
