import { expect, test, type Page } from '@playwright/test';
import { catalog } from '@openmathtutor/content';
import { formatExpected, getTopicSkills, getTrackTopics, skillCheckLevel, type ExpectedAnswer, type Skill } from '@openmathtutor/shared';
import { richRowElements, symbolElements } from './inkFixture';

interface ActiveBoard {
  id: string;
  skillId?: string;
  statement: string;
  expected?: ExpectedAnswer;
}

interface WalkRow {
  skill: string;
  track: string;
  topic: string;
  level: string;
  statement: string;
  line: string;
  reading: string;
  mark: string;
  confidence: string;
  attempts: number;
  pass: boolean;
  error?: string;
}

test.beforeEach(async ({ page }) => {
  await page.route('http://127.0.0.1:4178/**', route => route.abort('connectionrefused'));
});

async function start(page: Page) {
  await page.goto('/');
  await page.getByRole('button', { name: 'Přeskočit, chci jen volnou tabuli', exact: true }).click();
}

async function openCourses(page: Page) {
  if (!(await page.locator('#course-search').isVisible())) {
    await page.getByRole('button', { name: 'Kurzy', exact: true }).click();
  }
  await expect(page.locator('#course-search')).toBeVisible();
}

function escapeRegExp(text: string): string {
  return text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

async function readActive(page: Page): Promise<ActiveBoard | null> {
  return page.evaluate(() => {
    const raw = localStorage.getItem('openmathtutor.frontend.v1');
    if (!raw) return null;
    const saved = JSON.parse(raw) as { activeId: string; boards: ActiveBoard[] };
    return saved.boards.find(board => board.id === saved.activeId) ?? null;
  });
}

async function startSkill(page: Page, skill: Skill, trackTitle: string): Promise<ActiveBoard> {
  await openCourses(page);
  const search = page.locator('#course-search');
  await search.fill(skill.title.cs);
  const result = page.getByTestId('search-results').getByRole('button', {
    name: new RegExp(`^${escapeRegExp(skill.title.cs)} \\(${escapeRegExp(trackTitle)}\\)$`),
  }).first();
  await expect(result).toBeVisible();
  await result.click();
  let active: ActiveBoard | null = null;
  // A fast sequence of lessons can briefly store the previous generated problem
  // while the HUD already shows the next one. Wait until the stored board and
  // the visible task describe the same problem, so the expected answer matches.
  await expect.poll(async () => {
    active = await readActive(page);
    if (active?.skillId !== skill.id) return false;
    const text = (await page.getByTestId('task-text').textContent().catch(() => '')) ?? '';
    return text.includes(active.statement.slice(0, Math.min(24, active.statement.length)));
  }, { timeout: 15000 }).toBe(true);
  if (!active) throw new Error(`No active board for ${skill.id}`);
  await expect(page.locator('[data-testid^="ink-reading-"]')).toHaveCount(0);
  await expect(page.locator('.excalidraw__canvas.interactive')).toBeVisible();
  await page.waitForTimeout(400);
  return active;
}

function writeable(text: string): string {
  return text.replace(/²/g, '^2').replace(/³/g, '^3').replace(/Ω/g, 'ohm').replace(/Kč/g, 'Kc')
    .replace(/(\d)10\^/g, '$1·10^');
}

function lineFor(level: string, expected: ExpectedAnswer, statement: string): string {
  const answer = writeable(formatExpected(expected, 'cs'));
  if (level === 'answer') return answer;
  if (/[a-z]/.test(statement) && statement.includes('=')) {
    const symbol = statement.match(/[a-z]/)![0];
    return `${symbol}=${answer}`;
  }
  return `${writeable(statement)}=${answer}`;
}

function seedFor(skillId: string): number {
  let hash = 7;
  for (const char of skillId) hash = (hash * 31 + char.charCodeAt(0)) | 0;
  return Math.abs(hash) % 100000;
}

async function drawElements(page: Page, elements: ReturnType<typeof richRowElements>) {
  const board = page.getByTestId('board');
  const view = await board.evaluate(el => ({
    x: Number(el.dataset.scrollX), y: Number(el.dataset.scrollY), zoom: Number(el.dataset.zoom),
  }));
  const canvas = page.locator('.excalidraw__canvas.interactive');
  const rect = await canvas.boundingBox();
  if (!rect) throw new Error('Canvas missing');
  const sx = (sceneX: number) => rect!.x + (sceneX + view.x) * view.zoom;
  const sy = (sceneY: number) => rect!.y + (sceneY + view.y) * view.zoom;
  for (const element of elements) {
    const points = element.points!;
    if (!points.length) continue;
    await page.mouse.move(sx(element.x + points[0][0]), sy(element.y + points[0][1]));
    await page.mouse.down();
    for (const point of points.slice(1)) await page.mouse.move(sx(element.x + point[0]), sy(element.y + point[1]), { steps: 1 });
    await page.mouse.up();
  }
}

async function drawLine(page: Page, text: string, seed: number) {
  const board = page.getByTestId('board');
  const view = await board.evaluate(el => ({
    x: Number(el.dataset.scrollX), y: Number(el.dataset.scrollY), zoom: Number(el.dataset.zoom),
  }));
  const rect = await page.locator('.excalidraw__canvas.interactive').boundingBox();
  if (!rect) throw new Error('Canvas missing');
  const sceneWidth = rect.width / view.zoom;
  const height = Math.max(18, Math.min(40, Math.floor((sceneWidth - 80) / (text.length * 1.5))));
  const width = text.length * height * 1.5;
  const offset: [number, number] = [Math.max(40 - view.x, (sceneWidth - width) / 2 - view.x), 260];
  await drawElements(page, richRowElements(text, seed, height, offset));
}

async function waitForMark(page: Page): Promise<{ mark: string; reading: string; confidence: string }> {
  const ok = page.getByTestId('step-mark-ok');
  const wrong = page.getByTestId('step-mark-wrong');
  await expect.poll(async () => {
    if (await ok.isVisible()) return 'ok';
    if (await wrong.isVisible()) return 'wrong';
    return 'none';
  }, { timeout: 15000 }).not.toBe('none');
  const mark = (await ok.isVisible()) ? 'ok' : 'wrong';
  const reading = page.locator('[data-testid^="ink-reading-"]').last();
  await expect(reading).toBeVisible({ timeout: 5000 });
  const guess = (await reading.locator('strong').textContent())?.trim() ?? '';
  const confidence = (await reading.getAttribute('data-confidence')) ?? '';
  return { mark, reading: guess, confidence };
}

test('starts a lesson from the course search and reads its expected answer', async ({ page }) => {
  await start(page);
  const skill = catalog.skills.find(candidate => candidate.id === 'fy-velocity')!;
  const track = catalog.tracks.find(candidate => candidate.topicIds.some(id => catalog.topics.find(topic => topic.id === id)?.skillIds.includes(skill.id)))!;
  const active = await startSkill(page, skill, track.title.cs);
  expect(active.expected?.value).toBeGreaterThan(0);
  expect(active.statement.length).toBeGreaterThan(0);
});

test('full course walk', async ({ page }) => {
  test.skip(!process.env.COURSE_WALK, 'set COURSE_WALK=1 to run the full walk');
  test.setTimeout(900000);
  await start(page);
  const rows: WalkRow[] = [];
  const seen = new Set<string>();
  for (const track of catalog.tracks) for (const topic of getTrackTopics(catalog, track.id)) for (const skill of getTopicSkills(catalog, topic.id)) {
    if (seen.has(skill.id)) continue;
    seen.add(skill.id);
    const level = skillCheckLevel(catalog, skill);
    if (level === 'none') continue;
    const row: WalkRow = { skill: skill.id, track: track.title.cs, topic: topic.title.cs, level, statement: '', line: '', reading: '', mark: 'none', confidence: '', attempts: 0, pass: false };
    for (let attempt = 0; attempt < 2; attempt++) {
      row.attempts = attempt + 1;
      try {
        const active = await startSkill(page, skill, track.title.cs);
        if (!active.expected) throw new Error('Lesson has no expected answer');
        row.statement = active.statement;
        row.line = lineFor(level, active.expected, active.statement);
        await drawLine(page, row.line, seedFor(skill.id));
        const result = await waitForMark(page);
        row.reading = result.reading;
        row.confidence = result.confidence;
        row.mark = result.mark;
        row.pass = result.mark === 'ok';
        row.error = undefined;
        break;
      } catch (error) {
        row.error = error instanceof Error ? error.message : String(error);
        if (attempt === 0) await page.waitForTimeout(500);
      }
    }
    rows.push(row);
  }
  const { writeFileSync, mkdirSync } = await import('node:fs');
  mkdirSync('test-results', { recursive: true });
  writeFileSync('test-results/course-walk.json', JSON.stringify(rows, null, 2));
  const passed = rows.filter(row => row.pass).length;
  for (const row of rows.filter(row => !row.pass)) console.log(`FAIL ${row.skill}: ${row.line} -> ${row.reading} (${row.mark}) ${row.error ?? ''}`);
  console.log(`COURSE WALK ${passed}/${rows.length}`);
  expect(rows.length).toBeGreaterThanOrEqual(23);
  expect(passed / rows.length).toBeGreaterThanOrEqual(0.9);
});

test('marks a wrong catalog line and accepts the corrected line', async ({ page }) => {
  await start(page);
  const skill = catalog.skills.find(candidate => candidate.id === 'arithmetic-integers')!;
  const track = catalog.tracks.find(candidate => candidate.topicIds.some(id => catalog.topics.find(topic => topic.id === id)?.skillIds.includes(skill.id)))!;
  const active = await startSkill(page, skill, track.title.cs);
  if (!active.expected) throw new Error('No expected answer');
  const wrong = `${writeable(active.statement)}=${formatExpected({ ...active.expected, value: active.expected.value + 1 }, 'cs')}`;
  await drawLine(page, wrong, seedFor(skill.id) + 1);
  const bad = await waitForMark(page);
  expect(bad.mark).toBe('wrong');

  const correctSkill = catalog.skills.find(candidate => candidate.id === 'arithmetic-order-of-operations')!;
  const corrected = await startSkill(page, correctSkill, track.title.cs);
  if (!corrected.expected) throw new Error('No expected answer');
  await drawLine(page, lineFor('steps', corrected.expected, corrected.statement), seedFor(correctSkill.id) + 2);
  const good = await waitForMark(page);
  expect(good.mark).toBe('ok');
  const before = await readActive(page);
  await page.getByRole('button', { name: 'Další příklad', exact: true }).click();
  await expect.poll(async () => (await readActive(page))?.id).not.toBe(before?.id);
});

test('seeded mastery flips after one correct answer and moves the plan percentage', async ({ page }) => {
  await page.addInitScript(() => {
    localStorage.setItem('openmathtutor.mastery.v1', JSON.stringify({
      'arithmetic-integers': { skillId: 'arithmetic-integers', difficultyLevel: 5, correctStreak: 1, incorrectStreak: 0, attempts: 9, correctTotal: 9, masteredAt: null, lastPracticedAt: 1 },
    }));
  });
  await start(page);
  const skill = catalog.skills.find(candidate => candidate.id === 'arithmetic-integers')!;
  const track = catalog.tracks.find(candidate => candidate.topicIds.some(id => catalog.topics.find(topic => topic.id === id)?.skillIds.includes(skill.id)))!;
  const active = await startSkill(page, skill, track.title.cs);
  if (!active.expected) throw new Error('No expected answer');
  await page.getByRole('button', { name: 'Plán a cesta', exact: true }).click();
  const before = Number.parseFloat((await page.getByTestId('plan-percent').textContent()) ?? '0');
  await page.keyboard.press('Escape');
  await drawLine(page, lineFor('steps', active.expected, active.statement), seedFor(skill.id) + 3);
  const result = await waitForMark(page);
  expect(result.mark).toBe('ok');
  const state = await page.evaluate(() => JSON.parse(localStorage.getItem('openmathtutor.mastery.v1') ?? '{}')['arithmetic-integers']);
  expect(state.masteredAt).not.toBeNull();
  await page.getByRole('button', { name: 'Plán a cesta', exact: true }).click();
  await expect.poll(async () => Number.parseFloat((await page.getByTestId('plan-percent').textContent()) ?? '0')).toBeGreaterThan(before);
});

test('print view contains the test and the answer key', async ({ page }) => {
  await page.addInitScript(() => { (window as unknown as { __prints: number }).__prints = 0; window.print = () => { (window as unknown as { __prints: number }).__prints += 1; }; });
  await start(page);
  const skill = catalog.skills.find(candidate => candidate.id === 'fy-velocity')!;
  const track = catalog.tracks.find(candidate => candidate.topicIds.some(id => catalog.topics.find(topic => topic.id === id)?.skillIds.includes(skill.id)))!;
  await startSkill(page, skill, track.title.cs);
  await page.getByRole('button', { name: 'Plán a cesta', exact: true }).click();
  await page.getByRole('button', { name: 'Sestavit test (PDF)', exact: true }).click();
  const frameElement = page.locator('iframe').last();
  await expect(frameElement).toBeAttached();
  const srcdoc = await frameElement.getAttribute('srcdoc');
  expect(srcdoc).toContain('Klíč správných odpovědí');
  const frame = page.frames().find(candidate => candidate !== page.mainFrame());
  expect(frame).toBeTruthy();
  expect(await frame!.evaluate(() => (window as unknown as { __prints: number }).__prints)).toBeGreaterThanOrEqual(1);
});

test('offers a correction when a glyph is ambiguous', async ({ page }) => {
  await start(page);
  const glyph = symbolElements('x', 4242, 'hershey-simplex', 40).map(element => ({ ...element, x: 500, y: 260 }));
  await drawElements(page, glyph);
  const reading = page.locator('[data-testid^="ink-reading-"]').last();
  await expect(reading).toBeVisible({ timeout: 10000 });
  const candidates = page.locator('[data-testid^="ink-candidate-"]');
  await expect(candidates.first()).toBeVisible({ timeout: 10000 });
  const strong = reading.locator('strong');
  const before = await strong.textContent();
  await candidates.filter({ hasNotText: before ?? '' }).first().click();
  await expect(strong).not.toHaveText(before ?? '');
});
