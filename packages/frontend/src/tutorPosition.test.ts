import { describe, expect, it } from 'vitest';
import { clearTutorRoute, tutorDestination, overlaps, type TutorRect } from './tutorPosition';
const home = { x: 1104, y: 700, width: 320, height: 200 };
const row = { x: 560, y: 350, width: 160, height: 32 };
const viewport = { width: 1440, height: 1000 };
describe('safe tutor destination', () => {
  it('visits beside the row without covering it or leaving the viewport', () => {
    const dest = tutorDestination(home, row, viewport, [])!;
    expect(dest).not.toBeNull(); expect(overlaps(dest, row)).toBe(false);
    expect(dest.x + dest.width).toBeLessThan(viewport.width);
    expect(dest.y).toBeGreaterThan(0);
  });
  it('stays home for missing, deleted/offscreen, rotated-unresolved or invalid rows', () => {
    for (const rect of [null, { ...row, x: -1 }, { ...row, y: 1001 }, { ...row, width: NaN }, { ...row, width: 0 }]) {
      expect(tutorDestination(home, rect, viewport, [])).toBeNull();
    }
  });
  it('rejects a blocked destination AND a route across controls', () => {
    const obstacle: TutorRect = { x: 100, y: 100, width: 1300, height: 700 };
    expect(tutorDestination(home, row, viewport, [obstacle])).toBeNull();
    const dest = tutorDestination(home, row, viewport, [])!;
    const routeOnly = { x: 1250, y: 600, width: 40, height: 40 };
    expect(overlaps(dest, routeOnly)).toBe(false);
    const safe = tutorDestination(home, row, viewport, [routeOnly]);
    expect(safe).toBeNull();
  });
  it('can use the space below a row on a narrow phone when unobstructed', () => {
    expect(tutorDestination({ x: 110, y: 500, width: 268, height: 180 }, { x: 100, y: 250, width: 240, height: 32 }, { width: 390, height: 844 }, [])).not.toBeNull();
  });
  it('never stops over student strokes or marks (✓/✗)', () => {
    // When a mark ✓/✗ is directly to the right of the row
    const mark: TutorRect = { x: 730, y: 350, width: 24, height: 24 };
    // And student stroke below the row
    const strokeBelow: TutorRect = { x: 560, y: 400, width: 200, height: 40 };
    const dest = tutorDestination(home, row, viewport, [mark, strokeBelow]);
    if (dest) {
      expect(overlaps(dest, mark)).toBe(false);
      expect(overlaps(dest, strokeBelow)).toBe(false);
      expect(overlaps(dest, row)).toBe(false);
    }
  });
  it('stays home if all candidate spots are blocked by student strokes or marks', () => {
    const mark: TutorRect = { x: 730, y: 350, width: 300, height: 300 };
    const leftObstacle: TutorRect = { x: 200, y: 300, width: 400, height: 300 };
    const bottomObstacle: TutorRect = { x: 500, y: 380, width: 400, height: 300 };
    expect(tutorDestination(home, row, viewport, [mark, leftObstacle, bottomObstacle])).toBeNull();
  });
  it('checks retargeting from the rendered position, not the original home', () => {
    const from = { ...home, x: 200, y: 200 };
    const obstacles = [{ x: 600, y: 250, width: 40, height: 40 }];
    const original = tutorDestination(home, row, viewport, obstacles)!;
    expect(original).not.toBeNull();
    expect(clearTutorRoute(from, original, obstacles)).toBe(false);
    const retargeted = tutorDestination(home, row, viewport, obstacles, from)!;
    expect(retargeted).not.toBeNull();
    expect(clearTutorRoute(from, retargeted, obstacles)).toBe(true);
  });
});
