import { forwardRef, useEffect, useImperativeHandle, useMemo, useRef, useState } from 'react';
import { CaptureUpdateAction, Excalidraw, MainMenu, convertToExcalidrawElements, exportToCanvas } from '@excalidraw/excalidraw';
import type { AppState, BinaryFiles, ExcalidrawImperativeAPI } from '@excalidraw/excalidraw/types';
import type { ExcalidrawElement, NonDeletedExcalidrawElement } from '@excalidraw/excalidraw/element/types';
import katex from 'katex';
import { annotationElements } from './annotations';
import { fingerprint, isStudent, renderableActions, type BoardState } from './boardState';
import type { Settings } from './storage';
import { messages } from './i18n';

export interface BoardHandle {
  addLine(text: string, stepId: string | null): void;
  crop(state: BoardState): Promise<{ dataUrl: string; width: number; height: number }>;
}
interface Props {
  board: BoardState; settings: Settings;
  onCommit(elements: readonly ExcalidrawElement[], files: BinaryFiles): void;
  onBusy(busy: boolean): void;
}
export const Board = forwardRef<BoardHandle, Props>(function Board({ board, settings, onCommit, onBusy }, ref) {
  const [api, setApi] = useState<ExcalidrawImperativeAPI | null>(null);
  const [view, setView] = useState({ x: 0, y: 0, zoom: 1 });
  const viewRef = useRef(view);
  const pointerDown = useRef(false);
  const editing = useRef(false);
  const releaseFrame = useRef(0);
  const actions = useMemo(() => renderableActions(board), [board]);
  const shapes = useMemo(() => settings.showAI ? annotationElements(actions, board.steps) : [], [actions, board.steps, settings.showAI]);
  const t = messages[settings.locale];
  const menu = useMemo(() => <MainMenu><MainMenu.DefaultItems.ClearCanvas /><MainMenu.DefaultItems.ChangeCanvasBackground /></MainMenu>, []);
  const initial = useRef({ elements: structuredClone(board.elements), files: board.files,
    appState: { scrollX: 0, scrollY: 0, viewBackgroundColor: '#ffffff' } });
  useEffect(() => {
    if (!api) return;
    // Excalidraw owns the live student scene. Never feed a lagging React snapshot back into it:
    // a final pointer-up mutation could otherwise ping-pong with the previous version indefinitely.
    const student = api.getSceneElementsIncludingDeleted().filter(isStudent);
    api.updateScene({ elements: [...student, ...shapes], captureUpdate: CaptureUpdateAction.NEVER });
  }, [api, shapes]);
  useEffect(() => () => cancelAnimationFrame(releaseFrame.current), []);
  useImperativeHandle(ref, () => ({
    addLine(text, stepId) {
      if (!api) return;
      const step = board.steps.find(s => s.stepId === stepId);
      const oldIds = new Set(step?.elementIds ?? []);
      const elements = api.getSceneElementsIncludingDeleted().filter(e => isStudent(e) && !oldIds.has(e.id));
      const line = convertToExcalidrawElements([{ type: 'text', id: step?.elementIds[0] ?? crypto.randomUUID(),
        x: step?.box.x ?? 240, y: step?.box.y ?? Math.max(120, ...board.steps.map(s => s.box.y + s.box.height + 72)),
        text, fontSize: 26, fontFamily: 2, strokeColor: '#202a2a' }], { regenerateIds: false });
      const next = [...elements, ...line];
      api.updateScene({ elements: structuredClone(next), captureUpdate: CaptureUpdateAction.IMMEDIATELY });
      onCommit(next, api.getFiles());
    },
    async crop(snapshot) {
      const step = snapshot.steps.find(s => s.stepId === snapshot.activeStepId);
      if (!step) throw new Error('No active line');
      const ids = new Set(step.elementIds);
      const elements = snapshot.elements.filter(e => !e.isDeleted && ids.has(e.id)) as NonDeletedExcalidrawElement[];
      // Only the active row, never an unconditional whole-board screenshot. Export dimensions are bounded.
      const canvas = await exportToCanvas({ elements, files: snapshot.files, exportPadding: 20, maxWidthOrHeight: 1024,
        appState: { exportBackground: true, viewBackgroundColor: '#ffffff', exportWithDarkMode: false } });
      return { dataUrl: canvas.toDataURL('image/png'), width: canvas.width, height: canvas.height };
    },
  }), [api, board, onCommit]);
  function change(elements: readonly ExcalidrawElement[], state: AppState, files: BinaryFiles) {
    if (viewRef.current.x !== state.scrollX || viewRef.current.y !== state.scrollY || viewRef.current.zoom !== state.zoom.value) {
      viewRef.current = { x: state.scrollX, y: state.scrollY, zoom: state.zoom.value };
      setView(viewRef.current);
    }
    const busy = pointerDown.current || !!state.editingTextElement;
    if (editing.current !== busy) { editing.current = busy; onBusy(busy); }
    if (!busy && (fingerprint(elements) !== fingerprint(board.elements) || files !== board.files)) onCommit(elements, files);
  }
  return <div className="board-surface" data-testid="board" aria-label={t.board}>
    <Excalidraw excalidrawAPI={setApi} initialData={initial.current} onChange={change}
      langCode={settings.locale === 'cs' ? 'cs-CZ' : 'en'} theme={settings.theme}
      autoFocus={false} handleKeyboardGlobally={false} validateEmbeddable={() => false}
      onLinkOpen={(_element, event) => event.preventDefault()}
      onPointerDown={() => { cancelAnimationFrame(releaseFrame.current); pointerDown.current = true; onBusy(true); }}
      onPointerUp={() => {
        // Excalidraw finishes its stroke after this callback; commit the finalized scene next frame.
        releaseFrame.current = requestAnimationFrame(() => {
          pointerDown.current = false;
          editing.current = !!api?.getAppState().editingTextElement;
          onBusy(editing.current);
          if (api && !editing.current) onCommit(api.getSceneElementsIncludingDeleted(), api.getFiles());
        });
      }}
      UIOptions={{ canvasActions: { loadScene: false, saveToActiveFile: false, export: false, saveAsImage: false, toggleTheme: false } }}>
      {menu}
    </Excalidraw>
    <div className="math-layer" aria-live="polite">
      {settings.showAI && actions.filter(a => a.type === 'write_math').map(a => {
        if (a.type !== 'write_math') return null;
        // Incremental reveal of a KaTeX render, NOT stroke-by-stroke pen-path animation.
        const html = katex.renderToString(a.latex, { throwOnError: false, trust: false, strict: 'error', maxExpand: 100, maxSize: 10, output: 'htmlAndMathml' });
        return <div key={a.id} className="math-annotation" data-testid="math-annotation" style={{
          left: (a.anchor.x + view.x) * view.zoom, top: (a.anchor.y + view.y) * view.zoom,
          transform: `scale(${view.zoom})`,
        }}><small>{t.aiBadge}</small><span dangerouslySetInnerHTML={{ __html: html }} /></div>;
      })}
    </div>
    {settings.showAI && actions.length > 0 && <span className="layer-badge">{t.aiBadge} · {t.annotations}</span>}
  </div>;
});
