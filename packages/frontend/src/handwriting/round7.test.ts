// @vitest-environment node
import { expect, it } from 'vitest';
import { recognizeBoardLines } from './index';
import { rowElements } from './__fixtures__/generate';
import type { BoardElement } from './types';
import { parseLine } from './parse';

it.each([[[0, 0]], [[0, 0], [-3, 8]], [[0, 0], [2, 3], [-2, 7]]].map(points => ({ points })))('reads a baseline decimal separator by geometry: %j', ({ points }) => {
  const raw = rowElements('2,5+1,5=4', 7, 60);
  const commas = raw.filter(e => Math.max(...e.points!.map(p => p[1])) - Math.min(...e.points!.map(p => p[1])) < 10
    && Math.min(...e.points!.map(p => p[1])) > 50);
  expect(commas).toHaveLength(2);
  const input = raw.map(e => commas.includes(e) ? { ...e, points: points.map(p => [p[0], p[1] + 56]) } : e);
  const lines = recognizeBoardLines(input);
  expect(lines).toHaveLength(1);
  expect(lines[0].text).toBe('(25/10)+(15/10)=4');
});

export function fractionSum(): BoardElement[] {
  const fraction = (n: string, d: string, x: number, seed: number) => [
    ...rowElements(n, seed, 35, [x + 10, 0]),
    { id: `bar-${x}`, type: 'freedraw', x, y: 45, points: [[0, 0], [50, 0]], strokeWidth: 2 },
    ...rowElements(d, seed + 1, 35, [x + 10, 58]),
  ];
  return [...fraction('1', '2', 0, 13), ...rowElements('+', 11, 40, [65, 25]),
    ...fraction('1', '3', 115, 17), ...rowElements('=', 19, 40, [185, 25]), ...fraction('5', '6', 235, 23)];
}
it('keeps a full standing fraction equality on one row', () => {
  const lines = recognizeBoardLines(fractionSum());
  expect(lines).toHaveLength(1);
  expect(lines[0].text).toBe('(1)/(2)+(1)/(3)=(5)/(6)');
});

it('ignores a lone pen tap and small isolated mark, not a digit or decimal', () => {
  for (const points of [[[0, 0]], [[0, 0], [1, 2]]] as number[][][]) {
    expect(recognizeBoardLines([{ id: 'tap', type: 'freedraw', x: 600, y: 500, points, strokeWidth: 2 }])).toEqual([]);
  }
  const input = [...rowElements('4=4', 7), { id: 'tap', type: 'freedraw', x: 600, y: 500, points: [[0, 0]], strokeWidth: 2 }];
  expect(recognizeBoardLines(input).map(l => l.text)).toEqual(['4=4']);
});

it('preserves an algebra variable through implicit multiplication', () => {
  const lines = recognizeBoardLines([...rowElements('2x+3=11', 13, 50), ...rowElements('x=4', 17, 50, [0, 90])]);
  expect(lines.map(l => l.text)).toEqual(['2*x+3=11', 'x=4']);
  expect(lines.flatMap(l => l.symbols).some(s => s.uncertain)).toBe(false);
});

it('uses expected unit aliases for a suspicious suffix, never for arbitrary arithmetic', () => {
  const line = recognizeBoardLines(rowElements('77/7=11m/s', 13), { unitAliases: ['m/s'] })[0];
  expect(line.text).toBe('77/7=11 m/s');
  expect(line.uncertain || line.symbols.some(s => s.uncertain)).toBe(true);
  const symbols = '*n1/2'.split('').map((label, i) => ({ bbox: { x: i * 20, y: 0, width: 15, height: 30 }, candidates: [{ label, probability: .99 }], strokeIds: [String(i)], strokeOrder: [i], uncertain: false }));
  const numeric = { ...symbols[0], bbox: { x: -30, y: 0, width: 15, height: 30 }, candidates: [{ label: '6', probability: .99 }] };
  expect(parseLine([numeric, ...symbols], undefined, ['m/s'])).toMatchObject({ text: '6 m/s', uncertain: true });
  expect(recognizeBoardLines(rowElements('72/12=6', 13), { unitAliases: ['m/s'] })[0].text).toBe('72/12=6');
});

it('flags a late short cross-out as ambiguous instead of judging its silhouette', () => {
  const ink = rowElements('4+1=5', 13);
  const box = recognizeBoardLines(ink)[0].symbols[0].bbox;
  const cross: BoardElement = { id: 'short-cross', type: 'freedraw', x: box.x - 3, y: box.y + box.height * .55,
    points: [[0, 0], [box.width * 1.4, -3]], strokeWidth: 2 };
  const lines = recognizeBoardLines([...ink, cross]);
  expect(lines[0].uncertain || lines[0].ignoredStrokeIds.includes('short-cross')).toBe(true);
});

it('keeps full rows separate with only 18 pixels below the previous baseline', () => {
  const lines = recognizeBoardLines([...rowElements('12:4=3', 13, 40, [420, 260]), ...rowElements('12:4=3', 17, 40, [420, 318])]);
  expect(lines.map(l => l.text)).toEqual(['12/4=3', '12/4=3']);
});
