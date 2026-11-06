// @vitest-environment node
import { writeFileSync } from 'node:fs';
import { expect, it } from 'vitest';
import { recognizeBoardLines, recognizeSymbol } from './index';
import { elementsToStrokes } from './strokes';
import { rowElements, symbolElements, variantTemplates } from './__fixtures__/generate';
import { parseLine } from './parse';
import type { RecognizedSymbol } from './types';

it('measures every Czech notation variant separately, including inherently ambiguous shapes', () => {
  const cases = [
    ...variantTemplates.map(t => ({ name: t.source, label: t.label, source: t.source })),
    ...[':', '÷', '/', '×', '·', '*', '[', ']', '{', '}', '±', '<', '>', '≤', '≥', '≠', '√', '%', 'π', '°', '∅', '.', ','].map(label => ({ name: label, label, source: label === '.' || label === ',' || label === '/' || label === '÷' || label === '×' || label === '%' ? 'hershey-simplex' : 'own' })),
    ...['(', ')'].map(label => ({ name: 'round-arc:' + label, label, source: 'hershey-simplex' })),
    { name: 'decimal-dot-own', label: '.', source: 'own' },
    { name: 'variable-x-hershey', label: 'x', source: 'hershey-simplex' },
    { name: 'variable-x-own', label: 'x', source: 'own' },
  ];
  const result: Record<string, { correct: number; total: number; confusion: Record<string, number> }> = {};
  for (const [index, variant] of cases.entries()) {
    const score = { correct: 0, total: 50, confusion: {} as Record<string, number> };
    for (let n = 0; n < score.total; n++) {
      const prediction = recognizeSymbol(elementsToStrokes(symbolElements(variant.label, 998714 + index * 73 + n, variant.source, [24, 40, 72][n % 3])))[0].label;
      if (prediction === variant.label) score.correct++;
      else score.confusion[prediction] = (score.confusion[prediction] ?? 0) + 1;
    }
    result[variant.name] = score;
  }
  console.log('HANDWRITING variants ' + JSON.stringify(result));
  if (process.env.HANDWRITING_VARIANTS_REPORT) writeFileSync(process.env.HANDWRITING_VARIANTS_REPORT, JSON.stringify(result, null, 2));
  for (const key of ['variant:one-hook', 'variant:one-top-bar', 'variant:seven-crossbar', 'variant:four-open', 'variant:four-closed', 'variant:nine-european']) expect(result[key].correct / result[key].total).toBeGreaterThanOrEqual(.92);
  expect(result['∅'].confusion['0'] ?? 0).toBe(0);
}, 60000);

it('normalizes division, multiplication, brackets, decimals and implied multiplication without silently changing unsupported symbols', () => {
  for (const [text, expected] of [['6:2=3', '6/2=3'], ['3·4=12', '3*4=12'], ['3*4=12', '3*4=12'], ['3x4=12', '3*4=12'], ['[2+3]4', '(2+3)*4'], ['{2+3}4', '(2+3)*4'], ['2x=6', '2*x=6'], ['1,5+2', '(15/10)+2'], ['1.5+2', '(15/10)+2']]) {
    // rowElements uses '*' for a times cross. Explicit '*' syntax is tested below.
    expect(recognizeBoardLines(rowElements(text, 8931)).map(l => l.text).join('\n'), text).toBe(expected);
  }
  const s = (label: string, x: number): RecognizedSymbol => ({ bbox: { x, y: 0, width: 20, height: 40 }, strokeIds: [label], strokeOrder: [0], candidates: [{ label, probability: .95 }], uncertain: false });
  expect(parseLine([s('3', 0), s('*', 25), s('4', 50)]).text).toBe('3*4');
  expect(parseLine([s('√', 0), s('9', 40)]).text).toBe('(9)^(1/2)');
  for (const [label, written] of [['±', '±'], ['≠', '≠'], ['π', 'π'], ['°', '30°'], ['∅', '∅']]) {
    const result = recognizeBoardLines(rowElements(written, 8921));
    expect(result[0].text).toBe(written); expect(result[0].parserCompatible).toBe(false);
    expect(result[0].symbols.some(s => s.uncertain && s.label !== 'x'), label).toBe(true);
  }
  // Without neighbours a small circle is indistinguishable from a zero: never claim a degree sign.
  expect(recognizeBoardLines(rowElements('°', 8921))[0].symbols[0].candidates.length).toBe(3);
});
