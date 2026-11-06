import { convertToExcalidrawElements } from '@excalidraw/excalidraw';
import type { ExcalidrawElementSkeleton } from '@excalidraw/excalidraw/data/transform';
import type { BoardAction } from '@openmathtutor/shared';
import type { Step } from './boardState';

export const ANNOTATION_COLOR = '#b54708';
export function annotationElements(actions: BoardAction[], steps: Step[]) {
  const skeletons: ExcalidrawElementSkeleton[] = [];
  for (const a of actions) {
    const base = { id: `omt-ai-${a.id}`, strokeColor: ANNOTATION_COLOR, strokeWidth: 2, roughness: 0,
      locked: true, customData: { omtAnnotationId: a.id }, opacity: 100 };
    // Anchors are absolute board-space coordinates. relativeToStepId is a target hint, not an offset.
    switch (a.type) {
      case 'write_text': case 'show_hint':
        // Virgil (fontFamily 1) is Excalidraw's hand-drawn font — the AI's writing should look
        // painted onto the board, like the student's own, not like a typed UI label.
        skeletons.push({ ...base, type: 'text', text: a.text, x: a.anchor.x, y: a.anchor.y, fontSize: 20, fontFamily: 1 }); break;
      case 'draw_arrow':
        skeletons.push({ ...base, type: 'arrow', x: a.from.x, y: a.from.y,
          points: [[0, 0], [a.to.x - a.from.x, a.to.y - a.from.y]], endArrowhead: 'arrow' }); break;
      case 'circle': case 'highlight': case 'underline': {
        const box = steps.find(s => s.stepId === a.targetStepId)?.box;
        if (!box) break;
        if (a.type === 'underline') skeletons.push({ ...base, type: 'line', x: box.x, y: box.y + box.height + 6, points: [[0, 0], [box.width, 0]] });
        else skeletons.push({ ...base, type: a.type === 'circle' ? 'ellipse' : 'rectangle',
          x: box.x - 8, y: box.y - 8, width: box.width + 16, height: box.height + 16,
          ...(a.type === 'highlight' ? { backgroundColor: '#f59e0b', fillStyle: 'solid' as const, opacity: 25 } : {}) });
        break;
      }
    }
  }
  return convertToExcalidrawElements(skeletons, { regenerateIds: false });
}
