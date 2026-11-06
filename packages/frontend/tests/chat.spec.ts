import { expect, test, type Page } from '@playwright/test';
import type { AnalyzeBoardResponse, ContinueLessonRequest } from '@openmathtutor/shared';

const HUD = '.hud-top-left, .hud-top-right, .rail, .drawer.open, .settings-pop.open, .calculator, .excalidraw .Island, .excalidraw footer';
// The coach picks one of three wordings for an arithmetic slip.
const WRONG_LINE = /nesčítá|nesedí|chyba v počítání/;
const chat = (page: Page) => page.getByTestId('chat');
const log = (page: Page) => page.getByTestId('chat-log');

async function start(page: Page) {
  await page.goto('/');
  await page.getByRole('button', { name: 'Přeskočit, chci jen volnou tabuli', exact: true }).click();
}
async function openChat(page: Page) {
  await page.getByRole('button', { name: 'Povídat si s učitelem', exact: true }).click();
  await expect(chat(page)).toBeVisible();
}
async function typeMessage(page: Page, text: string) {
  const open = page.getByRole('button', { name: 'Napsat zprávu', exact: true });
  if (await open.count()) await open.click();
  const input = page.getByRole('textbox', { name: 'Zpráva učiteli', exact: true });
  await input.fill(text);
  await input.press('Enter');
}
/** The window sits inside the viewport and never covers the toolbars, the rail, the task card or the board controls. */
async function expectClear(page: Page) {
  const ok = await chat(page).evaluate((el, selector) => {
    const r = el.getBoundingClientRect();
    const inside = r.left >= 0 && r.top >= 0 && r.right <= window.innerWidth && r.bottom <= window.innerHeight;
    const clear = [...document.querySelectorAll(selector)].every(c => {
      const b = c.getBoundingClientRect();
      const s = getComputedStyle(c);
      return !b.width || !b.height || s.visibility === 'hidden' || s.opacity === '0' || !(r.left < b.right && r.right > b.left && r.top < b.bottom && r.bottom > b.top);
    });
    return inside && clear;
  }, HUD);
  expect(ok).toBe(true);
}

interface Bridge { requests: ContinueLessonRequest[]; cancelled: string[] }
async function mockBridge(page: Page, answerAfterMs = 0): Promise<Bridge> {
  const seen: Bridge = { requests: [], cancelled: [] };
  await page.route('http://127.0.0.1:4178/**', async route => {
    const request = route.request(), url = new URL(request.url());
    const headers = { 'Access-Control-Allow-Origin': new URL(page.url()).origin, 'Access-Control-Allow-Headers': 'content-type', 'Access-Control-Allow-Methods': 'GET, POST, OPTIONS' };
    if (request.method() === 'OPTIONS') { await route.fulfill({ status: 204, headers }); return; }
    if (url.pathname === '/health') { await route.fulfill({ json: { status: 'ok', verifier: 'ok' }, headers }); return; }
    if (url.pathname === '/providers') {
      await route.fulfill({ json: { providers: [{ id: 'codex', detect: { installed: true }, authStatus: { providerId: 'codex', authenticated: true, tutoringAvailable: true },
        models: [{ id: 'replay-model', label: 'Replay model (test only)', supportsImageInput: true }] }] }, headers }); return;
    }
    if (url.pathname.endsWith('/cancel')) { seen.cancelled.push((request.postDataJSON() as { requestId: string }).requestId); await route.fulfill({ status: 204, headers }); return; }
    const body = request.postDataJSON() as ContinueLessonRequest;
    seen.requests.push(body);
    await new Promise(resolve => setTimeout(resolve, answerAfterMs));
    const text = body.mode === 'explain_differently' ? 'Představ si zlomek jako pizzu.' : 'Znaménko se mění, protože odečítáš na obou stranách.';
    const response: AnalyzeBoardResponse = { requestId: body.requestId, boardRevision: body.boardRevision, recognizedSteps: [], confidence: 0.9, firstErrorStepId: null,
      verifierStatus: 'ambiguous', pedagogicalResponse: text, ttsText: text, needsClarification: null, boardActions: [] };
    await route.fulfill({ json: response, headers }).catch(() => {});
  });
  return seen;
}
async function connect(page: Page) {
  await page.getByRole('button', { name: 'Nastavení', exact: true }).click();
  await page.getByRole('combobox', { name: 'Poskytovatel', exact: true }).selectOption('codex');
  await page.getByRole('combobox', { name: 'Model', exact: true }).selectOption('replay-model');
  await page.getByRole('button', { name: 'Nastavení', exact: true }).click();
}

test.describe('without an AI', () => {
  test.beforeEach(async ({ page }) => { await page.route('http://127.0.0.1:4178/**', route => route.abort('connectionrefused')); });

  test('the conversation opens ready to type: chips answer everyday questions locally, the rest is honestly "AI missing"', async ({ page }) => {
    await start(page);
    await expect(chat(page)).toHaveCount(0);
    await openChat(page);
    // main deliberately opens the composer by default (faf4292).
    await expect(page.getByRole('textbox', { name: 'Zpráva učiteli', exact: true })).toBeFocused();
    await page.getByRole('button', { name: 'Co znamená ✓ a ✗?', exact: true }).click();
    await expect(log(page)).toContainText('řádku vidíš');
    await typeMessage(page, 'Proč se mění znaménko?');
    await expect(log(page)).toContainText('AI učitel teď není připojený');
    await expect(log(page)).toContainText('Proč se mění znaménko?');
    await expectClear(page);
    await page.screenshot({ path: 'test-results/chat-offline.png' });
    await page.getByRole('button', { name: 'Sbalit rozhovor', exact: true }).click();
    await expect(chat(page)).toHaveCount(0);
  });

  test('a wrong line is part of the thread; the thread is kept per board and survives a reload', async ({ page }) => {
    await start(page);
    await page.getByRole('button', { name: 'Upravit zadání' }).click();
    await page.getByRole('textbox', { name: 'Zadání', exact: true }).fill('5+1');
    await page.getByRole('button', { name: 'Hotovo', exact: true }).click();
    await page.locator('label:has([data-testid="toolbar-text"])').click();
    await page.mouse.click(560, 360);
    await page.keyboard.type('5+1=8'); await page.keyboard.press('Escape');
    await expect(page.getByTestId('tutor-bubble')).toHaveAttribute('data-kind', 'wrong');
    await openChat(page);
    await expect(log(page)).toContainText(WRONG_LINE);
    // Offline, the offered chips are the local ones.
    await expect(chat(page).getByRole('button', { name: 'Nápověda', exact: true })).toBeVisible();
    await expect(chat(page).getByRole('button', { name: 'Vysvětli jinak', exact: true })).toHaveCount(0);
    await chat(page).getByRole('button', { name: 'Nápověda', exact: true }).click();
    await page.reload();
    await openChat(page);
    await expect(log(page)).toContainText(WRONG_LINE);
    // A new exercise starts a clean thread; the old one is back when the exercise is selected again.
    await page.getByRole('button', { name: 'Učitel', exact: true }).click();
    await page.getByRole('menuitem', { name: 'Vlastní příklad', exact: true }).click();
    await expect(chat(page)).toBeVisible(); // closing the tutor menu brings the open conversation back
    await expect(log(page)).not.toContainText(WRONG_LINE);
    await page.getByRole('button', { name: 'Sbalit rozhovor', exact: true }).click();
    await page.getByRole('button', { name: 'Cvičení', exact: true }).hover();
    await page.getByRole('combobox', { name: 'Cvičení', exact: true }).selectOption({ index: 0 });
    await page.keyboard.press('Escape');
    await page.mouse.move(700, 500);
    await openChat(page);
    await expect(log(page)).toContainText(WRONG_LINE);
  });

  test('the window yields to every drawer and stays on screen on a phone', async ({ page }) => {
    await start(page);
    await openChat(page);
    await page.getByRole('button', { name: 'Plán a cesta', exact: true }).click();
    await expect(chat(page)).toHaveCount(0);
    // Closing the drawer brings the conversation back where it was.
    await page.keyboard.press('Escape');
    await expect(chat(page)).toBeVisible();
    await page.mouse.move(700, 500); // the rail opens its drawer on hover: keep the pointer away from it
    await page.setViewportSize({ width: 390, height: 844 });
    await expectClear(page);
    await page.getByRole('button', { name: 'Zvětšit okno rozhovoru', exact: true }).click();
    await expectClear(page);
    await page.screenshot({ path: 'test-results/chat-phone.png' });
  });

  test('push-to-talk turns speech into a message in the thread', async ({ page }) => {
    await page.addInitScript(() => {
      class FakeRecognition {
        lang = ''; interimResults = false; maxAlternatives = 1;
        onresult: ((e: unknown) => void) | null = null; onend: (() => void) | null = null; onerror: (() => void) | null = null;
        start() { setTimeout(() => { this.onresult?.({ results: [[{ transcript: 'jak smažu řádek' }]] }); this.onend?.(); }, 150); }
        stop() { this.onend?.(); }
      }
      (window as unknown as { SpeechRecognition: unknown }).SpeechRecognition = FakeRecognition;
    });
    await start(page);
    await openChat(page);
    await page.getByRole('button', { name: 'Mluvit', exact: true }).click();
    await expect(log(page)).toContainText('jak smažu řádek');
    await expect(log(page)).toContainText('Řádek smažeš přepsáním');
  });
});

test.describe('with an AI', () => {
  test('free questions carry a short conversation context, answers land in the thread, chips ask follow-ups', async ({ page }) => {
    const bridge = await mockBridge(page);
    await start(page); await connect(page);
    await openChat(page);
    await page.getByRole('button', { name: 'Co znamená ✓ a ✗?', exact: true }).click();
    await typeMessage(page, 'Proč se mění znaménko?');
    await expect(log(page)).toContainText('Znaménko se mění, protože odečítáš');
    expect(bridge.requests).toHaveLength(1);
    const ask = bridge.requests[0]!;
    expect(ask.mode).toBe('ask');
    expect(ask.studentMessage).toBe('Proč se mění znaménko?');
    expect(ask.conversation?.some(turn => turn.role === 'tutor' && /řádku vidíš/.test(turn.text))).toBe(true);
    expect(ask.conversation?.length).toBeLessThanOrEqual(8);
    expect(ask.conversation?.every(turn => turn.text.length <= 400)).toBe(true);
    // The student's own question is the message, not part of the context.
    expect(ask.conversation?.some(turn => turn.text === 'Proč se mění znaménko?')).toBe(false);
    // After an AI answer the chips are the follow-ups.
    await expect(page.getByRole('button', { name: 'Nechápu', exact: true })).toBeVisible();
    await page.getByRole('button', { name: 'Nechápu', exact: true }).click();
    await expect(log(page)).toContainText('Představ si zlomek jako pizzu');
    expect(bridge.requests[1]!.mode).toBe('explain_differently');
    expect(bridge.requests[1]!.conversation?.some(turn => /Znaménko se mění/.test(turn.text))).toBe(true);
  });

  test('"Chápu" needs no AI; a slow request can be cancelled from the conversation', async ({ page }) => {
    const bridge = await mockBridge(page, 8000);
    await start(page); await connect(page);
    await openChat(page);
    await typeMessage(page, 'Proč se mění znaménko?');
    await expect(page.getByTestId('chat-typing')).toBeVisible();
    await expect(page.getByRole('button', { name: 'Chápu', exact: true })).toHaveCount(0); // chips wait while the teacher thinks
    await page.getByTestId('chat-typing').getByRole('button', { name: 'Zrušit', exact: true }).click();
    await expect(page.getByTestId('chat-typing')).toHaveCount(0);
    await expect.poll(() => bridge.cancelled.length).toBe(1);
    await expect(page.getByTestId('tutor')).not.toHaveAttribute('data-mood', 'thinking');
  });

  test('an answer that is a bubble can be answered with one tap, without opening the chat', async ({ page }) => {
    const bridge = await mockBridge(page);
    await start(page); await connect(page);
    await page.getByRole('button', { name: 'Učitel', exact: true }).click();
    await page.getByRole('menuitem', { name: 'Poradit', exact: true }).click();
    const bubble = page.getByTestId('tutor-bubble');
    await expect(bubble).toContainText('Znaménko se mění');
    await bubble.getByRole('button', { name: 'Chápu', exact: true }).click();
    await expect(bubble).toContainText('Super!');
    expect(bridge.requests).toHaveLength(1);
  });
});
