import { forwardRef, type CSSProperties, useEffect, useImperativeHandle, useMemo, useRef, useState } from 'react';
import { CaptureUpdateAction, Excalidraw, MainMenu, convertToExcalidrawElements, exportToBlob, exportToCanvas, exportToSvg } from '@excalidraw/excalidraw';
import type { AppState, BinaryFiles, ExcalidrawImperativeAPI } from '@excalidraw/excalidraw/types';
import type { ExcalidrawElement, NonDeletedExcalidrawElement } from '@excalidraw/excalidraw/element/types';
import { createStepLocatorRegistry, textStepLocator, type StepLocator } from './stepLocator';
import { useReducedMotion } from './useReducedMotion';
import { annotationElements, revealNotes } from './annotations';
import { GraphPlot } from './GraphPlot';
import { correctionLabels, fingerprint, inkSymbolKey, isStudent, renderableActions, type BoardState } from './boardState';
import type { Settings } from './storage';
import { messages } from './i18n';
import type { StepVerdict } from '@openmathtutor/shared';
import type { TutorRect } from './tutorPosition';

export interface BoardHandle {
  registerStepLocator(locator: StepLocator): () => void;
  stepViewportRect(stepId: string): TutorRect | null;
  contentViewportRects(): TutorRect[];
  addLine(text: string, stepId: string | null): void;
  /** Remove the student's own ink of one written line (one row of a multiline text keeps its siblings). */
  removeStepLine(stepId: string): boolean;
  crop(state: BoardState, stepId?: string): Promise<{ dataUrl: string; width: number; height: number }>;
  exportImage(kind: 'png' | 'svg'): Promise<Blob | null>;
}
interface Props {
  board: BoardState; settings: Settings;
  onCommit(elements: readonly ExcalidrawElement[], files: BinaryFiles): void;
  onBusy(busy: boolean): void;
  onInkCorrection?(key: string, label: string): void;
  onAskHere?(): void;
  verdicts?: Record<string, StepVerdict>;
  onRemoveAnnotation?(id: string): void;
}
export const Board = forwardRef<BoardHandle, Props>(function Board({ board, settings, onCommit, onBusy, onInkCorrection, onAskHere, verdicts, onRemoveAnnotation }, ref) {
  const [api, setApi] = useState<ExcalidrawImperativeAPI | null>(null);
  const surface = useRef<HTMLDivElement>(null);
  const [view, setView] = useState({ x: 0, y: 0, zoom: 1 });
  const viewRef = useRef(view);
  const pointerDown = useRef(false);
  const editing = useRef(false);
  const wasEditing = useRef(false);
  const releaseFrame = useRef(0);
  const actions = useMemo(() => renderableActions(board), [board]);
  const reduced = useReducedMotion();
  const boardRef = useRef(board); boardRef.current = board;
  const [locatorVersion, setLocatorVersion] = useState(0);
  const registry = useMemo(() => createStepLocatorRegistry((id, symbol) =>
    textStepLocator(boardRef.current.steps, api?.getSceneElements() ?? boardRef.current.elements)(id, symbol)), [api]);
  const notes = useMemo(() => annotationElements(actions, registry.locate,
    board.elements.filter(e => !e.isDeleted && isStudent(e)).map(e => {
      const w = Math.abs(e.width), h = Math.abs(e.height), c = Math.abs(Math.cos(e.angle)), s = Math.abs(Math.sin(e.angle));
      const width = w * c + h * s, height = w * s + h * c;
      return { x: e.x + w / 2 - width / 2, y: e.y + h / 2 - height / 2, width, height };
    // locatorVersion: an external locator was (un)registered, so positions must be recomputed.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    })), [actions, board.elements, registry, locatorVersion]);
  const writingStarts = useRef(new Map<string, { signature: string; start: number }>());
  const [writing, setWriting] = useState<Set<string>>(new Set());
  const t = messages[settings.locale];
  const [menu_, setMenu] = useState<{ x: number; y: number; px: number; py: number; selected: boolean } | null>(null);
  const hold = useRef<{ timer: ReturnType<typeof setTimeout>; x: number; y: number } | null>(null);
  const cancelHold = () => { if (hold.current) { clearTimeout(hold.current.timer); hold.current = null; } };
  function startHold(e: React.PointerEvent<HTMLDivElement>) {
    if ((e.target as Element).closest('.ctx-menu')) return;
    setMenu(null); cancelHold();
    if (!api || e.button !== 0 || !['selection', 'text', 'hand'].includes(api.getAppState().activeTool.type) || !(e.target as Element).closest('.excalidraw__canvas')) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const px = e.clientX - rect.left, py = e.clientY - rect.top;
    hold.current = { x: e.clientX, y: e.clientY, timer: setTimeout(() => {
      hold.current = null;
      const state = api.getAppState();
      setMenu({ x: px, y: py, px: px / state.zoom.value - state.scrollX, py: py / state.zoom.value - state.scrollY,
        selected: Object.keys(state.selectedElementIds).length > 0 });
    }, 500) };
  }
  function moveHold(e: React.PointerEvent<HTMLDivElement>) {
    if (hold.current && Math.hypot(e.clientX - hold.current.x, e.clientY - hold.current.y) > 6) cancelHold();
  }
  function panByKey(e: React.KeyboardEvent<HTMLDivElement>) {
    if (!api || !e.key.startsWith('Arrow') || e.ctrlKey || e.metaKey || e.altKey) return;
    if ((e.target as Element).closest('input, textarea, select, [contenteditable="true"]')) return;
    const state = api.getAppState();
    if (state.editingTextElement || Object.keys(state.selectedElementIds).length) return;
    const step = (e.shiftKey ? 240 : 60) / state.zoom.value;
    const dx = e.key === 'ArrowLeft' ? step : e.key === 'ArrowRight' ? -step : 0;
    const dy = e.key === 'ArrowUp' ? step : e.key === 'ArrowDown' ? -step : 0;
    e.preventDefault();
    api.updateScene({ appState: { scrollX: state.scrollX + dx, scrollY: state.scrollY + dy } });
  }
  function menuAction(action: 'text' | 'eraser' | 'ask' | 'zoom' | 'fit' | 'delete') {
    if (!api || !menu_) return;
    const state = api.getAppState();
    if (action === 'text') api.setActiveTool({ type: 'text' });
    else if (action === 'eraser') api.setActiveTool({ type: 'eraser' });
    else if (action === 'ask') onAskHere?.();
    else if (action === 'zoom') {
      const value = Math.min(4, state.zoom.value * 1.5) as typeof state.zoom.value;
      api.updateScene({ appState: { zoom: { value }, scrollX: menu_.x / value - menu_.px, scrollY: menu_.y / value - menu_.py } });
    } else if (action === 'fit') api.scrollToContent(undefined, { fitToViewport: true, viewportZoomFactor: 0.8, animate: true });
    else {
      const selected = state.selectedElementIds;
      api.updateScene({ elements: api.getSceneElementsIncludingDeleted().map(el => selected[el.id] && isStudent(el)
        ? { ...el, isDeleted: true, version: el.version + 1, versionNonce: Math.floor(Math.random() * 2 ** 31) } : el),
        captureUpdate: CaptureUpdateAction.IMMEDIATELY });
    }
    setMenu(null);
  }
  const menu = useMemo(() => <MainMenu><MainMenu.DefaultItems.ClearCanvas /></MainMenu>, []);
  const initial = useRef({ elements: structuredClone(board.elements), files: board.files,
    appState: { scrollX: 0, scrollY: 0, viewBackgroundColor: 'transparent' } });
  useEffect(() => {
    if (!api) return;
    let cursor = Date.now();
    const ids = new Set(notes.map(n => n.action.id));
    for (const id of writingStarts.current.keys()) if (!ids.has(id)) writingStarts.current.delete(id);
    for (const note of notes) {
      const signature = JSON.stringify({ ...note.action, boardRevision: 0 });
      const old = writingStarts.current.get(note.action.id);
      if (old?.signature !== signature) {
        writingStarts.current.set(note.action.id, { signature, start: cursor });
        cursor += note.duration + 90;
      }
    }
    let timer: ReturnType<typeof setInterval> | undefined;
    const paint = () => {
      const active = new Set<string>();
      const shapes = settings.showAI ? notes.flatMap(note => {
        const elapsed = reduced ? Infinity : Date.now() - writingStarts.current.get(note.action.id)!.start;
        if (elapsed < note.duration) active.add(note.action.id);
        return revealNotes([note], elapsed);
      }) : [];
      // Read live student elements each frame; never write a lagging React copy
      // over a pen stroke or feed teacher frames into OCR/revision tracking.
      const student = api.getSceneElementsIncludingDeleted().filter(isStudent);
      api.updateScene({ elements: [...student, ...shapes], captureUpdate: CaptureUpdateAction.NEVER });
      setWriting(active);
      if (!active.size && timer) clearInterval(timer);
    };
    paint();
    if (!reduced && settings.showAI) timer = setInterval(paint, 32);
    return () => clearInterval(timer);
  }, [api, notes, reduced, settings.showAI]);
  useEffect(() => () => { cancelAnimationFrame(releaseFrame.current); if (hold.current) clearTimeout(hold.current.timer); }, []);
  // The board is the only input: the configured default tool puts the cursor (or the
  // pen) right where the student writes, without a trip to the toolbar.
  useEffect(() => { if (api) api.setActiveTool({ type: settings.defaultTool, locked: true }); }, [api, settings.defaultTool]);
  useImperativeHandle(ref, () => ({
    registerStepLocator(locator) {
      const unregister = registry.registerStepLocator(locator);
      setLocatorVersion(v => v + 1);
      return () => { unregister(); setLocatorVersion(v => v + 1); };
    },
    stepViewportRect(stepId) {
      if (!api || !surface.current) return null;
      const box = registry.locate(stepId);
      if (!box) return null;
      const { x, y: lineY, width, height } = box;
      const state = api.getAppState(), rect = surface.current.getBoundingClientRect();
      return { x: rect.left + (x + state.scrollX) * state.zoom.value, y: rect.top + (lineY + state.scrollY) * state.zoom.value,
        width: width * state.zoom.value, height: height * state.zoom.value };
    },
    contentViewportRects() {
      if (!api || !surface.current) return [];
      const state = api.getAppState(), rect = surface.current.getBoundingClientRect();
      const student = api.getSceneElementsIncludingDeleted().filter(e => !e.isDeleted && isStudent(e));
      const elementRects: TutorRect[] = student.map(e => {
        const w = Math.abs(e.width), h = Math.abs(e.height), c = Math.abs(Math.cos(e.angle)), s = Math.abs(Math.sin(e.angle));
        const width = (w * c + h * s) * state.zoom.value;
        const height = (w * s + h * c) * state.zoom.value;
        const x = rect.left + (e.x + w / 2 - (w * c + h * s) / 2 + state.scrollX) * state.zoom.value;
        const y = rect.top + (e.y + h / 2 - (w * s + h * c) / 2 + state.scrollY) * state.zoom.value;
        return { x, y, width, height };
      });
      const markRects: TutorRect[] = [...document.querySelectorAll<HTMLElement>('.step-mark')].map(m => {
        const r = m.getBoundingClientRect();
        return { x: r.left, y: r.top, width: r.width, height: r.height };
      });
      return [...elementRects, ...markRects];
    },
    addLine(text, stepId) {
      if (!api) return;
      const step = board.steps.find(s => s.stepId === stepId);
      const oldIds = new Set(step?.elementIds ?? []);
      const elements = api.getSceneElementsIncludingDeleted().filter(e => isStudent(e) && !oldIds.has(e.id));
      const line = convertToExcalidrawElements([{ type: 'text', id: step?.elementIds[0] ?? crypto.randomUUID(),
        x: step?.box.x ?? 240, y: step?.box.y ?? Math.max(120, ...board.steps.map(s => s.box.y + s.box.height + 72)),
        text, fontSize: 26, fontFamily: 1 /* Virgil — hand-drawn, matches writing on an actual board */, strokeColor: '#202a2a' }], { regenerateIds: false });
      const next = [...elements, ...line];
      api.updateScene({ elements: structuredClone(next), captureUpdate: CaptureUpdateAction.IMMEDIATELY });
      onCommit(next, api.getFiles());
    },
    removeStepLine(stepId) {
      if (!api) return false;
      const step = board.steps.find(s => s.stepId === stepId || stepId.startsWith(`${s.stepId}#`));
      if (!step) return false;
      const ids = new Set(step.elementIds);
      const all = api.getSceneElementsIncludingDeleted().filter(isStudent);
      const own = all.filter(e => ids.has(e.id) && !e.isDeleted);
      if (!own.length) return false;
      const index = stepId === step.stepId ? null : Number(stepId.slice(step.stepId.length + 1));
      const text = own.length === 1 && own[0].type === 'text' ? own[0] : null;
      const rows = text ? text.text.split('\n') : [];
      const target = text && index !== null ? rows.map((row, n) => ({ row, n })).filter(r => r.row.trim())[index]?.n : undefined;
      const rest = target === undefined ? '' : rows.filter((_, n) => n !== target).join('\n');
      const bump = (e: ExcalidrawElement) => ({ ...e, isDeleted: true, version: e.version + 1, versionNonce: Math.floor(Math.random() * 2 ** 31) });
      const next = all.flatMap<ExcalidrawElement>(e => {
        if (!ids.has(e.id) || e.isDeleted) return [e];
        if (text && e.id === text.id && rest.trim()) {
          return convertToExcalidrawElements([{ type: 'text', id: e.id, x: text.x, y: text.y, text: rest,
            fontSize: text.fontSize, fontFamily: text.fontFamily, strokeColor: text.strokeColor }], { regenerateIds: false });
        }
        return [bump(e)];
      });
      api.updateScene({ elements: structuredClone(next), captureUpdate: CaptureUpdateAction.IMMEDIATELY });
      onCommit(next, api.getFiles());
      return true;
    },
    async exportImage(kind) {
      if (!api) return null;
      const elements = [...api.getSceneElements().filter(isStudent), ...(settings.showAI ? notes.flatMap(n => n.elements) : [])];
      if (!elements.length) return null;
      const appState = { exportBackground: true, viewBackgroundColor: '#ffffff', exportWithDarkMode: false };
      if (kind === 'png') return exportToBlob({ elements, files: api.getFiles(), mimeType: 'image/png', exportPadding: 32, appState });
      const svg = await exportToSvg({ elements, files: api.getFiles(), exportPadding: 32, appState });
      return new Blob([svg.outerHTML], { type: 'image/svg+xml' });
    },
    async crop(snapshot, stepId) {
      const step = snapshot.steps.find(s => s.stepId === (stepId ?? snapshot.activeStepId));
      if (!step) throw new Error('No active line');
      const ids = new Set(step.elementIds);
      const elements = snapshot.elements.filter(e => !e.isDeleted && ids.has(e.id)) as NonDeletedExcalidrawElement[];
      if (!elements.length) throw new Error('No active line');
      // Only the active row, never an unconditional whole-board screenshot. Export dimensions are bounded.
      const canvas = await exportToCanvas({ elements, files: snapshot.files, exportPadding: 20, maxWidthOrHeight: 1024,
        appState: { exportBackground: true, viewBackgroundColor: '#ffffff', exportWithDarkMode: false } });
      return { dataUrl: canvas.toDataURL('image/png'), width: canvas.width, height: canvas.height };
    },
  }), [api, board, onCommit, registry, notes, settings.showAI]);
  function change(elements: readonly ExcalidrawElement[], state: AppState, files: BinaryFiles) {
    if (viewRef.current.x !== state.scrollX || viewRef.current.y !== state.scrollY || viewRef.current.zoom !== state.zoom.value) {
      viewRef.current = { x: state.scrollX, y: state.scrollY, zoom: state.zoom.value };
      setView(viewRef.current);
    }
    if (surface.current && surface.current.dataset.tool !== state.activeTool.type) surface.current.dataset.tool = state.activeTool.type;
    // When a line is finished, go back to the configured default tool so the next
    // click (text) or stroke (pen) starts the next line.
    // A finished text stays selected, and the text tool would re-open that one instead of starting a new line: deselect it.
    if (wasEditing.current && !state.editingTextElement) {
      if (state.activeTool.type !== settings.defaultTool) api?.setActiveTool({ type: settings.defaultTool, locked: true });
      if (Object.keys(state.selectedElementIds).length) api?.updateScene({ appState: { selectedElementIds: {} } });
    }
    wasEditing.current = !!state.editingTextElement;
    const busy = pointerDown.current || !!state.editingTextElement;
    if (editing.current !== busy) { editing.current = busy; onBusy(busy); }
    if (!busy && (fingerprint(elements) !== fingerprint(board.elements) || files !== board.files)) onCommit(elements, files);
  }
  const cell = 32 * view.zoom;
  const paper = { '--cell': `${cell}px`, '--ox': `${(view.x * view.zoom) % cell}px`, '--oy': `${(view.y * view.zoom) % cell}px`,
    '--margin-x': `${(96 + view.x) * view.zoom}px` } as CSSProperties;
  return <div ref={surface} className="board-surface" data-testid="board" data-pattern={settings.boardPattern} style={paper} aria-label={t.board}
    data-zoom={view.zoom} data-scroll-x={view.x} data-scroll-y={view.y}
    onPointerDownCapture={startHold} onPointerMove={moveHold} onPointerUp={cancelHold} onPointerCancel={cancelHold}
    onKeyDown={e => {
      if (e.key === 'Escape') { setMenu(null); setTimeout(() => { if (api && !api.getAppState().editingTextElement) api.setActiveTool({ type: settings.defaultTool, locked: true }); }, 0); }
      panByKey(e);
    }}>
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
    <div className="teacher-layer" aria-label={t.annotations}>
      {settings.showAI && notes.map(note => <button key={note.action.id}
        type="button" className="teacher-note-delete" data-testid={note.action.type === 'write_math' ? 'math-annotation' : 'teacher-annotation'}
        data-action-type={note.action.type} data-annotation-id={note.action.id} data-writing={writing.has(note.action.id)}
        data-scene-box={JSON.stringify(note.box)}
        aria-label={`${t.eraseTeacherNote}: ${note.text || note.action.type}`} title={t.eraseTeacherNote}
        onClick={() => onRemoveAnnotation?.(note.action.id)}
        style={{ left: (note.deleteBox.x + view.x) * view.zoom, top: (note.deleteBox.y + view.y) * view.zoom }}>
        <svg viewBox="0 0 16 16" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" aria-hidden="true"><path d="M3 3l10 10M13 3L3 13" /></svg><span className="sr">{note.text}</span>
      </button>)}
    </div>
    <div className="graph-layer" aria-live="polite">
      {settings.showAI && actions.filter(a => a.type === 'plot_function').map(a => a.type === 'plot_function' && (
        <div key={a.id} className="graph-annotation" style={{
          left: (a.anchor.x + view.x) * view.zoom, top: (a.anchor.y + view.y) * view.zoom,
          transform: `scale(${view.zoom})`,
        }}><small>{t.aiBadge}</small><GraphPlot action={a} /></div>
      ))}
    </div>
    <div className="mark-layer">
      {board.steps.map(step => {
        const v = verdicts?.[step.stepId];
        if (!v || v.status === 'unknown') return null;
        return <span key={step.stepId} data-testid={`step-mark-${v.status}`} className={`step-mark ${v.status}`}
          title={v.status === 'ok' ? t.stepOk : t.stepWrong} role="img" aria-label={v.status === 'ok' ? t.stepOk : t.stepWrong}
          style={{ left: (step.box.x + step.box.width + 10 + view.x) * view.zoom, top: (step.box.y + view.y) * view.zoom }}>
          {v.status === 'ok' ? '✓' : '✗'}</span>;
      })}
    </div>
    <div className="ink-layer">
      {board.steps.filter(step => step.origin === 'ink' && step.latexGuess.trim()).map(step => {
        const soft = step.uncertain ? (step.symbols ?? []).map((symbol, index) => ({ symbol, index }))
          .filter(({ symbol }) => symbol.uncertain || !step.parserCompatible).slice(0, 6) : [];
        return <div key={step.stepId} className={`ink-reading${step.uncertain ? ' uncertain' : ''}`}
          data-testid={`ink-reading-${step.stepId}`} data-confidence={step.confidence ?? 0}
          style={{ left: (step.box.x + view.x) * view.zoom, top: (step.box.y + step.box.height + 4 + view.y) * view.zoom }}>
          <span className="ink-read-label" title={step.uncertain ? t.handwritingUncertain : undefined}>
            {t.handwritingRead} <strong>{step.latexGuess}</strong>{step.uncertain ? ` — ${t.handwritingUncertain}` : ''}
          </span>
          {soft.length > 0 && <span className="ink-candidates" aria-label={t.handwritingCorrect} style={{ left: Math.max(180, step.box.width * view.zoom + 32) }}>
            {soft.flatMap(({ symbol, index }) => correctionLabels(symbol).map(label => ({ label }))
              .map(candidate => <button key={`${index}-${candidate.label}`} type="button"
                data-testid={`ink-candidate-${step.stepId}-${index}-${candidate.label}`}
                aria-label={`${t.handwritingCorrect}: ${index + 1}. ${t.handwritingSymbol} „${symbol.label ?? symbol.candidates[0]?.label}“ → „${candidate.label}“`}
                title={`${index + 1}. ${t.handwritingSymbol}: ${symbol.label ?? symbol.candidates[0]?.label} → ${candidate.label}`}
                onPointerDown={event => event.stopPropagation()}
                onClick={event => { event.stopPropagation(); onInkCorrection?.(inkSymbolKey(symbol.strokeIds, board.elements), candidate.label); }}>
                {candidate.label}</button>))}
          </span>}
        </div>;
      })}
    </div>
    {menu_ && <div className="ctx-menu" role="menu" aria-label={t.ctxMenu} style={{ left: menu_.x, top: menu_.y }}>
      <button role="menuitem" onClick={() => menuAction('text')}>{t.ctxText}</button>
      <button role="menuitem" onClick={() => menuAction('eraser')}>{t.ctxEraser}</button>
      <button role="menuitem" onClick={() => menuAction('ask')}>{t.ctxAsk}</button>
      <button role="menuitem" onClick={() => menuAction('zoom')}>{t.ctxZoomHere}</button>
      <button role="menuitem" onClick={() => menuAction('fit')}>{t.ctxFit}</button>
      {menu_.selected && <button role="menuitem" onClick={() => menuAction('delete')}>{t.ctxDelete}</button>}
    </div>}
    {settings.showAI && actions.length > 0 && <span className="layer-badge">{t.aiBadge} · {t.annotations}</span>}
  </div>;
});

