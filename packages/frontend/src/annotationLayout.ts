import type { Anchor, Placement } from '@openmathtutor/shared';
import { isPlacement } from '@openmathtutor/shared';
import type { Box } from './boardState';
import type { StepLocator } from './stepLocator';
export interface Point { x: number; y: number }
export function overlaps(a: Box, b: Box, gap = 8) {
  return a.x < b.x + b.width + gap && a.x + a.width + gap > b.x
    && a.y < b.y + b.height + gap && a.y + a.height + gap > b.y;
}
export function placedBox(p: Placement, size: { width: number; height: number }, locate: StepLocator): Box | null {
  const target = locate(p.relativeToStepId, p.symbolIndex);
  if (!target) return null;
  const gap = Math.max(14, p.offsetEm * Math.min(32, target.height));
  const x = p.side === 'left' ? target.x - size.width - gap : p.side === 'right' ? target.x + target.width + gap : target.x;
  const y = p.side === 'above' || p.side === 'over' ? target.y - size.height - gap
    : p.side === 'below' ? target.y + target.height + gap : target.y;
  return { x, y, ...size };
}
/** Deterministic and terminating even on dense boards: jump below each blocking
 * box, then below the full finite set. Never move or cover student writing. */
export function avoidCollisions(desired: Box, obstacles: readonly Box[]): Box {
  let result = { ...desired };
  for (let i = 0; i <= obstacles.length; i++) {
    const hits = obstacles.filter(b => overlaps(result, b, 12));
    if (!hits.length) return result;
    result = { ...result, y: Math.max(...hits.map(b => b.y + b.height)) + 16 };
  }
  return { ...result, y: Math.max(result.y, ...obstacles.map(b => b.y + b.height + 16)) };
}
export function anchorPoint(p: Anchor | Placement, locate: StepLocator): Point | null {
  if (!isPlacement(p)) return { x: p.x, y: p.y };
  const box = placedBox(p, { width: 0, height: 0 }, locate);
  return box ? { x: box.x, y: box.y } : null;
}
function segmentHits(a: Point, b: Point, box: Box): boolean {
  // Liang-Barsky clipping, with writing clearance around every obstacle.
  let low = 0, high = 1;
  const dx = b.x - a.x, dy = b.y - a.y;
  for (const [p, q] of [[-dx, a.x - box.x + 5], [dx, box.x + box.width + 5 - a.x],
    [-dy, a.y - box.y + 5], [dy, box.y + box.height + 5 - a.y]]) {
    if (p === 0) { if (q < 0) return false; }
    else if (p < 0) low = Math.max(low, q / p);
    else high = Math.min(high, q / p);
    if (low > high) return false;
  }
  return true;
}
export function routeArrow(from: Point, to: Point, obstacles: readonly Box[]): Point[] | null {
  const clear = (points: Point[]) => points.slice(1).every((p, i) => !obstacles.some(b => segmentHits(points[i], p, b)));
  const routes = [[from, to], [from, { x: from.x, y: to.y }, to], [from, { x: to.x, y: from.y }, to]];
  // Visibility graph around obstacle corners; bounded by scene obstacles, no
  // sampled pixels or canvas-size loops. Dijkstra finds a short clear route.
  const corners = obstacles.flatMap(b => [
    { x: b.x - 12, y: b.y - 12 }, { x: b.x + b.width + 12, y: b.y - 12 },
    { x: b.x - 12, y: b.y + b.height + 12 }, { x: b.x + b.width + 12, y: b.y + b.height + 12 },
  ]);
  for (const route of routes) if (clear(route)) return route;
  // Large scenes fail closed instead of quadratic work on thousands of strokes.
  if (corners.length > 400) return null;
  const nodes = [from, to, ...corners], dist = nodes.map(() => Infinity), prev = nodes.map(() => -1), visited = new Set<number>();
  dist[0] = 0;
  while (visited.size < nodes.length) {
    let current = -1;
    for (let i = 0; i < nodes.length; i++) if (!visited.has(i) && (current < 0 || dist[i] < dist[current])) current = i;
    if (current < 0 || !Number.isFinite(dist[current])) return null;
    if (current === 1) {
      const path = []; for (let n = 1; n >= 0; n = prev[n]) path.unshift(nodes[n]);
      return path;
    }
    visited.add(current);
    for (let i = 0; i < nodes.length; i++) {
      if (visited.has(i)) continue;
      const cost = dist[current] + Math.hypot(nodes[i].x - nodes[current].x, nodes[i].y - nodes[current].y);
      if (cost < dist[i] && clear([nodes[current], nodes[i]])) { dist[i] = cost; prev[i] = current; }
    }
  }
  return null;
}
