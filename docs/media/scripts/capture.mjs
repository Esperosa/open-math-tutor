/** Genuine UI captures, no route mocks, storage fixtures, or application test hooks.
 * Run from any cwd: node docs/media/scripts/capture.mjs [--only=01,02,...,08]
 * Requires the three README services, Playwright Chromium, ffmpeg and ffprobe.
 */
import { chromium, expect } from '@playwright/test';
import { mkdir, mkdtemp, readFile, writeFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { execFileSync } from 'node:child_process';
import { drawLine } from './ink.mjs';

const OUT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const BASE_URL = process.env.BASE_URL || process.argv.find(a => a.startsWith('--base-url='))?.split('=')[1] || (process.env.PORT ? `http://localhost:${process.env.PORT}` : 'http://localhost:5173');
const only = process.argv.find(a => a.startsWith('--only='))?.split('=')[1].split(',');
const aiAttempts = Number(process.argv.find(a => a.startsWith('--ai-attempts='))?.split('=')[1] ?? 3);
if (!Number.isInteger(aiAttempts) || aiAttempts < 1 || aiAttempts > 3) throw new Error('ai_attempts_must_be_1_to_3');
const FFMPEG = process.env.FFMPEG || 'ffmpeg';
const FFPROBE = process.env.FFPROBE || 'ffprobe';
for (const binary of [FFMPEG, FFPROBE]) execFileSync(binary, ['-version'], { stdio: 'ignore', windowsHide: true });
const pause = (p, ms = 1500) => p.waitForTimeout(ms);
const button = (p, name) => p.getByRole('button', { name, exact: true });
const bubble = p => p.getByTestId('tutor-bubble');
const unsafe = /(?:[A-Z]:[\\/]|\\Users\\|\/Users\/|\/home\/|[\w.+-]+@[\w.-]+\.[a-z]{2,}|sk-ant-|sk-proj-|Bearer\s)/i;
const reportPath = join(OUT, 'capture-report.json');
let report = { baseURL: BASE_URL, viewport: { width: 1280, height: 720 }, runs: {} };
try { report = JSON.parse(await readFile(reportPath, 'utf8')); } catch { /* first run */ }
await mkdir(OUT, { recursive: true });
await mkdir(join(OUT, 'exports'), { recursive: true });
const temp = await mkdtemp(join(tmpdir(), 'omt-media-'));
const browser = await chromium.launch({ headless: true });

async function act(p, locator, ms = 1500) {
  await locator.click(); await p.mouse.move(900, 640); await pause(p, ms);
}
async function clean(p) {
  await p.goto(BASE_URL);
  await expect(p.getByRole('heading', { name: 'Na co se připravuješ?' })).toBeVisible();
}
async function free(p) {
  await clean(p);
  await act(p, button(p, 'Přeskočit, chci jen volnou tabuli'), 700);
}
async function course(p, science = false) {
  await clean(p);
  await act(p, p.getByRole('button', { name: science ? /fyziku nebo chemii/ : /Chystám se na střední školu/ }), 700);
  await act(p, p.getByRole('button', { name: science ? /^Fyzika/ : /^Přijímačky na střední školu/ }), 1000);
  await expect(p.locator('.excalidraw__canvas.interactive')).toBeVisible();
}
async function setTask(p, text) {
  await act(p, button(p, 'Upravit zadání'), 500);
  const field = p.getByRole('textbox', { name: 'Zadání', exact: true });
  await field.fill(''); await field.pressSequentially(text, { delay: 80 });
  await pause(p, 500); await act(p, button(p, 'Hotovo'), 600);
}
async function shot(p, name) {
  await p.evaluate(() => document.fonts.ready);
  if (unsafe.test(await p.locator('body').innerText())) throw new Error('privacy_check_failed');
  await p.screenshot({ path: join(OUT, `${name}.png`) });
}
async function showMenu(p) {
  await expect(p.getByTestId('tutor-hud')).toHaveAttribute('data-visiting', 'false', { timeout: 15000 });
  await expect(p.getByTestId('tutor-hud')).toHaveAttribute('data-returning', 'false', { timeout: 15000 });
  await act(p, button(p, 'Učitel'));
}
function probe(path) {
  return JSON.parse(execFileSync(FFPROBE, ['-v', 'error', '-show_streams', '-show_format', '-of', 'json', path], { encoding: 'utf8', windowsHide: true }));
}
function encode(raw, name, segments, cutWait) {
  let filter = segments.map(([a, b], i) => `[0:v]trim=start=${a.toFixed(3)}:end=${b.toFixed(3)},setpts=PTS-STARTPTS[v${i}]`).join(';');
  filter += `;${segments.map((_, i) => `[v${i}]`).join('')}concat=n=${segments.length}:v=1:a=0,fps=25,scale=1280:720,setsar=1[v]`;
  for (const ext of ['mp4', 'webm']) {
    const codec = ext === 'mp4' ? ['-c:v', 'libx264', '-preset', 'medium', '-crf', '28', '-pix_fmt', 'yuv420p', '-movflags', '+faststart']
      : ['-c:v', 'libvpx-vp9', '-crf', '36', '-b:v', '0', '-row-mt', '1'];
    execFileSync(FFMPEG, ['-hide_banner', '-loglevel', 'error', '-y', '-i', raw, '-filter_complex', filter, '-map', '[v]', '-an', ...codec, '-threads', '4', join(OUT, `${name}.${ext}`)], { windowsHide: true });
  }
  return { durationSeconds: Number(probe(join(OUT, `${name}.mp4`)).format.duration), shortenedAIWait: cutWait };
}

const scenarios = [
  ['01', '01-first-lesson', async (p, t) => {
    await clean(p); t.begin(); await pause(p, 1200);
    await shot(p, '01-onboarding');
    await act(p, p.getByRole('button', { name: /Chystám se na střední školu/ }), 1600);
    await act(p, p.getByRole('button', { name: /^Přijímačky na střední školu/ }), 2600);
    await expect(bubble(p)).toBeVisible({ timeout: 10000 });
    await shot(p, '03-lesson-light');
    await shot(p, 'shot-01-first-lesson');
    await act(p, button(p, 'Kurzy'), 1000);
    await p.getByRole('combobox', { name: 'Kurz', exact: true }).selectOption({ label: 'Přijímačky na střední školu' });
    await pause(p, 800);
    await p.getByRole('combobox', { name: 'Téma kurzu', exact: true }).selectOption({ label: 'Základy čísel' });
    await pause(p, 1200);
    await shot(p, '02-courses');
    await p.keyboard.press('Escape');
    await pause(p, 2000);
    t.end();
  }],
  ['02', '02-handwriting-check', async (p, t) => {
    await free(p); await setTask(p, '2x + 3 = 7');
    t.begin(); await pause(p, 1000);
    await drawLine(p, '2x = 6', 15, [420, 260], 'pen', 3);
    const reading = p.locator('.ink-reading');
    await reading.first().waitFor({ timeout: 10000 });
    await shot(p, 'shot-02-handwriting');
    await expect(p.getByTestId('step-mark-wrong')).toBeVisible({ timeout: 10000 });
    await expect(bubble(p)).toHaveAttribute('data-kind', 'wrong', { timeout: 10000 });
    await expect(p.locator('.teacher-note-delete').first()).toBeVisible({ timeout: 10000 });
    await pause(p, 2200);
    await shot(p, '04-local-coach');
    await shot(p, 'shot-03-teacher-board');
    await pause(p, 800);
    await drawLine(p, 'x = 2', 37, [420, 360], 'pen', 3);
    await expect(p.getByTestId('step-mark-ok')).toBeVisible({ timeout: 10000 });
    await expect(bubble(p)).toHaveAttribute('data-kind', 'solved', { timeout: 10000 });
    await pause(p, 2000);
    t.end();
    if (t.aiRequests.length) throw new Error('local_scenario_called_ai');
  }],
  ['03', '03-ai-teacher-writes', async (p, t) => {
    await free(p);
    await act(p, button(p, 'Nastavení'), 500);
    await expect(p.getByRole('combobox', { name: 'Poskytovatel', exact: true }).locator('option[value="claude"]')).toBeAttached({ timeout: 15000 });
    await p.getByRole('combobox', { name: 'Poskytovatel', exact: true }).selectOption('claude');
    await p.getByRole('combobox', { name: 'Model', exact: true }).selectOption('sonnet');
    await p.keyboard.press('Escape'); await pause(p, 500);
    await setTask(p, '2x + 3 = 7');
    t.begin(); await pause(p, 900);
    await drawLine(p, '2x = 6', 15, [420, 260], 'pen', 3);
    const reading = p.locator('.ink-reading');
    await reading.first().waitFor({ timeout: 10000 });
    await showMenu(p);
    await shot(p, '08-tutor-menu');
    const responsePromise = p.waitForResponse(
      r => r.url().endsWith('/providers/claude/continue-lesson') && r.request().method() === 'POST',
      { timeout: 45000 }
    );
    t.requestAt = t.now();
    await act(p, p.getByRole('menuitem', { name: 'Poradit', exact: true }), 500);
    const r = await responsePromise;
    t.responseAt = t.now();
    const body = await r.json();
    t.evidence = {
      provider: 'claude',
      model: 'sonnet',
      status: r.status(),
      boardActionTypes: body.boardActions?.map(a => a.type) ?? [],
      responseSeconds: +(t.responseAt - t.requestAt).toFixed(2),
    };
    if (!r.ok()) throw new Error(`ai_http_${r.status()}`);
    if (!body.boardActions || body.boardActions.length === 0) throw new Error('ai_no_written_hint');
    await expect(p.locator('.teacher-note-delete').first()).toBeVisible({ timeout: 10000 });
    await pause(p, 3000);
    t.end();
  }],
  ['04', '04-chat', async (p, t) => {
    await free(p);
    await act(p, button(p, 'Nastavení'), 500);
    await p.getByRole('combobox', { name: 'Poskytovatel', exact: true }).selectOption('claude');
    await p.getByRole('combobox', { name: 'Model', exact: true }).selectOption('sonnet');
    await p.keyboard.press('Escape'); await pause(p, 500);
    t.begin(); await pause(p, 800);
    await act(p, p.getByRole('button', { name: 'Povídat si s učitelem', exact: true }), 1000);
    await expect(p.getByTestId('chat')).toBeVisible({ timeout: 5000 });
    await act(p, p.getByRole('button', { name: 'Co znamená ✓ a ✗?', exact: true }), 1500);
    await expect(p.getByTestId('chat-log')).toContainText('vidíš', { timeout: 5000 });
    const input = p.getByRole('textbox', { name: 'Zpráva učiteli', exact: true });
    await input.click();
    await input.pressSequentially('Proč se mění znaménko?', { delay: 60 });
    await pause(p, 400);
    const responsePromise = p.waitForResponse(
      r => r.url().endsWith('/providers/claude/continue-lesson') && r.request().method() === 'POST',
      { timeout: 45000 }
    );
    t.requestAt = t.now();
    await input.press('Enter');
    const r = await responsePromise;
    t.responseAt = t.now();
    t.evidence = { provider: 'claude', model: 'sonnet', chatResponseSeconds: +(t.responseAt - t.requestAt).toFixed(2) };
    await pause(p, 2000);
    await shot(p, 'shot-04-chat-thread');
    await pause(p, 1500);
    t.end();
  }],
  ['05', '05-plan-progress', async (p, t) => {
    await course(p); await pause(p, 2000);
    t.begin(); await act(p, button(p, 'Plán a cesta'), 1800);
    await expect(p.getByTestId('plan-percent')).toHaveText('0 %');
    await shot(p, '06-plan');
    await shot(p, 'shot-05-plan-progress');
    const percentages = ['0 %'];
    const topicPercentages = [await p.locator('.plan-topic-head small').first().innerText()];
    await p.keyboard.press('Escape'); await pause(p, 800);
    for (let i = 0; i < 2; i++) {
      const task = (await p.getByTestId('task-text').innerText()).trim();
      const m = /^(-?\d+)([+-])(\d+)$/.exec(task);
      if (!m) throw new Error('unexpected_arithmetic_task');
      const result = m[2] === '+' ? +m[1] + +m[3] : +m[1] - +m[3];
      await drawLine(p, `${task} = ${result}`, 11 + i * 17, [420, 260], 'pen', 3);
      await expect(bubble(p)).toHaveAttribute('data-kind', 'solved', { timeout: 10000 });
      await act(p, button(p, 'Plán a cesta'), 1500);
      const percent = await p.getByTestId('plan-percent').innerText();
      const topicPercent = await p.locator('.plan-topic-head small').first().innerText();
      if (topicPercent === topicPercentages.at(-1)) throw new Error('topic_progress_unchanged');
      percentages.push(percent);
      topicPercentages.push(topicPercent);
      if (i === 0) {
        await p.keyboard.press('Escape'); await pause(p, 600);
        await act(p, button(p, 'Další příklad'), 800);
      }
    }
    await pause(p, 1200);
    t.end();
    t.evidence = { percentages, topicPercentages, localOnly: t.aiRequests.length === 0 };
  }],
  ['06', '06-physics-units', async (p, t) => {
    await course(p, true); await pause(p, 2500);
    const task = await p.getByTestId('task-text').innerText();
    const m = /ujede (\d+) m za (\d+) s/.exec(task);
    if (!m) throw new Error('unexpected_physics_task');
    t.begin(); await pause(p, 1000);
    await drawLine(p, `${m[1]} m`, 7, [420, 240], 'pen', 3);
    await pause(p, 500);
    await drawLine(p, `${m[2]} s`, 13, [420, 300], 'pen', 3);
    await pause(p, 500);
    const v = Math.round(+m[1] / +m[2] * 1000) / 1000;
    await drawLine(p, `${m[1]}/${m[2]}=${v} m/s`, 29, [420, 360], 'pen', 3);
    await expect(bubble(p)).toHaveAttribute('data-kind', 'solved', { timeout: 10000 });
    await pause(p, 1500);
    await shot(p, '07-physics');
    await shot(p, 'shot-06-physics-units');
    await pause(p, 1500);
    t.end();
    if (t.aiRequests.length) throw new Error('local_scenario_called_ai');
  }],
  ['07', '07-test-and-export', async (p, t) => {
    await course(p); await setTask(p, '2x + 3 = 7');
    await drawLine(p, '2x = 4', 21, [420, 260], 'pen', 3);
    t.begin(); await act(p, button(p, 'Plán a cesta'), 900);
    await p.getByRole('combobox', { name: 'Z čeho', exact: true }).scrollIntoViewIfNeeded();
    await pause(p, 1200);
    const testDownload = p.waitForEvent('download');
    await act(p, button(p, 'Stáhnout test (HTML)'), 1500);
    const testFile = await testDownload;
    if (testFile.suggestedFilename() !== 'test.html') throw new Error('wrong_test_filename');
    await testFile.saveAs(join(OUT, 'exports', 'test.html'));
    const html = await readFile(join(OUT, 'exports', 'test.html'), 'utf8');
    if (!html.includes('Klíč správných odpovědí') || unsafe.test(html)) throw new Error('test_content_check_failed');
    await p.keyboard.press('Escape'); await pause(p, 800);
    await act(p, button(p, 'Zápisky a pokrok'), 1500);
    const mdDownload = p.waitForEvent('download');
    await act(p, button(p, 'Stáhnout zápisky (.md)'), 1400);
    await (await mdDownload).saveAs(join(OUT, 'exports', 'zapisky.md'));
    const pngDownload = p.waitForEvent('download');
    await act(p, button(p, 'Tabule jako PNG'), 1400);
    await (await pngDownload).saveAs(join(OUT, 'exports', 'tabule.png'));
    await p.keyboard.press('Escape'); await pause(p, 800);
    await p.setContent(html);
    await pause(p, 1200);
    await shot(p, 'shot-07-test-export');
    await pause(p, 1200);
    t.end();
    t.evidence = { downloads: ['test.html', 'zapisky.md', 'tabule.png'], testHasAnswerKey: true };
  }],
  ['08', '08-settings-paper-voices', async (p, t) => {
    await free(p); await setTask(p, '2x + 3 = 7');
    await drawLine(p, '2x = 4', 21, [420, 260], 'pen', 3);
    await act(p, button(p, 'Nastavení'), 500);
    t.begin(); await pause(p, 800);
    for (const pattern of ['grid', 'lines', 'dots', 'school', 'plain']) {
      await p.locator(`.pattern-picker [data-pattern="${pattern}"]`).click();
      await pause(p, 700);
    }
    await act(p, button(p, 'Tmavý režim'), 800);
    await shot(p, 'shot-08-settings-paper');
    await p.keyboard.press('Escape'); await pause(p, 800);
    await shot(p, '09-board-dark');
    await p.setViewportSize({ width: 390, height: 844 }); await pause(p, 1000);
    const returnToContent = button(p, 'Přejít zpět na obsah');
    if (await returnToContent.isVisible()) await act(p, returnToContent, 1000);
    await shot(p, '10-phone-dark');
    if (await p.evaluate(() => document.documentElement.scrollWidth > innerWidth)) throw new Error('phone_horizontal_overflow');
    await act(p, button(p, 'Nastavení'), 500);
    await act(p, button(p, 'Světlý režim'), 600);
    await p.keyboard.press('Escape'); await pause(p, 1000);
    await shot(p, '11-phone-light');
    await pause(p, 1000);
    t.end();
    t.evidence = { patterns: 5, darkTheme: true, phoneResponsive: true };
  }],
];

try {
  for (const [id, name, run] of scenarios) {
    if (only && !only.includes(id)) continue;
    const attempts = [];
    for (let attempt = 1; attempt <= (id === '03' ? aiAttempts : 1); attempt++) {
      const context = await browser.newContext({
        viewport: { width: 1280, height: 720 },
        deviceScaleFactor: 1,
        locale: 'cs-CZ',
        timezoneId: 'Europe/Prague',
        colorScheme: 'light',
        acceptDownloads: true,
        serviceWorkers: 'block',
        recordVideo: { dir: temp, size: { width: 1280, height: 720 } },
      });
      const p = await context.newPage();
      await p.route('http://127.0.0.1:4178/**', async route => {
        const req = route.request();
        const response = await p.request.fetch(req, {
          headers: { ...req.headers(), origin: 'http://localhost:5173', host: '127.0.0.1:4178' }
        });
        const headers = response.headers();
        headers['access-control-allow-origin'] = '*';
        await route.fulfill({ response, headers });
      });
      const origin = Date.now();
      p.setDefaultTimeout(20000);
      const t = {
        aiRequests: [],
        now: () => (Date.now() - origin) / 1000,
        begin() { this.start = this.now(); },
        end() { this.finish = this.now(); },
      };
      p.on('request', r => {
        if (/\/(continue-lesson|analyze-board)$/.test(r.url())) t.aiRequests.push(new URL(r.url()).pathname);
      });
      const errors = [];
      p.on('pageerror', () => errors.push('page_error'));
      let failure;
      try {
        console.log(`${id}: attempt ${attempt}`);
        await run(p, t);
        if (!t.finish || t.finish <= t.start) throw new Error('invalid_capture_interval');
        if (unsafe.test(await p.locator('body').innerText())) throw new Error('privacy_check_failed');
        if (errors.length) throw new Error('page_error');
      } catch (e) {
        failure = /^[a-z][a-z0-9_]+$/.test(e.message) ? e.message : `ui_${e.name.toLowerCase()}`;
        console.log(`${id}: ${failure}`);
        if (failure.startsWith('ui_')) console.log(e.message.split('\n').slice(0, 8).join('\n'));
      } finally {
        await context.close();
      }
      const raw = await p.video().path();
      if (!failure) {
        let segments = [[t.start, t.finish]], cutWait = false;
        if (id === '03' && t.finish - t.start > 24) {
          segments = [[t.start, t.requestAt + 2], [Math.max(t.requestAt + 2, t.responseAt - 0.4), t.finish]];
          cutWait = true;
        }
        const duration = segments.reduce((s, [a, b]) => s + b - a, 0);
        if (duration < 8 || duration > 25) failure = `duration_out_of_range_${Math.round(duration)}`;
        else {
          const media = encode(raw, name, segments, cutWait);
          attempts.push({ attempt, outcome: 'ok', ...media, evidence: t.evidence ?? { localOnly: t.aiRequests.length === 0 }, sourceSegmentsSeconds: segments.map(s => s.map(n => +n.toFixed(3))) });
          console.log(`${id}: saved ${media.durationSeconds}s`);
        }
      }
      if (failure) {
        attempts.push({ attempt, outcome: 'failed', reason: failure, evidence: t.evidence });
        for (const ext of ['mp4', 'webm']) await rm(join(OUT, `${name}.${ext}`), { force: true });
      }
      await rm(raw, { force: true });
      report.runs[id] = { name, attempts, outcome: failure ? 'omitted' : 'ok' };
      await writeFile(reportPath, JSON.stringify(report, null, 2) + '\n');
      if (!failure || failure === 'ai_no_written_hint') break;
      if (id === '03' && attempt < aiAttempts) await new Promise(r => setTimeout(r, 3000));
    }
  }
} finally {
  await browser.close();
  await rm(temp, { recursive: true, force: true });
}
if (Object.entries(report.runs).some(([id, r]) => id !== '03' && r.outcome !== 'ok')) process.exitCode = 1;
