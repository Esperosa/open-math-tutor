// @vitest-environment node
import { expect, it } from 'vitest';
import { recognizeBoardLines } from './index';
import { rowElements } from './__fixtures__/generate';
import type { BoardElement } from './types';

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
