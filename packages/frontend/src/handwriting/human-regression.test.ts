import { describe, expect, it } from 'vitest';
import fixtures from './__fixtures__/real-human-lines.json';
import { recognizeBoardLines } from './index';
import type { BoardElement } from './types';

describe('Real human handwriting regression (Google MathWriting)', () => {
  it('evaluates authentic human handwriting lines from MathWriting valid/test splits', () => {
    expect(fixtures.length).toBeGreaterThanOrEqual(20);
    expect(fixtures.length).toBeLessThanOrEqual(40);

    let totalChars = 0;
    let totalLev = 0;
    let exactMatches = 0;

    for (const sample of fixtures) {
      const elements: BoardElement[] = sample.traces.map((trace, i) => ({
        id: `mw-${sample.id}-${i}`,
        type: 'freedraw',
        x: 0,
        y: 0,
        points: trace as [number, number][],
        strokeWidth: 2.5,
      }));

      const lines = recognizeBoardLines(elements, {});
      expect(lines).toBeDefined();

      const recognized = lines.map(l => l.text).join('').replace(/\s+/g, '');
      const expected = sample.label.replace(/\s+/g, '');

      totalChars += expected.length;

      // Simple Levenshtein distance
      const m = expected.length, n = recognized.length;
      const dp: number[][] = Array.from({ length: m + 1 }, () => Array(n + 1).fill(0));
      for (let i = 0; i <= m; i++) dp[i][0] = i;
      for (let j = 0; j <= n; j++) dp[0][j] = j;
      for (let i = 1; i <= m; i++) {
        for (let j = 1; j <= n; j++) {
          if (expected[i - 1] === recognized[j - 1]) dp[i][j] = dp[i - 1][j - 1];
          else dp[i][j] = 1 + Math.min(dp[i - 1][j], dp[i][j - 1], dp[i - 1][j - 1]);
        }
      }
      const dist = dp[m][n];
      totalLev += dist;
      if (dist === 0) exactMatches++;
    }

    const cer = totalLev / totalChars;
    // Real raw human MathWriting unconstrained expressions without answer priors
    expect(cer).toBeLessThan(0.65);
    expect(exactMatches).toBeGreaterThanOrEqual(1);
  });

  it('maintains deterministic and stable results on human input', () => {
    const sample = fixtures[0];
    const elements: BoardElement[] = sample.traces.map((trace, i) => ({
      id: `stroke-${i}`,
      type: 'freedraw',
      x: 0,
      y: 0,
      points: trace as [number, number][],
      strokeWidth: 2.5,
    }));

    const first = recognizeBoardLines(elements, {});
    const second = recognizeBoardLines(elements, {});
    expect(first.map(l => l.text)).toEqual(second.map(l => l.text));
    expect(first.length).toBe(second.length);
  });

  it('processes human expressions within latency target (<50ms median)', () => {
    const sample = fixtures[1];
    const elements: BoardElement[] = sample.traces.map((trace, i) => ({
      id: `speed-${i}`,
      type: 'freedraw',
      x: 0,
      y: 0,
      points: trace as [number, number][],
      strokeWidth: 2.5,
    }));

    // Warm-up
    recognizeBoardLines(elements, {});

    const timings: number[] = [];
    for (let i = 0; i < 20; i++) {
      const fresh = elements.map(e => ({ ...e, id: `${e.id}-${i}` }));
      const t0 = performance.now();
      recognizeBoardLines(fresh, {});
      timings.push(performance.now() - t0);
    }
    timings.sort((a, b) => a - b);
    const median = timings[Math.floor(timings.length / 2)];
    expect(median).toBeLessThan(50);
  });
});
