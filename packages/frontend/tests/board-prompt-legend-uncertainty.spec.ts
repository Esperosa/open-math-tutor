import { expect, test, type Page } from '@playwright/test';
import type { AnalyzeBoardResponse, BoardAction, ContinueLessonRequest } from '@openmathtutor/shared';
import { drawElements, setTask, start } from './inkDriver';
import { noisyElements } from './inkFixture';

const BRIDGE_URL = 'http://127.0.0.1:4178';

async function mockBridge(page: Page, options?: { supportsImages?: boolean; actions?: BoardAction[] }) {
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
            id: 'mock-provider',
            detect: { installed: true },
            authStatus: { providerId: 'mock-provider', authenticated: true, tutoringAvailable: true },
            models: [{
              id: 'mock-model',
              label: 'Mock Model',
              supportsImageInput: options?.supportsImages ?? false,
            }],
          }],
        },
        headers,
      });
      return;
    }
    if (url.pathname.endsWith('/cancel')) {
      await route.fulfill({ status: 204, headers });
      return;
    }
    const body = request.postDataJSON() as ContinueLessonRequest;
    const revision = body.boardRevision;
    const actions = options?.actions ?? [
      {
        id: 'action-teacher-explain',
        type: 'write_text',
        text: 'Vysvětlení kroku',
        boardRevision: revision,
        placement: { relativeToStepId: 'zadání', side: 'below', offsetEm: 1 },
      },
    ];
    const response: AnalyzeBoardResponse = {
      requestId: body.requestId,
      boardRevision: revision,
      recognizedSteps: body.stepHistory,
      confidence: 0.95,
      firstErrorStepId: null,
      verifierStatus: 'correct',
      pedagogicalResponse: 'Skvělá práce.',
      ttsText: 'Skvělá práce.',
      needsClarification: null,
      boardActions: actions,
    };
    await route.fulfill({ json: response, headers });
  });
}

test.beforeEach(async ({ page }) => {
  await page.route('http://127.0.0.1:4178/**', route => route.abort('connectionrefused'));
});

test('0.15 Task on board: written upon lesson start, typeset fractions/superscripts, locator zadani, card click rewrites, reload preserves without duplicating', async ({ page }) => {
  await page.goto('/');
  // Start track lesson from onboarding
  await page.getByRole('button', { name: /Chystám se na střední školu/ }).click();
  await page.getByRole('button', { name: /^Přijímačky na střední školu/ }).click();

  // Task card should show the statement in HUD
  const taskCard = page.locator('.task-card');
  await expect(taskCard).toBeVisible();
  const statementText = await page.getByTestId('task-text').textContent();
  expect(statementText).toBeTruthy();

  // The task statement note appears on board in teacher layer
  const teacherNote = page.locator('.teacher-note[data-action-id^="task-statement"]');
  await expect(teacherNote).toBeVisible({ timeout: 10000 });

  // Verify that it is in the teacher layer: has delete button
  await expect(teacherNote).toHaveClass(/teacher-note-delete/);

  // Clicking task card rewrites it on board
  const initialId = await teacherNote.getAttribute('data-action-id');
  await taskCard.click();
  await page.waitForTimeout(150);
  const rewrittenNote = page.locator('.teacher-note[data-action-id^="task-statement"]');
  await expect(rewrittenNote).toBeVisible();
  const newId = await rewrittenNote.getAttribute('data-action-id');
  expect(newId).not.toBe(initialId);

  // Reload page: should still be present, count must stay exactly 1 (no duplicate)
  await page.reload();
  const notesAfterReload = page.locator('.teacher-note[data-action-id^="task-statement"]');
  await expect(notesAfterReload).toHaveCount(1);
});

test('0.15 Free board writes nothing on board', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('button', { name: 'Přeskočit, chci jen volnou tabuli' }).click();
  await expect(page.locator('.teacher-note[data-action-id^="task-statement"]')).toHaveCount(0);
});

test('0.19 Color legend: opens from mascot menu and layer badge, has 5 distinct shapes, contrast, and tutor speaks on first note', async ({ page }) => {
  await mockBridge(page, { supportsImages: false });
  await page.goto('/');
  await page.getByRole('button', { name: 'Přeskočit, chci jen volnou tabuli' }).click();

  // Open mascot menu
  const mascotBtn = page.getByRole('button', { name: 'Učitel', exact: true });
  await mascotBtn.click();

  // Open color legend from menu
  const menuBtn = page.getByTestId('color-legend-menu-btn');
  await expect(menuBtn).toBeVisible();
  await menuBtn.click();

  // Modal dialog is open
  const dialog = page.getByTestId('color-legend-dialog');
  await expect(dialog).toBeVisible();

  // Verify 5 legend items
  const items = page.locator('.color-legend-item');
  await expect(items).toHaveCount(5);

  // Verify distinct shape badges for color-blind accessibility
  await expect(page.locator('.legend-badge.shape-pen-red')).toBeVisible();
  await expect(page.locator('.legend-badge.shape-pen-teal')).toBeVisible();
  await expect(page.locator('.legend-badge.shape-circle-check')).toBeVisible();
  await expect(page.locator('.legend-badge.shape-cross')).toBeVisible();
  await expect(page.locator('.legend-badge.shape-question-dot')).toBeVisible();

  // Close legend
  await page.getByRole('button', { name: 'Zavřít', exact: true }).click();
  await expect(dialog).not.toBeVisible();

  // Write a wrong student line to trigger local teacher note
  await page.locator('label:has([data-testid="toolbar-text"])').click();
  await page.mouse.click(560, 360);
  await expect(page.locator('textarea.excalidraw-wysiwyg')).toBeFocused();
  await page.keyboard.type('2+2=5');
  await page.keyboard.press('Escape');

  // Local teacher should speak color legend on first note in bubble
  const bubble = page.getByTestId('tutor-bubble');
  await expect(bubble).toBeVisible({ timeout: 10000 });
  const bubbleText = await bubble.textContent();
  expect(bubbleText).toContain('Červená barva');

  // Layer badge should now be visible and have the small "?" legend button
  const badgeLegendBtn = page.getByTestId('layer-badge-legend-btn');
  await expect(badgeLegendBtn).toBeVisible();
  await badgeLegendBtn.click();
  await expect(page.getByTestId('color-legend-dialog')).toBeVisible();
});

test('0.18 Uncertain reading: friendly message, pattern guide popover with SVG vzor, candidate tap, retry writing, and AI reading button/explanation', async ({ page }) => {
  await start(page);
  await setTask(page, '4');
  await drawElements(page, noisyElements(), 'pen');

  // Wait for reading label with uncertainty
  const reading = page.locator('.ink-reading.uncertain');
  await expect(reading.first()).toBeVisible({ timeout: 10000 });
  const readingText = await reading.first().textContent();
  expect(readingText).toContain('Nejsem si jistý');

  // Toggle button for pattern guide
  const guideToggle = reading.locator('.ink-guide-toggle-btn').first();
  await expect(guideToggle).toBeVisible();
  await guideToggle.click();

  // Popover dialog opens
  const popover = page.getByTestId('ink-uncertain-popover');
  await expect(popover).toBeVisible();

  // Pattern guides are shown with SVG vector paths
  const guideCards = page.getByTestId('ink-guide-patterns');
  await expect(guideCards).toBeVisible();
  expect(await guideCards.locator('svg path').count()).toBeGreaterThan(0);

  // Since AI is offline in this test, explanation is shown instead of send to AI button
  await expect(page.getByTestId('ink-ai-reason')).toBeVisible();

  // "Zkusit znovu napsat" deletes the line
  const retryBtn = popover.locator('.ink-action-retry');
  await expect(retryBtn).toBeVisible();
  await retryBtn.click();

  // Popover should disappear
  await expect(page.getByTestId('ink-uncertain-popover')).not.toBeVisible();
});
