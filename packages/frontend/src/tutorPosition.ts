export interface TutorRect { x: number; y: number; width: number; height: number }
const GAP = 12;
export function overlaps(a: TutorRect, b: TutorRect, gap = GAP): boolean {
  return a.x < b.x + b.width + gap && a.x + a.width + gap > b.x && a.y < b.y + b.height + gap && a.y + a.height + gap > b.y;
}
export function clearTutorRoute(from: TutorRect, to: TutorRect, obstacles: TutorRect[]): boolean {
  const route = { x: Math.min(from.x, to.x), y: Math.min(from.y, to.y),
    width: Math.max(from.x + from.width, to.x + to.width) - Math.min(from.x, to.x),
    height: Math.max(from.y + from.height, to.y + to.height) - Math.min(from.y, to.y) };
  return !obstacles.some(o => overlaps(route, o, 0));
}
/** Only visit a visible row if both the destination and the straight CSS-transform route are clear. */
export function tutorDestination(home: TutorRect, row: TutorRect | null, viewport: { width: number; height: number }, obstacles: TutorRect[], from = home): TutorRect | null {
  if (!row || ![row.x, row.y, row.width, row.height].every(Number.isFinite) || row.width <= 0 || row.height <= 0 ||
    row.x < 0 || row.y < 0 || row.x + row.width > viewport.width || row.y + row.height > viewport.height) return null;
  const y = Math.max(GAP, Math.min(viewport.height - home.height - GAP, row.y + row.height / 2 - home.height + 40));
  const candidates = [
    { ...home, x: row.x + row.width + 40, y },
    { ...home, x: row.x - home.width - 24, y },
    { ...home, x: row.x, y: row.y + row.height + 24 },
  ];
  return candidates.find(c => {
    if (c.x < GAP || c.y < GAP || c.x + c.width > viewport.width - GAP || c.y + c.height > viewport.height - GAP || overlaps(c, row)) return false;
    // Home has a deliberate 6px gap above Excalidraw's footer. Require actual
    // clearance along the route, and the larger reading margin at destination.
    return !obstacles.some(o => overlaps(c, o)) && clearTutorRoute(from, c, obstacles);
  }) ?? null;
}
