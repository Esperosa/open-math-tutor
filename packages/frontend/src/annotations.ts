import { convertToExcalidrawElements } from '@excalidraw/excalidraw';
import type { ExcalidrawElementSkeleton } from '@excalidraw/excalidraw/data/transform';
import type { ExcalidrawElement } from '@excalidraw/excalidraw/element/types';
import { boardMathToPlain, type BoardAction } from '@openmathtutor/shared';
import type { Box } from './boardState';
import type { StepLocator } from './stepLocator';
import { anchorPoint, avoidCollisions, placedBox, routeArrow } from './annotationLayout';

// Excalidraw applies its own dark-mode filter to scene ink. These light-scene
// colors remain legible in that filter and in the unfiltered white PNG export.
export const TEACHER_INK = { correction: '#b42318', explanation: '#087f8c' };
export const ANNOTATION_COLOR = TEACHER_INK.correction;
export interface TeacherNote {
  action: BoardAction;
  elements: ExcalidrawElement[];
  box: Box;
  deleteBox: Box;
  text: string;
  duration: number;
}
function wrap(text: string): string {
  return text.split('\n').flatMap(line => {
    const rows: string[] = []; let row = '';
    for (const word of line.split(/\s+/)) {
      if (row && row.length + word.length > 30) { rows.push(row); row = ''; }
      row += (row ? ' ' : '') + word;
    }
    rows.push(row); return rows;
  }).join('\n');
}
function bounds(points: { x: number; y: number }[]): Box {
  const x = Math.min(...points.map(p => p.x)), y = Math.min(...points.map(p => p.y));
  return { x, y, width: Math.max(1, ...points.map(p => p.x - x)), height: Math.max(1, ...points.map(p => p.y - y)) };
}
export function annotationElements(actions: BoardAction[], locate: StepLocator, obstacles: readonly Box[]): TeacherNote[] {
  // `ink` is real writing an arrow must route around; `occupied` also reserves the small delete handles.
  const notes: TeacherNote[] = [], ink = [...obstacles], occupied = [...obstacles];
  for (const a of actions) {
    const correction = ['circle', 'strike_through', 'underline'].includes(a.type);
    const base = { id: `omt-ai-${a.id}`, strokeColor: correction ? TEACHER_INK.correction : TEACHER_INK.explanation,
      strokeWidth: 'style' in a && a.style?.emphasis === 'high' ? 3 : 2, roughness: 1, seed: 17,
      locked: true, customData: { aiLayer: true, omtAnnotationId: a.id, actionType: a.type }, opacity: 100 };
    let skeleton: ExcalidrawElementSkeleton | null = null, text = '', box: Box | null = null;
    switch (a.type) {
      case 'write_math': case 'write_text': case 'show_hint': {
        try { text = wrap(a.type === 'write_math' ? boardMathToPlain(a.latex) : a.text); } catch { break; }
        const [measured] = convertToExcalidrawElements([{ ...base, type: 'text', text, x: 0, y: 0, fontSize: 22, fontFamily: 1 }], { regenerateIds: false });
        if (!measured) break;
        const size = { width: measured.width, height: measured.height };
        const desired = a.placement ? placedBox(a.placement, size, locate) : a.anchor ? { ...size, x: a.anchor.x, y: a.anchor.y } : null;
        if (!desired) break;
        box = avoidCollisions(desired, occupied);
        skeleton = { ...base, type: 'text', text, x: box.x, y: box.y, fontSize: 22, fontFamily: 1 };
        occupied.push(box); ink.push(box);
        break;
      }
      case 'draw_arrow': {
        const attach = (point: { x: number; y: number } | null) => {
          if (!point) return null;
          const label = notes.find(n => n.text && point.x >= n.box.x && point.x <= n.box.x + n.box.width
            && point.y >= n.box.y && point.y <= n.box.y + n.box.height);
          return label ? { x: label.box.x + label.box.width / 2, y: label.box.y - 12 } : point;
        };
        const from = attach(anchorPoint(a.from, locate)), to = attach(anchorPoint(a.to, locate));
        if (!from || !to) break;
        const points = routeArrow(from, to, ink);
        if (!points || points.every(p => p.x === from.x && p.y === from.y)) break;
        box = bounds(points);
        skeleton = { ...base, type: 'arrow', x: from.x, y: from.y, roughness: 0,
          points: points.map(p => [p.x - from.x, p.y - from.y]), endArrowhead: 'arrow' };
        break;
      }
      case 'circle': case 'highlight': case 'underline': case 'strike_through': {
        const target = locate(a.targetStepId, a.targetSymbolIndex);
        if (!target) break;
        let points: { x: number; y: number }[];
        if (a.type === 'underline' || a.type === 'strike_through') {
          const y = target.y + target.height * (a.type === 'underline' ? 1 : 0.55) + (a.type === 'underline' ? 6 : 0);
          points = [{ x: target.x, y }, { x: target.x + target.width, y }];
        } else {
          points = Array.from({ length: 49 }, (_, i) => {
            const angle = i / 48 * Math.PI * 2;
            return { x: target.x + target.width / 2 + (target.width / 2 + 9) * Math.cos(angle),
              y: target.y + target.height / 2 + (target.height / 2 + 9) * Math.sin(angle) };
          });
        }
        box = bounds(points);
        skeleton = { ...base, type: 'line', x: points[0].x, y: points[0].y,
          strokeWidth: a.type === 'highlight' ? 5 : base.strokeWidth,
          points: points.map(p => [p.x - points[0].x, p.y - points[0].y]) };
        break;
      }
    }
    if (!skeleton || !box) continue;
    const elements = convertToExcalidrawElements([skeleton], { regenerateIds: false });
    const deleteBox = avoidCollisions({ x: box.x + box.width + 14, y: box.y - 8, width: 28, height: 28 }, [...occupied.filter(b => b !== box), ...notes.map(n => n.deleteBox)]);
    occupied.push(deleteBox);
    notes.push({ action: a, elements, box, deleteBox, text, duration: text ? Math.max(240, [...text].length * 32) : 480 });
  }
  return notes;
}

/** Reveal actual exportable scene elements, not a CSS-only mask. */
export function revealNotes(notes: TeacherNote[], elapsed: number): ExcalidrawElement[] {
  let start = 0;
  return notes.flatMap(note => {
    const progress = Math.min(1, Math.max(0, (elapsed - start) / note.duration));
    start += note.duration + 90;
    if (progress <= 0) return [];
    return note.elements.map(el => {
      if (progress === 1) return el;
      if (el.type === 'text') {
        const text = [...el.text].slice(0, Math.max(1, Math.floor([...el.text].length * progress))).join('');
        return { ...el, text, originalText: text, version: el.version + Math.floor(progress * 1000), versionNonce: Math.floor(progress * 1e6) };
      }
      if (el.type === 'line' || el.type === 'arrow') {
        const index = Math.min(el.points.length - 2, Math.floor((el.points.length - 1) * progress));
        const t = (el.points.length - 1) * progress - index;
        const [x, y] = el.points[index], [tx, ty] = el.points[index + 1];
        return { ...el, version: el.version + Math.floor(progress * 1000), versionNonce: Math.floor(progress * 1e6), points: [...el.points.slice(0, index + 1), [x + (tx - x) * t, y + (ty - y) * t]],
          ...(el.type === 'arrow' ? { endArrowhead: null } : {}) } as ExcalidrawElement;
      }
      return el;
    });
  });
}
