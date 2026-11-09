import { readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
import { recognizeBoardLines } from './index';
import type { BoardElement } from './types';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

interface Sample {
  id: string;
  label: string;
  raw_label: string;
  split: string;
  traces: [number, number][][];
}

interface AlignmentOp {
  type: 'match' | 'substitute' | 'insert' | 'delete';
  expected?: string;
  actual?: string;
}

function levenshteinAlign(a: string, b: string): { distance: number; ops: AlignmentOp[] } {
  const m = a.length, n = b.length;
  const dp: number[][] = Array.from({ length: m + 1 }, () => Array(n + 1).fill(0));
  for (let i = 0; i <= m; i++) dp[i][0] = i;
  for (let j = 0; j <= n; j++) dp[0][j] = j;

  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      if (a[i - 1] === b[j - 1]) {
        dp[i][j] = dp[i - 1][j - 1];
      } else {
        dp[i][j] = 1 + Math.min(dp[i - 1][j], dp[i][j - 1], dp[i - 1][j - 1]);
      }
    }
  }

  // Backtrack
  const ops: AlignmentOp[] = [];
  let i = m, j = n;
  while (i > 0 || j > 0) {
    if (i > 0 && j > 0 && a[i - 1] === b[j - 1]) {
      ops.unshift({ type: 'match', expected: a[i - 1], actual: b[j - 1] });
      i--; j--;
    } else if (i > 0 && j > 0 && dp[i][j] === dp[i - 1][j - 1] + 1) {
      ops.unshift({ type: 'substitute', expected: a[i - 1], actual: b[j - 1] });
      i--; j--;
    } else if (i > 0 && dp[i][j] === dp[i - 1][j] + 1) {
      ops.unshift({ type: 'delete', expected: a[i - 1] });
      i--;
    } else {
      ops.unshift({ type: 'insert', actual: b[j - 1] });
      j--;
    }
  }

  return { distance: dp[m][n], ops };
}

export function runEvaluation(reportName = 'eval_report.json') {
  const fixturePath = resolve(__dirname, '__fixtures__/mathwriting-eval.json');
  const samples: Sample[] = JSON.parse(readFileSync(fixturePath, 'utf8'));

  let exactMatches = 0;
  let totalChars = 0;
  let totalLevenshtein = 0;
  const confusions = new Map<string, number>();
  let segmentationErrors = 0;
  const details: Record<string, unknown>[] = [];

  const splitStats: Record<string, { total: number; exact: number; chars: number; lev: number }> = {
    valid: { total: 0, exact: 0, chars: 0, lev: 0 },
    test: { total: 0, exact: 0, chars: 0, lev: 0 },
  };

  const startTime = Date.now();

  for (let idx = 0; idx < samples.length; idx++) {
    const s = samples[idx];
    const elements: BoardElement[] = s.traces.map((trace, i) => ({
      id: `stroke-${i}`,
      type: 'freedraw',
      x: 0,
      y: 0,
      points: trace,
      strokeWidth: 2.5,
    }));

    const lines = recognizeBoardLines(elements, {});
    const recognized = lines.map(l => l.text).join('').replace(/\s+/g, '');
    const expected = s.label.replace(/\s+/g, '');

    const { distance, ops } = levenshteinAlign(expected, recognized);
    const isExact = expected === recognized;
    if (isExact) exactMatches++;

    totalChars += expected.length;
    totalLevenshtein += distance;

    const stats = splitStats[s.split] ?? (splitStats[s.split] = { total: 0, exact: 0, chars: 0, lev: 0 });
    stats.total++;
    if (isExact) stats.exact++;
    stats.chars += expected.length;
    stats.lev += distance;

    let hasSegError = false;
    for (const op of ops) {
      if (op.type === 'substitute' && op.expected && op.actual) {
        const pair = `${op.expected} → ${op.actual}`;
        confusions.set(pair, (confusions.get(pair) ?? 0) + 1);
      } else if (op.type === 'insert' || op.type === 'delete') {
        hasSegError = true;
      }
    }
    if (hasSegError) segmentationErrors++;

    details.push({
      id: s.id,
      split: s.split,
      expected,
      recognized,
      rawExpected: s.raw_label,
      distance,
      isExact,
      hasSegError,
    });
  }

  const elapsed = (Date.now() - startTime) / 1000;
  const lineAccuracy = (exactMatches / samples.length) * 100;
  const cer = (totalLevenshtein / totalChars) * 100;

  const sortedConfusions = [...confusions.entries()].sort((a, b) => b[1] - a[1]);

  console.log(`\n================ EVALUATION SUMMARY (${reportName}) ================`);
  console.log(`Evaluated ${samples.length} real human expressions in ${elapsed.toFixed(1)}s`);
  console.log(`Line Accuracy: ${exactMatches} / ${samples.length} = ${lineAccuracy.toFixed(2)} %`);
  console.log(`Character Error Rate (CER): ${totalLevenshtein} errors / ${totalChars} characters = ${cer.toFixed(2)} %`);
  console.log(`Segmentation errors (split/merge/drop): ${segmentationErrors} / ${samples.length} lines (${(segmentationErrors / samples.length * 100).toFixed(1)} %)`);
  console.log(`\nSplit Breakdown:`);
  for (const [split, st] of Object.entries(splitStats)) {
    const sAcc = (st.exact / st.total) * 100;
    const sCer = (st.lev / st.chars) * 100;
    console.log(`  Split '${split}': ${st.exact}/${st.total} lines (${sAcc.toFixed(1)}%), CER: ${st.lev}/${st.chars} (${sCer.toFixed(1)}%)`);
  }
  console.log(`\nTop 15 Confused Character Pairs:`);
  for (const [pair, count] of sortedConfusions.slice(0, 15)) {
    console.log(`  ${pair}: ${count}`);
  }
  console.log(`===================================================================\n`);

  const report = {
    totalSamples: samples.length,
    exactMatches,
    lineAccuracy,
    totalChars,
    totalLevenshtein,
    cer,
    segmentationErrors,
    splitStats,
    topConfusions: sortedConfusions.slice(0, 30),
    details,
  };

  const outPath = resolve(__dirname, `../../../../tools/handwriting/.cache/${reportName}`);
  writeFileSync(outPath, JSON.stringify(report, null, 2), 'utf8');
  console.log(`Report written to ${outPath}`);
  return report;
}

if (process.argv[1]?.endsWith('eval_human_pipeline.ts')) {
  const reportName = process.argv[2] ?? 'eval_baseline_report.json';
  runEvaluation(reportName);
}
