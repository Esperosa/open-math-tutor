import { expect, test, type Page } from '@playwright/test';
import { existsSync, mkdirSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import type { AnalyzeBoardResponse, ContinueLessonRequest } from '@openmathtutor/shared';

/**
 * Measures how fast the tutor reacts in the real app (real Excalidraw, real pointer and keyboard events).
 * All times are taken inside the page with performance.now(): from the student's last input event to the DOM change.
 * The numbers are written to docs/latency-report.md.
 */
const REPORT = resolve(dirname(fileURLToPath(import.meta.url)), '../../../docs/latency-report.md');
const AI_DELAY = 1500;
const SAMPLES = resolve(dirname(fileURLToPath(import.meta.url)), '../test-results/latency-samples');
// Each test keeps its own sample file, so a failing test (which restarts the worker) cannot lose the others' numbers.
let samples: Record<string, number[]> = {};
const note = (name: string, ms: number) => { (samples[name] ??= []).push(Math.round(ms)); };
test.beforeEach(() => { samples = {}; });
test.afterEach(() => {
  const info = test.info();
  mkdirSync(SAMPLES, { recursive: true });
  writeFileSync(resolve(SAMPLES, `${info.title.replace(/[^a-z0-9]+/gi, '-').slice(0, 60)}.json`), JSON.stringify(samples));
});
function merged() {
  const all: Record<string, number[]> = {};
  for (const file of existsSync(SAMPLES) ? readdirSync(SAMPLES).sort() : []) {
    for (const [name, values] of Object.entries(JSON.parse(readFileSync(resolve(SAMPLES, file), 'utf8')) as Record<string, number[]>)) all[name] = values;
  }
  return all;
}
const median = (values: number[]) => [...values].sort((a, b) => a - b)[Math.floor(values.length / 2)]!;

declare global { interface Window { __lat: Record<string, number>; __arm(kind: 'key' | 'click' | 'pen'): void } }

async function instrument(page: Page) {
  await page.evaluate(() => {
    let kind: 'key' | 'click' | 'pen' = 'key';
    let baseMarks = 0, baseBubble = '', baseBubbleKind = '';
    window.__lat = {};
    window.__arm = k => {
      kind = k; window.__lat = {};
      baseMarks = document.querySelectorAll('[data-testid="step-mark-wrong"]').length;
      baseBubble = document.querySelector('[data-testid="tutor-bubble"]')?.getAttribute('data-message-id') ?? '';
      baseBubbleKind = document.querySelector('[data-testid="tutor-bubble"]')?.getAttribute('data-kind') ?? '';
    };
    const set = (name: string) => { if (window.__lat[name] === undefined && window.__lat.t0 !== undefined) window.__lat[name] = performance.now() - window.__lat.t0; };
    document.addEventListener('keydown', e => { if (kind === 'key' && e.key === 'Escape') window.__lat.t0 = performance.now(); }, true);
    // Window capture runs before the app's document capture listener, so the
    // stopwatch is running before React commits the "checking" mood.
    window.addEventListener('pointerup', () => { if (kind === 'pen') window.__lat.t0 = performance.now(); }, true);
    document.addEventListener('click', e => { if (kind === 'click' && (e.target as Element).closest('[role="menuitem"]')) window.__lat.t0 = performance.now(); }, true);
    const scan = () => {
      if (window.__lat.t0 === undefined) return;
      if (document.querySelectorAll('[data-testid="step-mark-wrong"]').length > baseMarks) set('mark');
      const mood = document.querySelector('[data-testid="tutor"]')?.getAttribute('data-mood');
      if (mood === 'checking' || mood === 'thinking') set('mascot');
      const bubble = document.querySelector('[data-testid="tutor-bubble"]');
      const id = bubble?.getAttribute('data-message-id') ?? '', bubbleKind = bubble?.getAttribute('data-kind') ?? '';
      if (bubbleKind === 'thinking') set('thinking');
      if (bubble && id !== baseBubble && bubbleKind !== 'thinking' && (id !== 'thinking')) set('bubble');
      else if (bubble && bubbleKind !== baseBubbleKind && bubbleKind !== 'thinking') set('bubble');
    };
    new MutationObserver(scan).observe(document.body, { subtree: true, childList: true, attributes: true, characterData: true });
  });
}
const start = async (page: Page) => {
  await page.goto('/');
  await page.getByRole('button', { name: 'Přeskočit, chci jen volnou tabuli', exact: true }).click();
};
const lat = (page: Page) => page.evaluate(() => ({ ...window.__lat }));

const START = '<!-- measured:start -->', END = '<!-- measured:end -->';
test.afterAll(() => {
  const rows = Object.entries(merged()).map(([name, values]) =>
    `| ${name} | ${values.length} | ${median(values)} | ${Math.min(...values)} | ${Math.max(...values)} |`);
  const table = `${START}
| Measurement | Runs | Median ms | Best ms | Worst ms |
|---|---|---|---|---|
${rows.join('\n')}
${END}`;
  mkdirSync(dirname(REPORT), { recursive: true });
  // Only the measured block is regenerated; the prose around it is written by hand.
  const old = existsSync(REPORT) ? readFileSync(REPORT, 'utf8') : '';
  const from = old.indexOf(START), to = old.indexOf(END);
  writeFileSync(REPORT, from >= 0 && to > from ? old.slice(0, from) + table + old.slice(to + END.length) : `# Latency of the live tutor\n\n${table}\n`);
});

test('a finished typed line gets its mark and the tutor comment almost at once', async ({ page }) => {
  await page.route('http://127.0.0.1:4178/**', route => route.abort('connectionrefused'));
  await start(page);
  await page.getByRole('button', { name: 'Upravit zadání' }).click();
  await page.getByRole('textbox', { name: 'Zadání', exact: true }).fill('5+1');
  await page.getByRole('button', { name: 'Hotovo', exact: true }).click();
  await instrument(page);
  for (let i = 0; i < 4; i++) {
    await page.evaluate(() => window.__arm('key'));
    await page.locator('label:has([data-testid="toolbar-text"])').click();
    await page.mouse.click(560, 330 + i * 90);
    await expect(page.locator('textarea.excalidraw-wysiwyg')).toBeFocused();
    await page.keyboard.type(`5+1=${8 + i}`);
    await page.keyboard.press('Escape');
    await page.waitForFunction(() => window.__lat.bubble !== undefined, undefined, { timeout: 5000 });
    const r = await lat(page);
    note('typed line: Escape → ✗ mark', r.mark!);
    note('typed line: Escape → tutor bubble', r.bubble!);
    expect(r.mark, 'mark').toBeLessThan(800);
    expect(r.bubble, 'bubble').toBeLessThan(800);
  }
});

test('lifting the pen is answered at once by the mascot', async ({ page }) => {
  await page.route('http://127.0.0.1:4178/**', route => route.abort('connectionrefused'));
  await start(page);
  await instrument(page);
  await page.getByTitle(/^(Kreslení|Draw) — P/).click();
  const rect = (await page.locator('.excalidraw__canvas.interactive').boundingBox())!;
  for (let i = 0; i < 3; i++) {
    await page.evaluate(() => window.__arm('pen'));
    await page.mouse.move(rect.x + 600, rect.y + 300 + i * 80);
    await page.mouse.down();
    await page.mouse.move(rect.x + 650, rect.y + 310 + i * 80, { steps: 6 });
    await expect(page.getByTestId('tutor')).toHaveAttribute('data-mood', 'watching');
    await page.mouse.up();
    await page.waitForFunction(() => window.__lat.mascot !== undefined, undefined, { timeout: 3000 });
    note('pen-up → mascot looks at the line (checking)', (await lat(page)).mascot!);
    expect((await lat(page)).mascot!).toBeLessThan(300);
    await page.waitForTimeout(900);
  }
});

test('an AI request shows the thinking state immediately and can be cancelled', async ({ page }) => {
  const asked: string[] = [];
  await page.route('http://127.0.0.1:4178/**', async route => {
    const request = route.request(), url = new URL(request.url());
    const headers = { 'Access-Control-Allow-Origin': new URL(page.url()).origin, 'Access-Control-Allow-Headers': 'content-type', 'Access-Control-Allow-Methods': 'GET, POST, OPTIONS' };
    if (request.method() === 'OPTIONS') { await route.fulfill({ status: 204, headers }); return; }
    if (url.pathname === '/health') { await route.fulfill({ json: { status: 'ok', verifier: 'ok' }, headers }); return; }
    if (url.pathname === '/providers') {
      await route.fulfill({ json: { providers: [{ id: 'codex', detect: { installed: true }, authStatus: { providerId: 'codex', authenticated: true, tutoringAvailable: true },
        models: [{ id: 'replay-model', label: 'Replay model (test only)', supportsImageInput: true }] }] }, headers }); return;
    }
    if (url.pathname.endsWith('/cancel')) { await route.fulfill({ status: 204, headers }); return; }
    const body = request.postDataJSON() as ContinueLessonRequest;
    asked.push(body.mode);
    await new Promise(resolveTimer => setTimeout(resolveTimer, AI_DELAY));
    const response: AnalyzeBoardResponse = { requestId: body.requestId, boardRevision: body.boardRevision, recognizedSteps: [], confidence: 0.9,
      firstErrorStepId: null, verifierStatus: 'ambiguous', pedagogicalResponse: 'Zkus to rozložit na menší kroky.', ttsText: 'Zkus to rozložit na menší kroky.',
      needsClarification: null, boardActions: [] };
    await route.fulfill({ json: response, headers });
  });
  await start(page);
  await page.getByRole('button', { name: 'Nastavení', exact: true }).click();
  await page.getByRole('combobox', { name: 'Poskytovatel', exact: true }).selectOption('codex');
  await page.getByRole('combobox', { name: 'Model', exact: true }).selectOption('replay-model');
  await page.getByRole('button', { name: 'Nastavení', exact: true }).click();
  await instrument(page);
  for (let i = 0; i < 3; i++) {
    await page.evaluate(() => window.__arm('click'));
    await page.getByRole('button', { name: 'Učitel', exact: true }).click();
    await page.getByRole('menuitem', { name: 'Poradit', exact: true }).click();
    await page.waitForFunction(() => window.__lat.bubble !== undefined, undefined, { timeout: 8000 });
    const r = await lat(page);
    note('AI request: click → "thinking" bubble', r.thinking!);
    note('AI request: click → mascot thinks', r.mascot!);
    note(`AI request: click → answer in bubble (mock answers after ${AI_DELAY} ms)`, r.bubble!);
    expect(r.thinking, 'thinking').toBeLessThan(300);
    expect(r.bubble! - AI_DELAY, 'overhead on top of the AI').toBeLessThan(800);
  }
  // Cancel works from the bubble itself.
  await page.getByRole('button', { name: 'Učitel', exact: true }).click();
  await page.getByRole('menuitem', { name: 'Poradit', exact: true }).click();
  await page.getByRole('button', { name: 'Zrušit', exact: true }).click();
  await expect(page.getByTestId('tutor')).not.toHaveAttribute('data-mood', 'thinking');
  expect(asked.length).toBeGreaterThanOrEqual(3);
});
