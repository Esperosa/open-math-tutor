import { expect, it } from 'vitest';
import { recognizeBoardLines, elementsToStrokes, groupSymbols } from './index';
import { rowElements } from '../../tests/inkFixture';

it.each(['8', '1', '7'])('deletes a late struck-through %s, supports undo and replacement', digit => {
  const ink = rowElements(`12+7=1${digit}`, 13, 60);
  const glyph = groupSymbols(elementsToStrokes(ink)).at(-1)!;
  const b = glyph.bbox;
  const cross = { id: 'strike', type: 'freedraw', x: b.x - 7, y: b.y + b.height * .5,
    points: [[0, 0], [b.width + 14, 1]] as [number, number][], strokeWidth: 2 };
  expect(recognizeBoardLines([...ink, cross])[0].text).toBe('12+7=1');
  expect(recognizeBoardLines([...ink, cross])[0].ignoredStrokeIds).toEqual(expect.arrayContaining(glyph.strokes.map(s => s.id).concat('strike')));
  expect(recognizeBoardLines([...ink, { ...cross, isDeleted: true }])[0].text).toBe(`12+7=1${digit}`);
  const replacement = rowElements('9', 19, 60, [b.x, b.y]);
  expect(recognizeBoardLines([...ink, cross, ...replacement])[0].text).toBe('12+7=19');
});

