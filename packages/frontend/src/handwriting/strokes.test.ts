import { describe, expect, it } from 'vitest';
import { elementsToStrokes, groupLines, groupSymbols } from './strokes';
import { fractionElements, rowElements } from './__fixtures__/generate';
import type { BoardElement } from './types';

describe('Excalidraw stroke geometry', () => {
  const element: BoardElement = { id: 'a', type: 'freedraw', x: 100, y: 200, points: [[-10, 0], [10, 0]], angle: Math.PI / 2, strokeWidth: 2 };
  it('rotates negative local points about their actual bounds', () => {
    const [s] = elementsToStrokes([element]);
    expect(s.points[0][0]).toBeCloseTo(100); expect(s.points[0][1]).toBeCloseTo(190);
    expect(s.points[1][0]).toBeCloseTo(100); expect(s.points[1][1]).toBeCloseTo(210);
  });
  it('never applies viewport pan/zoom twice to native scene coordinates', () => {
    expect(elementsToStrokes([element], { viewport: { zoom: .5, scrollX: -100, scrollY: 50 } })).toEqual(elementsToStrokes([element]));
  });
  it('inverts zoom, scroll and DOM offsets for explicit screen imports', () => {
    const [s] = elementsToStrokes([{ ...element, angle: 0, x: 220, y: 460, points: [[0, 0], [40, 0]], strokeWidth: 4 }],
      { inputSpace: 'screen', viewport: { zoom: 2, scrollX: 10, scrollY: 20, offsetLeft: 20, offsetTop: 20 } });
    expect(s.points).toEqual([[90, 200], [110, 200]]); expect(s.width).toBe(2);
  });
  it('supports explicit import scaling, without using stale width/height metadata', () => {
    expect(elementsToStrokes([{ ...element, angle: 0, scale: [2, .5], width: 1000 }])[0].points).toEqual([[80, 200], [120, 200]]);
  });
  it('ignores non-ink/deleted/corrupt/duplicate elements and rejects excessive input', () => {
    expect(elementsToStrokes([{ ...element, type: 'text' }, { ...element, isDeleted: true }, { ...element, x: NaN }, element, element])).toHaveLength(1);
    expect(() => elementsToStrokes([element], { inputSpace: 'screen' })).toThrow(RangeError);
    expect(() => elementsToStrokes(Array(10001).fill(element))).toThrow(RangeError);
    expect(() => elementsToStrokes([{ ...element, points: Array(200001).fill([0, 0]) }])).toThrow(RangeError);
  });
  it('uses creation metadata or array order, not edit timestamps', () => {
    expect(elementsToStrokes([{ ...element, id: 'b', createdAt: 20 }, { ...element, createdAt: 10 }]).map(s => s.id)).toEqual(['a', 'b']);
  });
  it('groups multiple strokes but separates adjacent characters and independent rows', () => {
    const elements = [...rowElements('12+7=19', 10), ...rowElements('x=5', 20, 40, [0, 100])];
    const symbols = groupSymbols(elementsToStrokes(elements));
    expect(symbols).toHaveLength(10);
    expect(groupLines(symbols).map(l => l.symbols.length)).toEqual([7, 3]);
  });
  it('keeps numerator, bar, denominator in one line, and superscripts with their base', () => {
    expect(groupLines(groupSymbols(elementsToStrokes(fractionElements(4))))).toHaveLength(1);
    expect(groupLines(groupSymbols(elementsToStrokes(rowElements('2^3', 4))))).toHaveLength(1);
  });
});
