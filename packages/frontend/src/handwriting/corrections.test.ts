import { expect, it } from 'vitest';
import { createHandwritingRecognizer, recognizeBoardLines } from './index';
import { elementsToStrokes, groupSymbols } from './strokes';
import { applyCorrections } from './corrections';
import { rowElements, symbolElements } from './__fixtures__/generate';
import { richRowElements } from '../../tests/inkFixture';
import type { BoardElement } from './types';

it('ignores a later long cross-out, retains replacement ink, and supports undo by deleting the cross-out', () => {
  const old = rowElements('3', 78);
  const cross: BoardElement = { id: 'cross', type: 'freedraw', x: -12, y: 20, points: [[0, 0], [60, 0]], strokeWidth: 2 };
  const replacement = rowElements('5', 81);
  const result = recognizeBoardLines([...old, cross, ...replacement]);
  expect(result).toHaveLength(1); expect(result[0].text).toBe('5');
  expect(result[0].ignoredStrokeIds).toEqual([...old.map(e => e.id), 'cross']);
  expect(result[0].strokeIds).toEqual(replacement.map(e => e.id));
  expect(recognizeBoardLines([...old, { ...cross, isDeleted: true }])[0].text).toBe('3');
});
it('does not erase the European 7 crossbar, and ignores an underline below the baseline', () => {
  const seven = symbolElements('7', 87, 'variant:seven-crossbar');
  expect(applyCorrections(elementsToStrokes(seven)).ignored).toEqual([]);
  const text = rowElements('5', 81);
  const underline: BoardElement = { id: 'u', type: 'freedraw', x: -10, y: 47, points: [[0, 0], [55, 0]], strokeWidth: 2 };
  expect(recognizeBoardLines([...text, underline])[0].text).toBe('5');
});
it('does not treat a letter crossbar as an ambiguous cross-out of the previous digit', () => {
  const lines = recognizeBoardLines(richRowElements('4A', 1131, 40, [100, 200]), { unitAliases: ['A'] });
  expect(lines[0].text).toBe('4 A');
  expect(lines[0].uncertain).toBeUndefined();
  expect(lines[0].crossOutUncertain).toBe(false);
});
it('takes a complete late redraw as the new symbol while preserving other symbols', () => {
  const old = rowElements('3+12', 78);
  const replacement = rowElements('5', 81);
  const recognized = recognizeBoardLines([...old, ...replacement]);
  expect(recognized[0].text).toBe('5+12');
  expect(recognized[0].ignoredStrokeIds).toContain(old[0].id);
});
it('converts only edited strokes and reuses all unchanged neural predictions (including in-place edits)', () => {
  const session = createHandwritingRecognizer(), elements = rowElements('12+7=19', 4);
  const first = session.recognize(elements);
  expect(session.stats.inferredSymbols).toBe(7);
  expect(session.recognize(elements)).toEqual(first);
  expect(session.stats).toEqual({ inferredSymbols: 0, convertedStrokes: 0, cachedSymbols: 7 });
  const changed = elements.map((e, i) => i ? e : { ...e, strokeWidth: e.strokeWidth! * 1.05 });
  session.recognize(changed);
  expect(session.stats.convertedStrokes).toBe(1); expect(session.stats.inferredSymbols).toBe(1);
  expect(session.stats.cachedSymbols).toBe(6);
  // JSON must not alias NaN to undefined/null in cache fingerprints.
  session.recognize(changed.map((e, i) => i ? e : { ...e, angle: NaN }));
  expect(session.stats.convertedStrokes).toBe(1);
  session.clear(); session.recognize(elements);
  expect(session.stats.convertedStrokes).toBe(elements.length);
});
it('returns sorted probabilities, stroke provenance and explicit uncertainty for ambiguous readings', () => {
  const result = recognizeBoardLines(rowElements('x=5', 57), { confidenceThreshold: 1 });
  for (const symbol of result[0].symbols) {
    expect(symbol.candidates).toHaveLength(3);
    expect(symbol.candidates[0].probability).toBeGreaterThanOrEqual(symbol.candidates[1].probability);
    expect(symbol.candidates[1].probability).toBeGreaterThanOrEqual(symbol.candidates[2].probability);
    expect(symbol.strokeOrder).toHaveLength(symbol.strokeIds.length);
    expect(symbol.uncertain).toBe(true);
  }
  expect(groupSymbols(elementsToStrokes(rowElements('x=5', 57)))).toHaveLength(3);
  expect(() => recognizeBoardLines([], { marginThreshold: NaN })).toThrow(RangeError);
});
