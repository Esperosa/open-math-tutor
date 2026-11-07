// @vitest-environment node
import { writeFileSync } from 'node:fs';
import { expect, it } from 'vitest';
import { recognizeBoardLines } from './index';
import config from './model/calibration.json';
import { random, rowElements } from '../../tests/inkFixture';

it('measures round-8 readable zero and multiplication uncertainty without an answer prior', () => {
  const results: { seed: number; expected: string; correct: boolean; uncertain: boolean; confidence: number }[] = [];
  for (let seed = 0; seed < 200; seed++) for (const [text, index, expected] of [['10+2=99', 1, '0'], ['4×3=99', 1, '*']] as const) {
    const rng = random(80000 + seed);
    const ink = rowElements(text, 9000 + seed, 60).map(e => ({ ...e, points: e.points.map(p =>
      [p[0] + (rng() - .5) * 4, p[1] + (rng() - .5) * 4] as [number, number]) }));
    const line = recognizeBoardLines(ink)[0], s = line?.symbols[index];
    const actual = s?.label ?? s?.candidates[0].label;
    const correct = expected === '*' ? actual === 'x' || actual === '×' : actual === '0' || actual === 'o';
    results.push({ seed, expected, correct, uncertain: !s || s.uncertain || !!line.uncertain,
      confidence: s && ['x', '×', '0', 'o'].includes(actual) ? s.candidates.filter(c => (['x', '×'].includes(actual) ? ['x', '×'] : ['0', 'o']).includes(c.label))
        .reduce((sum, c) => sum + c.probability, 0) : s?.candidates[0].probability ?? 0 });
  }
  const summarize = (rows: typeof results) => {
    const bins = Array.from({ length: 15 }, (_, i) => rows.filter(r => Math.min(14, Math.floor(r.confidence * 15)) === i));
    const accepted = rows.filter(r => !r.uncertain);
    return { total: rows.length, uncertain: rows.filter(r => r.uncertain).length,
      wrong: rows.filter(r => !r.correct).length, accepted: accepted.length,
      silentErrors: accepted.filter(r => !r.correct).length,
      silentErrorRate: accepted.filter(r => !r.correct).length / accepted.length,
      ece: bins.reduce((sum, bin) => sum + Math.abs(bin.reduce((n, r) => n + Number(r.correct) - r.confidence, 0)), 0) / rows.length };
  };
  const report = { fitting: summarize(results.filter(r => r.seed % 2 === 0)),
    evaluation: summarize(results.filter(r => r.seed % 2 === 1)),
    zero: summarize(results.filter(r => r.seed % 2 === 1 && r.expected === '0')),
    times: summarize(results.filter(r => r.seed % 2 === 1 && r.expected === '*')) };
  console.log(JSON.stringify(report));
  if (process.env.INK_METRICS) writeFileSync(process.env.INK_METRICS, JSON.stringify(report, null, 2));
  expect(report.evaluation.ece).toBeCloseTo(config.round8.after.evaluation.ece, 12);
  expect(report.zero.uncertain / report.zero.total).toBeLessThanOrEqual(.15);
  expect(report.times.uncertain / report.times.total).toBeLessThanOrEqual(.15);
  expect(report.evaluation.silentErrors).toBe(0);
}, 30000);


it('measures silent errors on a separate noisy row stress set including wrong equations and variables', () => {
  const texts = ['10+2=99', '4×3=99', '60/2=99', '8+9=99', '20×3=99', 'x=99'];
  let total = 0, accepted = 0, silentErrors = 0, wrong = 0;
  for (let seed = 0; seed < 60; seed++) for (const text of texts) {
    const rng = random(63000 + seed), amplitude = [0, 2, 4, 6][seed % 4];
    const ink = rowElements(text, 23000 + seed, seed % 2 ? 60 : 40).map(e => ({ ...e,
      points: e.points.map(p => [p[0] + (rng() - .5) * amplitude * 2,
        p[1] + (rng() - .5) * amplitude * 2] as [number, number]) }));
    const lines = recognizeBoardLines(ink), correct = lines.length === 1 && lines[0].text === text.replace('×', '*');
    const readable = lines.length === 1 && !lines[0].uncertain && lines[0].parserCompatible && lines[0].symbols.every(s => !s.uncertain);
    total++; if (!correct) wrong++;
    if (readable) { accepted++; if (!correct) silentErrors++; }
  }
  const report = { total, accepted, wrong, silentErrors, silentErrorRate: silentErrors / accepted };
  expect(report.silentErrorRate).toBeLessThanOrEqual(config.round8.stress.before.silentErrorRate);
  expect(report.silentErrors).toBeLessThanOrEqual(config.round8.stress.before.silentErrors);
  expect(report.wrong).toBeLessThanOrEqual(config.round8.stress.before.wrong);
  console.log('STRESS', JSON.stringify(report));
  if (process.env.STRESS_METRICS) writeFileSync(process.env.STRESS_METRICS, JSON.stringify(report, null, 2));
}, 30000);
