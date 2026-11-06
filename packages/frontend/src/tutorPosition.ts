export interface TutorRect { x: number; y: number; width: number; height: number }
const GAP = 12;

export function overlaps(a: TutorRect, b: TutorRect, gap = GAP): boolean {
  return a.x < b.x + b.width + gap && a.x + a.width + gap > b.x && a.y < b.y + b.height + gap && a.y + a.height + gap > b.y;
}

export function clearTutorRoute(from: TutorRect, to: TutorRect, obstacles: TutorRect[]): boolean {
  const route = {
    x: Math.min(from.x, to.x),
    y: Math.min(from.y, to.y),
    width: Math.max(from.x + from.width, to.x + to.width) - Math.min(from.x, to.x),
    height: Math.max(from.y + from.height, to.y + to.height) - Math.min(from.y, to.y),
  };
  return !obstacles.some(o => overlaps(route, o, 0));
}

/**
 * Places the mascot when visiting a row.
 * CRITICAL RULE (D7): The mascot NEVER stops over the student's text, handwriting strokes,
 * or marks (✓/✗). The preferred position is to the right of the row / outside content.
 * If all candidate spots overlap obstacles or content, returns null so the mascot stays home in the corner.
 */
export function tutorDestination(
  home: TutorRect,
  row: TutorRect | null,
  viewport: { width: number; height: number },
  obstacles: TutorRect[],
  from = home,
  standingAt: TutorRect | null = null,
): TutorRect | null {
  if (
    !row ||
    ![row.x, row.y, row.width, row.height].every(Number.isFinite) ||
    row.width <= 0 ||
    row.height <= 0 ||
    row.x < 0 ||
    row.y < 0 ||
    row.x + row.width > viewport.width ||
    row.y + row.height > viewport.height
  ) {
    return null;
  }

  const y = Math.max(GAP, Math.min(viewport.height - home.height - GAP, row.y + row.height / 2 - home.height + 40));

  // Candidates ordered by pedagogical preference:
  // 1. Right of the row with clearance for marks (✓/✗) and strokes
  // 2. Left of row (only if clear of obstacles)
  // 3. Below row on phone (only if completely free of obstacles / strokes)
  const candidates: TutorRect[] = [
    { ...home, x: row.x + row.width + 48, y },
    { ...home, x: row.x - home.width - 24, y },
    { ...home, x: row.x, y: row.y + row.height + 24 },
  ];

  const fits = (c: TutorRect) =>
    c.x < GAP ||
    c.y < GAP ||
    c.x + c.width > viewport.width - GAP ||
    c.y + c.height > viewport.height - GAP ||
    overlaps(c, row);

  const reachable = (c: TutorRect) => clearTutorRoute(from, c, obstacles);
  const returnable = (c: TutorRect) => clearTutorRoute(c, home, obstacles);

  // Filter out any candidate that overlaps with the row OR ANY obstacle (strokes, marks, controls)
  const placed = candidates.filter(c => !fits(c) && !obstacles.some(o => overlaps(c, o)));

  const standing = placed.find(
    c => Math.abs(c.x - (standingAt?.x ?? from.x)) < 4 && Math.abs(c.y - (standingAt?.y ?? from.y)) < 4,
  );
  return standing ?? placed.find(c => returnable(c) && reachable(c)) ?? placed.find(reachable) ?? null;
}
