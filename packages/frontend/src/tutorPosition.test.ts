import { describe, expect, it } from 'vitest';
import { tutorDestination, overlaps, type TutorRect } from './tutorPosition';
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
  it('falls back on a narrow phone instead of forcing a collision', () => {
    expect(tutorDestination({ x: 110, y: 500, width: 268, height: 180 }, { x: 100, y: 250, width: 240, height: 32 }, { width: 390, height: 844 }, [])).not.toBeNull();
  });
});
