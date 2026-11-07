// @vitest-environment node
import { readFileSync, writeFileSync } from 'node:fs';
import { gunzipSync } from 'node:zlib';
import { expect, it } from 'vitest';
import { classifyRaster, MODEL_LABELS, recognizeBoardLines, recognizeSymbol } from './index';
import { elementsToStrokes } from './strokes';
import { fixtureLabels, fractionElements, heldoutSources, rowElements, symbolElements } from './__fixtures__/generate';
import { parseMathStatement } from '@openmathtutor/shared';

const measured: Record<string, unknown> = {};
function record(name: string, result: unknown): void {
  measured[name] = result;
  console.log(`HANDWRITING ${name} ${JSON.stringify(result)}`);
  if (process.env.HANDWRITING_REPORT) writeFileSync(process.env.HANDWRITING_REPORT, JSON.stringify(measured, null, 2));
}

it('scores all 10000 official held-out MNIST images with the full multiclass TS model (>=97%)', () => {
  const images = gunzipSync(readFileSync(new URL('./__fixtures__/t10k-images-idx3-ubyte.gz', import.meta.url)));
  const labels = gunzipSync(readFileSync(new URL('./__fixtures__/t10k-labels-idx1-ubyte.gz', import.meta.url)));
  expect(images.readUInt32BE(0)).toBe(2051); expect(images.readUInt32BE(4)).toBe(10000);
  expect(labels.readUInt32BE(0)).toBe(2049); expect(labels.readUInt32BE(4)).toBe(10000);
  let correct = 0;
  const perClass = Array.from({ length: 10 }, () => ({ correct: 0, total: 0 }));
  const start = performance.now();
  for (let n = 0; n < 10000; n++) {
    const raster = Float32Array.from(images.subarray(16 + n * 784, 16 + (n + 1) * 784), v => v / 255);
    const prediction = classifyRaster(raster)[0].label, label = labels[8 + n];
    perClass[label].total++;
    if (prediction === String(label)) { correct++; perClass[label].correct++; }
  }
  record('mnist', { correct, total: 10000, accuracy: correct / 10000, perClass, elapsedMs: performance.now() - start });
  expect(correct).toBeGreaterThanOrEqual(9700);
}, 120000);

it('scores unseen noisy Hershey/own stroke augmentations; digits+operators >=92%', () => {
  let correct = 0, total = 0, allCorrect = 0, allTotal = 0;
  const perClass: Record<string, { correct: number; total: number }> = {};
  const confusion: Record<string, number> = {};
  for (const [index, label] of fixtureLabels.entries()) {
    perClass[label] = { correct: 0, total: 80 };
    for (let n = 0; n < 80; n++) {
      const elements = symbolElements(label, 812733 + index * 301 + n, n % 2 ? 'hershey-plain' : 'hershey-simplex', 20 + n % 5 * 15);
      const prediction = recognizeSymbol(elementsToStrokes(elements))[0].label;
      const pass = prediction === label;
      allTotal++; if (pass) { allCorrect++; perClass[label].correct++; }
      else confusion[`${label}->${prediction}`] = (confusion[`${label}->${prediction}`] ?? 0) + 1;
      if ('0123456789+-×÷/=:*'.includes(label)) { total++; if (pass) correct++; }
    }
  }
  expect(MODEL_LABELS).toHaveLength(fixtureLabels.length);
  record('synthetic', { correct, total, accuracy: correct / total, allCorrect, allTotal, perClass, confusion });
  expect(correct / total).toBeGreaterThanOrEqual(.92);
}, 60000);

it('scores UCI pendigits digits from writers never used in training (>=95%)', () => {
  // Raw 8-point pen trajectories, not bitmaps: the same rasterizeSymbol and
  // classifyRaster path the board uses. The official test split was never
  // touched by train.py, so this is the writer-independent number.
  const fixture = JSON.parse(readFileSync(new URL('./__fixtures__/pendigits.json', import.meta.url), 'utf8')) as {
    source: string; samples: { strokes: number[][][]; width: number; label: string }[];
  };
  let correct = 0;
  const confusion: Record<string, number> = {};
  for (const [n, sample] of fixture.samples.entries()) {
    const strokes = sample.strokes.map((points, i) => elementsToStrokes([{ id: `pen-${n}-${i}`, type: 'freedraw',
      x: 0, y: 0, points, strokeWidth: sample.width }])[0]);
    const prediction = recognizeSymbol(strokes)[0].label;
    if (prediction === sample.label) correct++;
    else confusion[`${sample.label}->${prediction}`] = (confusion[`${sample.label}->${prediction}`] ?? 0) + 1;
  }
  record('pendigits', { correct, total: fixture.samples.length, accuracy: correct / fixture.samples.length, confusion });
  expect(correct / fixture.samples.length).toBeGreaterThanOrEqual(.95);
}, 120000);

it('scores digits drawn in Hershey families that were never used for training (serif and triplex)', () => {
  const perSource: Record<string, { correct: number; total: number; confusion: Record<string, number> }> = {};
  for (const source of heldoutSources) {
    const score = { correct: 0, total: 0, confusion: {} as Record<string, number> };
    for (const [index, label] of '0123456789'.split('').entries()) for (let n = 0; n < 60; n++) {
      const elements = symbolElements(label, 515151 + index * 977 + n, source, [24, 40, 72][n % 3]);
      const prediction = recognizeSymbol(elementsToStrokes(elements))[0].label;
      score.total++;
      if (prediction === label) score.correct++;
      else score.confusion[`${label}->${prediction}`] = (score.confusion[`${label}->${prediction}`] ?? 0) + 1;
    }
    perSource[source] = score;
  }
  const correct = Object.values(perSource).reduce((a, s) => a + s.correct, 0), total = Object.values(perSource).reduce((a, s) => a + s.total, 0);
  record('heldoutFonts', { correct, total, accuracy: correct / total, perSource });
  expect(correct / total).toBeGreaterThanOrEqual(.85);
}, 60000);

it('recognizes a typical board line in under 50 ms (median of 40 cold-cache runs)', () => {
  const times: number[] = [];
  const elements = rowElements('(2+3)*4=20', 99, 40);
  recognizeBoardLines(elements); // warm up the JIT and the decoded weights
  for (let n = 0; n < 40; n++) {
    // Fresh stroke ids defeat the per-board cache, so every symbol is re-inferred.
    const fresh = elements.map(e => ({ ...e, id: `${e.id}-${n}` }));
    const start = performance.now();
    recognizeBoardLines(fresh);
    times.push(performance.now() - start);
  }
  times.sort((a, b) => a - b);
  record('speed', { symbols: elements.length, medianMs: times[20], p95Ms: times[38], maxMs: times[39] });
  expect(times[20]).toBeLessThan(50);
});

it('scores whole stroke rows across scales, shear, offsets, zoom and pan', () => {
  // [what the student draws, what the recognizer must return (shared-parser syntax)]
  const cases: [string, string][] = [['12+7=19', '12+7=19'], ['3*4=12', '3*4=12'], ['x=5', 'x=5'], ['(2+3)*4=20', '(2+3)*4=20'],
    ['1/2+1/3', '1/2+1/3'], ['(1)/(2)', '(1)/(2)'], ['2^3', '2^3'], ['7:2=3,5', '7/2=3,5'], ['2x=6', '2*x=6']];
  const results: Record<string, { correct: number; total: number; errors: string[] }> = {};
  let correct = 0, total = 0, symbolCorrect = 0, symbolTotal = 0;
  for (const [index, [text, expected]] of cases.entries()) {
    results[text] = { correct: 0, total: 30, errors: [] };
    for (let n = 0; n < 30; n++) {
      const seed = 73510 + n * 173 + index;
      const height = [24, 40, 72][n % 3], offset: readonly [number, number] = [n * 13 - 100, n * 31 - 300];
      const elements = text === '(1)/(2)' ? fractionElements(seed, height, offset) : rowElements(text, seed, height, offset);
      const recognized = recognizeBoardLines(elements, { viewport: { zoom: [.5, 1, 2][n % 3], scrollX: -n * 5, scrollY: n * 20 } });
      const prediction = recognized.map(l => l.text).join('\n');
      total++;
      if (prediction === expected) { correct++; results[text].correct++; }
      else if (results[text].errors.length < 8) results[text].errors.push(`${n}: ${prediction}`);
      // Symbol accuracy uses the context-resolved label (x vs ×, . vs ·), in reading order (top to bottom for a fraction).
      const expectedSymbols = (text === '(1)/(2)' ? '1-2' : text.replace('^', '')).split('');
      const symbols = recognized.flatMap(l => l.symbols);
      if (text === '(1)/(2)') symbols.sort((p, q) => p.bbox.y - q.bbox.y);
      symbolTotal += expectedSymbols.length;
      for (let i = 0; i < expectedSymbols.length; i++) if (symbols[i] && (symbols[i].label ?? symbols[i].candidates[0].label) === expectedSymbols[i]) symbolCorrect++;
      if (prediction === expected) expect(() => parseMathStatement(prediction)).not.toThrow();
    }
  }
  record('rows', { correct, total, accuracy: correct / total, symbolCorrect, symbolTotal, results });
  expect(correct / total).toBeGreaterThanOrEqual(.95);
}, 60000);

it('scores whole rows whose digits come from Hershey families never used for training', () => {
  const cases: [string, string][] = [['12+7=19', '12+7=19'], ['3*4=12', '3*4=12'], ['(2+3)*4=20', '(2+3)*4=20'], ['7:2=3,5', '7/2=3,5'], ['x=5', 'x=5']];
  const results: Record<string, { correct: number; total: number; errors: string[] }> = {};
  let correct = 0, total = 0;
  for (const [index, [text, expected]] of cases.entries()) {
    results[text] = { correct: 0, total: 40, errors: [] };
    for (let n = 0; n < 40; n++) {
      const overrides: Record<number, string> = {};
      for (const [i, c] of text.split('').entries()) if (/\d/.test(c)) overrides[i] = heldoutSources[n % 2];
      const prediction = recognizeBoardLines(rowElements(text, 31337 + n * 131 + index, [24, 40, 72][n % 3], [n * 7, n * 3], overrides)).map(l => l.text).join('\n');
      total++;
      if (prediction === expected) { correct++; results[text].correct++; }
      else if (results[text].errors.length < 5) results[text].errors.push(`${n}: ${prediction}`);
    }
  }
  record('rowsHeldoutDigits', { correct, total, accuracy: correct / total, results });
  expect(correct / total).toBeGreaterThanOrEqual(.90);
}, 60000);

it('keeps stable line identity through pan/movement and returns finite alternatives without modifying input', () => {
  const elements = rowElements('12+7=19', 4);
  const before = JSON.stringify(elements), first = recognizeBoardLines(elements);
  const moved = recognizeBoardLines(elements.map(e => ({ ...e, x: e.x + 1000, y: e.y - 50 })));
  expect(first[0].id).toBe(moved[0].id);
  expect(first[0].text).toBe(moved[0].text);
  expect(first[0].strokeIds.length).toBe(elements.length);
  expect(first[0].alternatives).toHaveLength(3);
  expect(first[0].alternatives.every(a => Number.isFinite(a.confidence) && a.confidence >= 0 && a.confidence <= 1)).toBe(true);
  expect(JSON.stringify(elements)).toBe(before);
  expect(recognizeBoardLines([])).toEqual([]);
});
