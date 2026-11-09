import { expect, test } from '@playwright/test';
import { readFileSync, writeFileSync } from 'node:fs';
const heldout = JSON.parse(readFileSync(new URL('../src/handwriting/__fixtures__/line-heldout.json', import.meta.url), 'utf8')) as { traces: number[][][] }[];

test('CTC reads held-out human ink locally with bounded browser latency and stroke associations', async ({ page }, testInfo) => {
  await page.goto('/');
  const metrics = await page.evaluate(async ({ samples, modulePath }) => {
    const { recognizeBoardLines } = await import(modulePath) as typeof import('../src/handwriting');
    const elements = (sample: typeof samples[number]) => sample.traces.map((points, i) => ({ id: `s${i}`, type: 'freedraw', x: 0, y: 0, points, strokeWidth: 2.5 }));
    const start = performance.now();
    recognizeBoardLines(elements(samples[0]), { reader: 'ctc', calibrationProfile: null });
    const coldMs = performance.now() - start, times: number[] = [];
    let tokens = 0, mapped = 0, finite = true, nonempty = 0, networkCalls = 0;
    const originalFetch = globalThis.fetch;
    globalThis.fetch = (...args) => { networkCalls++; return originalFetch(...args); };
    try {
      for (const sample of samples) {
        const ink = elements(sample), before = performance.now();
        const lines = recognizeBoardLines(ink, { reader: 'ctc', calibrationProfile: null });
        times.push(performance.now() - before);
        if (lines.length) nonempty++;
        for (const symbol of lines.flatMap(l => l.symbols)) {
          tokens++;
          if (symbol.strokeIds.length && symbol.strokeIds.every(id => ink.some(e => e.id === id))) mapped++;
          finite &&= Object.values(symbol.bbox).every(Number.isFinite) && symbol.candidates.every(c => Number.isFinite(c.probability));
        }
      }
    } finally { globalThis.fetch = originalFetch; }
    times.sort((a, b) => a - b);
    return { samples: samples.length, nonempty, tokens, mapped, finite, networkCalls, coldMs,
      medianMs: times[Math.floor(times.length / 2)], p95Ms: times[Math.floor(times.length * .95)], maxMs: times.at(-1) };
  }, { samples: heldout.slice(0, 32), modulePath: '/src/handwriting/index.ts' });
  console.log('CTC_BROWSER', JSON.stringify(metrics));
  await testInfo.attach('ctc-browser-metrics', { body: Buffer.from(JSON.stringify(metrics, null, 2)), contentType: 'application/json' });
  if (process.env.LINE_BROWSER_METRICS) writeFileSync(process.env.LINE_BROWSER_METRICS, JSON.stringify(metrics, null, 2));
  expect(metrics.finite).toBe(true);
  expect(metrics.networkCalls).toBe(0);
  expect(metrics.nonempty).toBeGreaterThanOrEqual(28);
  expect(metrics.mapped).toBe(metrics.tokens);
  expect(metrics.medianMs).toBeLessThan(100);
});
