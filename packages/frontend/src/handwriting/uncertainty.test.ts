// @vitest-environment node
import { expect, it, vi } from 'vitest';
import { recognizeBoardLines, elementsToStrokes, groupSymbols } from './index';
import { rowElements } from './__fixtures__/generate';
import type { BoardElement, Stroke } from './types';

const forced = vi.hoisted(() => ({ label: '2', probe: undefined as { label: string; probability: number }[] | undefined }));

vi.mock('./model', async importOriginal => {
  const original = await importOriginal<typeof import('./model')>();
  return { ...original, recognizeSymbol: (strokes: readonly Stroke[]) =>
    forced.probe && strokes.some(s => s.id.startsWith('probe-')) ? forced.probe : strokes.length === 2 && strokes.every(s => s.bbox.width > 30 && s.bbox.height < 8)
      ? [{ label: forced.label, probability: .999 }, { label: '=', probability: .0009 }, { label: '7', probability: .0001 }]
      : original.recognizeSymbol(strokes),
  };
});

it.each(['2', '0', '×'])('keeps a two-bar shape uncertain when a confident classifier calls it %s', label => {
  forced.label = label;
  const ink: BoardElement[] = [
    ...rowElements('4', 13, 60),
    { id: 'top', type: 'freedraw', x: 90, y: 22, points: [[0, 1], [10, -1], [25, 2], [40, 0]], strokeWidth: 2 },
    { id: 'bottom', type: 'freedraw', x: 90, y: 40, points: [[0, -1], [10, 1], [25, -2], [40, 0]], strokeWidth: 2 },
    ...rowElements('4', 17, 60, [160, 0]),
  ];
  const lines = recognizeBoardLines(ink);
  expect(lines).toHaveLength(1);
  expect(lines[0].text).toBe(`4${label === '×' ? '*' : label}4`); // Never silently rewrite the neural reading to an equals sign.
  const middle = lines[0].symbols[1];
  expect(middle.strokeIds).toEqual(['top', 'bottom']);
  expect(middle.candidates[0]).toEqual({ label: forced.label, probability: .999 });
  expect(middle.uncertain).toBe(true);
});

it('does not make ordinary plus or division symbols uncertain', () => {
  for (const text of ['4+4', '4/4']) {
    const line = recognizeBoardLines(rowElements(text, 13, 60))[0];
    expect(line.text).toBe(text);
    expect(line.symbols.every(s => !s.uncertain)).toBe(true);
  }
});

it('keeps competing labels, caller overrides and variable slots uncertain', () => {
  const probe = (text: string, candidates: { label: string; probability: number }[], threshold?: number) => {
    forced.probe = candidates;
    const ink = rowElements(text, 13, 60);
    const ids = groupSymbols(elementsToStrokes(ink))[1].strokes.map(s => s.id);
    const result = recognizeBoardLines(ink.map(e => ids.includes(e.id) ? { ...e, id: `probe-${e.id}` } : e),
      { confidenceThreshold: threshold })[0].symbols[1];
    forced.probe = undefined;
    return result;
  };
  expect(probe('4×3', [{ label: '×', probability: .4 }, { label: 'y', probability: .35 }, { label: 'x', probability: .1 }]).uncertain).toBe(true);
  expect(probe('4×3', [{ label: '×', probability: .5 }, { label: 'x', probability: .4 }, { label: 'y', probability: .1 }], .99).uncertain).toBe(true);
  expect(probe('4x=3', [{ label: '×', probability: .5 }, { label: 'x', probability: .4 }, { label: 'y', probability: .1 }]).uncertain).toBe(true);
});
