// @vitest-environment node
import { readFileSync } from 'node:fs';
import { expect, it } from 'vitest';
import { evaluateLines, type Sample } from './eval_line_pipeline';

const samples = (file: string): Sample[] => JSON.parse(readFileSync(new URL(`./__fixtures__/${file}`, import.meta.url), 'utf8'));

it('locks the full original319 measured improvement, without claiming the 15% / 60% product target', () => {
  const original = samples('mathwriting-eval.json');
  const baseline = evaluateLines(original, 'symbol').summary;
  const ctc = evaluateLines(original, 'ctc').summary;
  const production = evaluateLines(original, 'auto').summary;
  expect(baseline.errors).toBe(1467);
  expect(baseline.exact).toBe(26);
  expect(ctc.cer).toBeLessThanOrEqual(.23);
  expect(production.cer).toBeLessThanOrEqual(.32);
  expect(production.exact).toBeGreaterThanOrEqual(80);
  expect(ctc.ctcRows).toBe(original.length); // Standalone CTC must never borrow CNN predictions.
  // Agreement may preserve legacy probabilities/mapping, so selected source
  // counts are telemetry, not the number of rows that ran neural inference.
  expect(production.ctcRows).toBeGreaterThan(0);
  console.log('CTC_ORIGINAL319', JSON.stringify({ baseline, ctc, production }));
}, 60000);

it('guards the new512 original-test partition in canonical app syntax, including hard two-dimensional rows', () => {
  const fresh = samples('line-heldout.json');
  const originalIds = new Set(samples('mathwriting-eval.json').map(s => s.id));
  expect(fresh).toHaveLength(512);
  expect(fresh.every(s => s.split === 'test' && !originalIds.has(s.id))).toBe(true);
  const result = evaluateLines(fresh, 'auto', true).summary;
  expect(result.cer).toBeLessThanOrEqual(.36);
  expect(result.accuracy).toBeGreaterThanOrEqual(.20);
  expect(result.ctcRows).toBeGreaterThanOrEqual(280);
  console.log('CTC_FRESH512', JSON.stringify(result));
}, 60000);
