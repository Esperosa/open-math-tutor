import { describe, test, expect } from 'vitest';
import { wrapTaskText, computeTaskLayout, isTaskVisibleInViewport } from './taskLayout';

describe('whiteboard task layout and visible placement (D1)', () => {
  const longPhysics = 'Auto zrychluje z klidu se zrychlením 2 m/s² po dobu 10 s. Jakou dráhu přitom urazí a jaké dosáhne rychlosti?';
  const longUniLimit = 'Spočtěte limitu funkce (x^2 - 4) / (x - 2) pro x blížící se k 2 a ověřte z definice limity spojitost v bodě x = 2.';

  test('wraps text into multiple lines without breaking words', () => {
    const wrapped = wrapTaskText(longPhysics, 28);
    const lines = wrapped.split('\n');
    expect(lines.length).toBeGreaterThan(1);
    for (const line of lines) {
      expect(line.length).toBeLessThanOrEqual(35);
    }
    // Should preserve spaces between words and not create broken mid-word fragments
    expect(wrapped).toContain('Auto zrychluje');
  });

  test('desktop 1440x900: task is centered, visible, and clear of HUD', () => {
    const obstacles = { topBarBottom: 52, leftCardRight: 340, leftCardBottom: 180 };
    const layout = computeTaskLayout({
      viewportWidth: 1440,
      viewportHeight: 900,
      zoom: 1,
      scrollX: 0,
      scrollY: 0,
      statementText: longPhysics,
      obstacles,
    });

    expect(layout.fontSize).toBeLessThanOrEqual(18); // scaled for long text
    expect(layout.linesCount).toBeGreaterThanOrEqual(2);

    const check = isTaskVisibleInViewport(layout, 1440, 900, obstacles);
    expect(check.visible).toBe(true);

    // Clearance from top bar >= 24px
    expect(layout.viewportY - obstacles.topBarBottom).toBeGreaterThanOrEqual(24);
  });

  test('tablet 1024x768: task is visible and does not overlap top-left HUD', () => {
    const obstacles = { topBarBottom: 52, leftCardRight: 280, leftCardBottom: 85 };
    const layout = computeTaskLayout({
      viewportWidth: 1024,
      viewportHeight: 768,
      zoom: 1,
      scrollX: 0,
      scrollY: 0,
      statementText: longUniLimit,
      obstacles,
    });

    const check = isTaskVisibleInViewport(layout, 1024, 768, obstacles);
    expect(check.visible).toBe(true);
    expect(check.overlapsHUD).toBe(false);
    expect(layout.viewportX >= obstacles.leftCardRight + 20 || layout.viewportY >= obstacles.leftCardBottom + 20).toBe(true);
  });

  test('mobile 390x844: task is under top bar across width with margins', () => {
    const obstacles = { topBarBottom: 52, leftCardRight: 0, leftCardBottom: 92 };
    const layout = computeTaskLayout({
      viewportWidth: 390,
      viewportHeight: 844,
      zoom: 1,
      scrollX: 0,
      scrollY: 0,
      statementText: longPhysics,
      obstacles,
    });

    expect(layout.viewportX).toBeGreaterThanOrEqual(16);
    expect(layout.viewportY).toBeGreaterThanOrEqual(obstacles.leftCardBottom + 24);
    const check = isTaskVisibleInViewport(layout, 390, 844, obstacles);
    expect(check.visible).toBe(true);
  });

  test('mobile default clears the two-row toolbar and relocated HUD card', () => {
    const layout = computeTaskLayout({ viewportWidth: 360, viewportHeight: 740, statementText: longPhysics });
    expect(layout.viewportY).toBeGreaterThanOrEqual(364);
    expect(layout.viewportY + layout.estimatedHeight).toBeLessThan(740 - 80);
  });

  test('converts viewport coordinates accurately with zoom and pan', () => {
    const layout = computeTaskLayout({
      viewportWidth: 1000,
      viewportHeight: 800,
      zoom: 2,
      scrollX: 100,
      scrollY: 50,
      statementText: '2 + 2 = ?',
    });

    expect(layout.sceneX).toBe(Math.round(layout.viewportX / 2 - 100));
    expect(layout.sceneY).toBe(Math.round(layout.viewportY / 2 - 50));
  });
});
