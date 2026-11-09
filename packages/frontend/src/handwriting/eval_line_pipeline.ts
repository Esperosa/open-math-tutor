/** Explicit offline benchmark; never imported by the browser application. */
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { recognizeBoardLines } from './index';
import { canonicalLine, recognizeStrokeLine } from './lineRecognizer';
import { elementsToStrokes } from './strokes';
import type { BoardElement } from './types';

export interface Sample { id: string; split: string; label: string; traces: number[][][] }
const root = resolve(import.meta.dirname, '../../../../');
const cache = resolve(root, 'tools/handwriting/.cache');

/** Reference-to-prediction edit alignment, includes insertions in token ECE.
 * Deletions have no confidence and are reported separately, never hidden in ECE. */
function align(reference: string, prediction: string) {
  const dp = Array.from({ length: reference.length + 1 }, (_, i) => Array.from({ length: prediction.length + 1 }, (_, j) => i ? j ? 0 : i : j));
  for (let i = 1; i <= reference.length; i++) for (let j = 1; j <= prediction.length; j++) dp[i][j] = Math.min(dp[i - 1][j] + 1, dp[i][j - 1] + 1, dp[i - 1][j - 1] + Number(reference[i - 1] !== prediction[j - 1]));
  const correct = Array<boolean>(prediction.length).fill(false);
  let i = reference.length, j = prediction.length, deleted = 0;
  while (i || j) {
    if (i && j && dp[i][j] === dp[i - 1][j - 1] + Number(reference[i - 1] !== prediction[j - 1])) { correct[j - 1] = reference[i - 1] === prediction[j - 1]; i--; j--; }
    else if (j && dp[i][j] === dp[i][j - 1] + 1) j--;
    else { i--; deleted++; }
  }
  return { distance: dp[reference.length][prediction.length], correct, deleted };
}

function elements(sample: Sample): BoardElement[] {
  return sample.traces.map((points, i) => ({ id: `s${i}`, type: 'freedraw', x: 0, y: 0, points, strokeWidth: 2.5 }));
}

export function evaluateLines(samples: Sample[], reader: 'symbol' | 'ctc' | 'auto', canonicalReference = false) {
  let errors = 0, chars = 0, exact = 0, accepted = 0, silentErrors = 0, ctcRows = 0;
  let canonicalErrors = 0, canonicalChars = 0, canonicalExact = 0;
  const times: number[] = [], details: object[] = [];
  // Warm the JIT and lazy weight decoding; cold latency is reported separately.
  const cold = performance.now();
  recognizeBoardLines(elements(samples[0]), { reader, calibrationProfile: null });
  const coldMs = performance.now() - cold;
  for (const sample of samples) {
    const start = performance.now();
    const lines = recognizeBoardLines(elements(sample), { reader, calibrationProfile: null });
    times.push(performance.now() - start);
    const prediction = lines.map(l => l.text).join('').replace(/\s+/g, '');
    const literal = sample.label.replace(/\s+/g, '');
    const expected = canonicalReference ? canonicalLine(literal) : literal;
    const result = align(expected, prediction);
    errors += result.distance; chars += expected.length; exact += Number(expected === prediction);
    const normalized = canonicalLine(literal);
    canonicalErrors += align(normalized, prediction).distance; canonicalChars += normalized.length; canonicalExact += Number(normalized === prediction);
    const readable = lines.length === 1 && lines.every(l => !l.uncertain && l.parserCompatible && l.symbols.every(s => !s.uncertain));
    if (readable) { accepted++; silentErrors += Number(expected !== prediction); }
    ctcRows += Number(lines.some(l => l.reader === 'ctc'));
    details.push({ id: sample.id, split: sample.split, expected, prediction, distance: result.distance, readable, reader: lines.map(l => l.reader), ms: times.at(-1) });
  }
  times.sort((a, b) => a - b);
  return { summary: { samples: samples.length, errors, chars, cer: errors / chars, exact, accuracy: exact / samples.length, accepted, silentErrors, ctcRows,
    referenceProtocol: canonicalReference ? 'canonical app syntax' : 'literal original319 protocol',
    canonical: { errors: canonicalErrors, chars: canonicalChars, cer: canonicalErrors / canonicalChars, exact: canonicalExact, accuracy: canonicalExact / samples.length },
    coldMs, latency: { median: times[Math.floor(times.length / 2)], p95: times[Math.floor(times.length * .95)], max: times.at(-1) } }, details };
}

export function collectCalibration(samples: Sample[]) {
  const observations: { id: string; confidence: number; correct: boolean }[] = [];
  let deleted = 0;
  for (const sample of samples) {
    const strokes = elementsToStrokes(elements(sample));
    const reading = recognizeStrokeLine(strokes).best;
    if (!reading) { deleted += sample.label.length; continue; }
    const aligned = align(sample.label, reading.transcript);
    deleted += aligned.deleted;
    reading.rawProbabilities.forEach((confidence, i) => observations.push({ id: sample.id, confidence, correct: aligned.correct[i] }));
  }
  return { samples: samples.length, deleted, observations };
}

if (process.argv[1]?.endsWith('eval_line_pipeline.ts')) {
  mkdirSync(cache, { recursive: true });
  if (process.argv[2] === 'calibrate') {
    const samples: Sample[] = JSON.parse(readFileSync(resolve(root, 'tools/handwriting/data-cache/line-calibration.json'), 'utf8'));
    const report = collectCalibration(samples);
    writeFileSync(resolve(cache, 'line-calibration-observations.json'), JSON.stringify(report));
    console.log('Calibration observations', report.observations.length, 'deletions', report.deleted);
  } else {
    const report: Record<string, unknown> = {};
    for (const [name, file] of [['original319', 'mathwriting-eval.json'], ['fresh512', 'line-heldout.json']]) {
      const samples: Sample[] = JSON.parse(readFileSync(resolve(import.meta.dirname, '__fixtures__', file), 'utf8'));
      for (const reader of ['symbol', 'ctc', 'auto'] as const) {
        const result = evaluateLines(samples, reader, name === 'fresh512');
        console.log(name, reader, JSON.stringify(result.summary)); report[`${name}-${reader}`] = result;
      }
    }
    writeFileSync(resolve(cache, 'line-evaluation.json'), JSON.stringify(report, null, 2));
  }
}
