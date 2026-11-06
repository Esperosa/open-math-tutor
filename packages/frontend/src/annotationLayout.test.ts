import { describe, expect, it } from 'vitest';
import { avoidCollisions, overlaps, placedBox, routeArrow } from './annotationLayout';
import { createStepLocatorRegistry, textStepLocator } from './stepLocator';
import { localTeacherActions } from './localTeacher';
import type { Step } from './boardState';
import type { ExcalidrawElement } from '@excalidraw/excalidraw/element/types';
const box = { x: 100, y: 200, width: 150, height: 30 };
const locate = (id: string) => id === 's' ? box : null;
describe('relative annotation layout', () => {
  it.each(['right', 'left', 'above', 'below', 'over'] as const)('positions %s relative to the scene row', side => {
    const result = placedBox({ relativeToStepId: 's', side, offsetEm: 1 }, { width: 80, height: 26 }, locate)!;
    expect(overlaps(result, box)).toBe(false);
    expect(placedBox({ relativeToStepId: 'deleted', side, offsetEm: 1 }, result, locate)).toBeNull();
  });
  it('never covers writing or previous notes even on a densely packed board', () => {
    const obstacles = Array.from({ length: 120 }, (_, i) => ({ ...box, y: i * 40 }));
    const result = avoidCollisions(box, obstacles);
    expect(obstacles.some(b => overlaps(result, b))).toBe(false);
    expect(avoidCollisions(box, obstacles)).toEqual(result);
  });
  it('routes an arrow around student text and refuses an endpoint inside it', () => {
    const from = { x: 50, y: 215 }, to = { x: 300, y: 215 };
    const path = routeArrow(from, to, [box]);
    expect(path).not.toBeNull(); expect(path!.length).toBeGreaterThan(2);
    expect(path![0]).toEqual(from); expect(path!.at(-1)).toEqual(to);
    expect(routeArrow({ x: 120, y: 210 }, to, [box])).toBeNull();
  });
  it('allows a recognizer to register exact symbol geometry and unregister cleanly', () => {
    const registry = createStepLocatorRegistry(locate);
    const symbol = { x: 104, y: 205, width: 8, height: 19 };
    const off = registry.registerStepLocator((id, index) => id === 'ink' && index === 2 ? symbol : null);
    expect(registry.locate('ink', 2)).toEqual(symbol); expect(registry.locate('s')).toEqual(box);
    off(); expect(registry.locate('ink', 2)).toBeNull();
  });
  it('locates multiline text rows, not the whole paragraph; unknown pen symbols fail closed', () => {
    const element = { ...box, id: 'el', type: 'text', text: '5+2=15\n\nx=3', height: 90, angle: 0 } as ExcalidrawElement;
    const steps = [{ stepId: 's', box, elementIds: ['el'], latexGuess: element.type === 'text' ? element.text : '', boardRevision: 0 }] satisfies Step[];
    const locator = textStepLocator(steps, [element]);
    expect(locator('s#1')).toEqual({ ...box, y: 260, height: 30 });
    expect(locator('s#2')).toBeNull();
    expect(textStepLocator(steps, [{ ...element, type: 'freedraw' } as ExcalidrawElement])('s', 0)).toBeNull();
  });
});
describe('local teacher uses the same declarative layer', () => {
  it('circles wrong arithmetic and asks a guiding question on first mistake, gives correction on hint', () => {
    const firstAttempt = localTeacherActions({ stepId: 's#1', parentId: 's', latexGuess: '5+2=15' }, 4, 'cs');
    expect(firstAttempt[0]).toMatchObject({ type: 'circle', targetStepId: 's#1', boardRevision: 4 });
    expect(firstAttempt[1]).toMatchObject({ type: 'write_text', text: 'Zkus ten řádek přepočítat po operacích.', placement: { relativeToStepId: 's#1' } });

    const hintAttempt = localTeacherActions({ stepId: 's#1', parentId: 's', latexGuess: '5+2=15' }, 4, 'cs', { revealSolution: true });
    expect(hintAttempt[1]).toMatchObject({ type: 'write_text', text: '5+2=7', placement: { relativeToStepId: 's#1' } });
  });
  it('does not invent algebra or exact values for repeating decimals', () => {
    for (const latexGuess of ['x+2=15', '1/3=5', '<script>x</script>']) {
      expect(localTeacherActions({ stepId: 's', parentId: 's', latexGuess }, 1, 'en', { revealSolution: true })[1]).toMatchObject({ text: 'Check this step.' });
    }
  });
});
