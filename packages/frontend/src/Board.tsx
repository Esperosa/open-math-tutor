import { forwardRef, useCallback, useEffect, useImperativeHandle, useMemo, useRef, useState } from 'react';
import { CaptureUpdateAction, Excalidraw, MainMenu, convertToExcalidrawElements, exportToBlob, exportToCanvas, exportToSvg } from '@excalidraw/excalidraw';
import type { AppState, BinaryFiles, ExcalidrawImperativeAPI } from '@excalidraw/excalidraw/types';
import type { ExcalidrawElement, NonDeletedExcalidrawElement } from '@excalidraw/excalidraw/element/types';
import { createStepLocatorRegistry, textStepLocator, type StepLocator } from './stepLocator';
import { useReducedMotion } from './useReducedMotion';
import { annotationElements, revealNotes } from './annotations';
import { GraphPlot } from './GraphPlot';
import { correctionLabels, fingerprint, inkSymbolKey, isStudent, renderableActions, type BoardState, type Box } from './boardState';
import type { Settings } from './storage';
import { messages } from './i18n';
import type { StepVerdict } from '@openmathtutor/shared';
import type { TutorRect } from './tutorPosition';
import { pickSymbolGuidesForSymbols } from './uncertaintyGuides';

export interface BoardHandle {
  registerStepLocator(locator: StepLocator): () => void;
  stepViewportRect(stepId: string): TutorRect | null;
  contentViewportRects(): TutorRect[];
  addLine(text: string, stepId: string | null): void;
  /** Remove the student's own ink of one written line (one row of a multiline text keeps its siblings). */
  removeStepLine(stepId: string): boolean;
  crop(state: BoardState, stepId?: string): Promise<{ dataUrl: string; width: number; height: number }>;
  exportImage(kind: 'png' | 'svg'): Promise<Blob | null>;
  ensureVisible(box: Box): void;
  getView(): { scrollX: number; scrollY: number; zoom: number };
}
interface Props {
  board: BoardState; settings: Settings;
  onCommit(elements: readonly ExcalidrawElement[], files: BinaryFiles): void;
  onBusy(busy: boolean): void;
  onInkCorrection?(key: string, label: string): void;
  onInkContextToggle?(stepId: string): void;
  onAskHere?(): void;
  verdicts?: Record<string, StepVerdict>;
  onRemoveAnnotation?(id: string): void;
  onOpenColorLegend?(): void;
  onSendToAi?(stepId: string): void;
  canRequest?: boolean;
  modelSupportsImages?: boolean;
}
export const Board = forwardRef<BoardHandle, Props>(function Board({
  board, settings, onCommit, onBusy, onInkCorrection, onInkContextToggle, onAskHere, verdicts, onRemoveAnnotation,
  onOpenColorLegend, onSendToAi, canRequest, modelSupportsImages,
}, ref) {
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
  const [popoverStepId, setPopoverStepId] = useState<string | null>(null);
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

  // Register task-statement locator as "zadání", "zadani", "task", "statement" so the AI or teacher can target/circle it
  useEffect(() => {
    return registry.registerStepLocator((id) => {
      const norm = id.toLowerCase().trim();
      if (norm === 'zadání' || norm === 'zadani' || norm === 'task' || norm === 'statement' || norm === 'task-statement') {
        const taskNote = notes.find(n => n.action.id.startsWith('task-statement'));
        return taskNote?.box ?? null;
      }
      return null;
    });
  }, [registry, notes]);

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
        // A loaded board from storage with already animated task statement appears immediately without animation
        const isReloadedTask = note.action.id.startsWith('task-statement') && board.taskAnimated;
        const start = isReloadedTask ? 0 : cursor;
        writingStarts.current.set(note.action.id, { signature, start });
        if (!isReloadedTask) cursor += note.duration + 90;
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
  }, [api, notes, reduced, settings.showAI, board.taskAnimated]);

  useEffect(() => () => { cancelAnimationFrame(releaseFrame.current); if (hold.current) clearTimeout(hold.current.timer); }, []);
  // The board is the only input: the configured default tool puts the cursor (or the
  // pen) right where the student writes, without a trip to the toolbar.
  useEffect(() => { if (api) api.setActiveTool({ type: settings.defaultTool, locked: true }); }, [api, settings.defaultTool]);

  const removeStepLine = useCallback((stepId: string) => {
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
  }, [api, board, onCommit]);

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
    removeStepLine,
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
    getView() {
      if (!api) return { scrollX: 0, scrollY: 0, zoom: 1 };
      const st = api.getAppState();
      return { scrollX: st.scrollX, scrollY: st.scrollY, zoom: st.zoom.value };
    },
    ensureVisible(box: Box) {
      if (!api) return;
      const state = api.getAppState();
      let newScrollX = state.scrollX;
      let newScrollY = state.scrollY;
      const screenX = (box.x + state.scrollX) * state.zoom.value;
      const screenY = (box.y + state.scrollY) * state.zoom.value;
      if (screenX < 320) {
        newScrollX = Math.round(340 / state.zoom.value - box.x);
      }
      if (screenY < 60) {
        newScrollY = Math.round(80 / state.zoom.value - box.y);
      }
      if (newScrollX !== state.scrollX || newScrollY !== state.scrollY) {
        api.updateScene({ appState: { scrollX: newScrollX, scrollY: newScrollY } });
      }
    },
  }), [api, board, onCommit, registry, notes, settings.showAI, removeStepLine]);

  function change(elements: readonly ExcalidrawElement[], state: AppState, files: BinaryFiles) {
    if (viewRef.current.x !== state.scrollX || viewRef.current.y !== state.scrollY || viewRef.current.zoom !== state.zoom.value) {
      viewRef.current = { x: state.scrollX, y: state.scrollY, zoom: state.zoom.value };
      setView(viewRef.current);
    }
    const textEditing = !!state.editingTextElement;
    if (editing.current !== textEditing) {
      editing.current = textEditing;
      if (textEditing) wasEditing.current = true;
      onBusy(pointerDown.current || textEditing);
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
  function pointerDownHandler() {
    cancelAnimationFrame(releaseFrame.current);
    pointerDown.current = true;
    onBusy(true);
  }
  function pointerUpHandler() {
    cancelHold();
    // Excalidraw finishes its stroke after this callback; commit the finalized scene next frame.
    releaseFrame.current = requestAnimationFrame(() => {
      pointerDown.current = false;
      editing.current = !!api?.getAppState().editingTextElement;
      onBusy(editing.current);
      if (api && !editing.current) onCommit(api.getSceneElementsIncludingDeleted().filter(isStudent), api.getFiles());
    });
  }

  return <div ref={surface} className="board-surface" data-testid="board" data-zoom={view.zoom} data-scroll-x={view.x} data-scroll-y={view.y} data-tool={api?.getAppState().activeTool.type}
    data-pattern={settings.boardPattern} tabIndex={0} onKeyDown={e => { if (e.key === 'Escape') setMenu(null); panByKey(e); }} onPointerDown={startHold} onPointerMove={moveHold} onPointerUp={cancelHold} onPointerCancel={cancelHold} onPointerUpCapture={cancelHold} onPointerCancelCapture={cancelHold}
    style={{
      '--cell': `${Math.round(48 * view.zoom)}px`,
      '--ox': `${Math.round(view.x * view.zoom)}px`,
      '--oy': `${Math.round(view.y * view.zoom)}px`,
      '--margin-x': `${Math.round((view.x + 80) * view.zoom)}px`,
    } as React.CSSProperties}>
    <Excalidraw excalidrawAPI={setApi} initialData={initial.current} onChange={change}
      onPointerDown={pointerDownHandler} onPointerUp={pointerUpHandler}
      viewModeEnabled={false} zenModeEnabled={false} gridModeEnabled={false} theme={settings.theme}
      renderTopRightUI={() => <div className="excalidraw-custom-spacer" />}
      UIOptions={{ canvasActions: { loadScene: false, saveToActiveFile: false, export: false, saveAsImage: false, toggleTheme: false } }}>
      {menu}
    </Excalidraw>
    <div className="teacher-layer" aria-label={t.annotations}>
      {settings.showAI && notes.map(note => <button key={note.action.id}
        type="button" className="teacher-note-delete teacher-note" data-testid={note.action.type === 'write_math' ? 'math-annotation' : 'teacher-annotation'}
        data-action-type={note.action.type} data-annotation-id={note.action.id} data-action-id={note.action.id} data-writing={writing.has(note.action.id)}
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
        const isPopoverOpen = popoverStepId === step.stepId;
        if (!step.uncertain) {
          return <div key={step.stepId} className="ink-reading"
            data-testid={`ink-reading-${step.stepId}`} data-confidence={step.confidence ?? 0}
            style={{ left: (step.box.x + view.x) * view.zoom, top: (step.box.y + step.box.height + 4 + view.y) * view.zoom }}>
            <span className="ink-read-label">
              {t.handwritingRead} <strong>{step.latexGuess}</strong>
              {step.rawText && step.rawText !== step.latexGuess && <span className="ink-raw-reading"> ({t.handwritingOriginally}: {step.rawText})</span>}
            </span>
            {step.rawText && step.contextualText && <button type="button" className="ink-context-toggle"
              data-testid={`ink-context-toggle-${step.stepId}`} onClick={e => { e.stopPropagation(); onInkContextToggle?.(step.stepId); }}
              title={step.contextualized ? t.handwritingShowRaw : t.handwritingUseContext}>
              {step.contextualized ? t.handwritingShowRaw : t.handwritingUseContext}
            </button>}
          </div>;
        }

        const soft = (step.symbols ?? []).map((symbol, index) => ({ symbol, index }))
          .filter(({ symbol }) => symbol.uncertain || !step.parserCompatible).slice(0, 6);
        const guides = pickSymbolGuidesForSymbols(step.symbols);
        const candidates = soft.flatMap(({ symbol, index }) =>
          correctionLabels(symbol).map(label => ({ symbol, index, label }))
        );

        // Kolizní umístění vedle/pod řádek (nepřekrývá rukopis ani HUD)
        const zoom = view.zoom;
        const screenX = (step.box.x + view.x) * zoom;
        const screenY = (step.box.y + view.y) * zoom;
        const screenW = step.box.width * zoom;
        const screenH = step.box.height * zoom;

        const popoverWidth = 340;
        const popoverHeight = isPopoverOpen ? 380 : 200;

        let left = Math.max(16, screenX);
        let top = screenY + screenH + 8;

        const hudLeft = typeof window !== 'undefined' ? window.innerWidth - 360 : 900;
        const hudTop = typeof window !== 'undefined' ? window.innerHeight - 360 : 500;
        const collidesWithHud = left + popoverWidth > hudLeft && top + popoverHeight > hudTop;

        const otherSteps = board.steps.filter(s => s.stepId !== step.stepId);
        const collidesWithOther = otherSteps.some(s => {
          const sx = (s.box.x + view.x) * zoom;
          const sy = (s.box.y + view.y) * zoom;
          const sw = s.box.width * zoom;
          const sh = s.box.height * zoom;
          return left < sx + sw && left + popoverWidth > sx && top < sy + sh && top + popoverHeight > sy;
        });

        if (collidesWithHud || collidesWithOther || (typeof window !== 'undefined' && top + popoverHeight > window.innerHeight - 80)) {
          // Zkus umístění vpravo vedle řádku
          const rightX = screenX + screenW + 16;
          if (typeof window !== 'undefined' && rightX + popoverWidth <= window.innerWidth - 20) {
            left = rightX;
            top = Math.max(16, screenY);
          } else if (screenY - popoverHeight - 8 >= 80) {
            // Zkus nad řádek
            top = screenY - popoverHeight - 8;
          }
        }

        return (
          <div key={step.stepId}
            className="ink-reading uncertain"
            data-testid={`ink-reading-${step.stepId}`}
            data-confidence={step.confidence ?? 0}
            style={{ left: Math.round(left), top: Math.round(top) }}>
            <div className="ink-uncertain-header">
              <span className="ink-read-label">
                {t.handwritingRead} <strong>{step.latexGuess}</strong>
                {step.rawText && step.rawText !== step.latexGuess && <span className="ink-raw-reading"> ({t.handwritingOriginally}: {step.rawText})</span>}
              </span>
              {step.rawText && step.contextualText && <button type="button" className="ink-context-toggle"
                data-testid={`ink-context-toggle-${step.stepId}`} onClick={e => { e.stopPropagation(); onInkContextToggle?.(step.stepId); }}
                title={step.contextualized ? t.handwritingShowRaw : t.handwritingUseContext}>
                {step.contextualized ? t.handwritingShowRaw : t.handwritingUseContext}
              </button>}
              <p className="ink-popover-desc">
                <span className="ink-popover-strong">{t.handwritingUncertain}</span> {t.handwritingUncertainFriendly}
              </p>
            </div>

            {candidates.length > 0 && (
              <div className="ink-popover-section" aria-label={t.handwritingCorrect}>
                <span className="ink-section-title">{t.whichSymbolPrompt || 'Který znak to je?'}</span>
                <div className="ink-candidates-chips" data-testid={`ink-candidates-${step.stepId}`}>
                  {candidates.map(({ symbol, index, label }) => (
                    <button key={`${index}-${label}`} type="button"
                      className="ink-candidate-chip ink-candidate-btn"
                      data-testid={`ink-candidate-${step.stepId}-${index}-${label}`}
                      aria-label={`${t.handwritingCorrect}: ${index + 1}. ${t.handwritingSymbol} „${symbol.label ?? symbol.candidates[0]?.label}“ → „${label}“`}
                      title={`${index + 1}. ${t.handwritingSymbol}: ${symbol.label ?? symbol.candidates[0]?.label} → ${label}`}
                      onPointerDown={event => event.stopPropagation()}
                      onClick={event => { event.stopPropagation(); onInkCorrection?.(inkSymbolKey(symbol.strokeIds, board.elements), label); }}><span className="ink-chip-order" aria-hidden="true" data-order={index + 1} /><span className="ink-chip-symbol">{label}</span></button>
                  ))}
                </div>
              </div>
            )}

            <div className="ink-popover-actions">
              <span role="link" tabIndex={0} className="ink-guide-toggle-btn"
                data-testid={`ink-guide-toggle-${step.stepId}`} aria-expanded={isPopoverOpen}
                onClick={e => { e.stopPropagation(); setPopoverStepId(isPopoverOpen ? null : step.stepId); }}
                onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') { e.stopPropagation(); e.preventDefault(); setPopoverStepId(isPopoverOpen ? null : step.stepId); } }}
                title={t.handwritingGuideBtn}>
                {t.handwritingGuideBtn}
              </span>
            </div>

            {isPopoverOpen && (
              <div className="ink-uncertain-popover" data-testid="ink-uncertain-popover" role="dialog" aria-label={t.handwritingGuideBtn}>
                <div className="ink-guide-patterns" data-testid="ink-guide-patterns">
                  {guides.map(guide => (
                    <div key={guide.id} className="ink-guide-card" data-testid={`guide-${guide.id}`}>
                      <div className="ink-guide-svg-box">
                        <svg viewBox="0 0 40 44" width="40" height="44" aria-hidden="true">
                          {guide.renderSvg()}
                        </svg>
                      </div>
                      <div className="ink-guide-card-info">
                        <strong>{guide.title[settings.locale]}</strong>
                        <small>{guide.tip[settings.locale]}</small>
                      </div>
                    </div>
                  ))}
                </div>
                <div className="ink-popover-subactions">
                  <button type="button" className="ink-action-retry" data-testid={`ink-retry-${step.stepId}`}
                    onClick={e => { e.stopPropagation(); setPopoverStepId(null); removeStepLine(step.stepId); }}>
                    {t.retryWriting}
                  </button>
                  {canRequest && modelSupportsImages ? (
                    <button type="button" className="ink-action-ai" data-testid={`ink-send-ai-${step.stepId}`}
                      onClick={e => { e.stopPropagation(); onSendToAi?.(step.stepId); }}>
                      {t.sendAiReading}
                    </button>
                  ) : (
                    <span className="ink-ai-reason" data-testid="ink-ai-reason">
                      {!canRequest ? t.aiOfflineForImage : t.imageUnsupported}
                    </span>
                  )}
                </div>
              </div>
            )}
          </div>
        );
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
    {settings.showAI && actions.length > 0 && <span className="layer-badge">
      {t.aiBadge} · {t.annotations}
      <button type="button" className="layer-badge-legend-btn" data-testid="layer-badge-legend-btn"
        onClick={onOpenColorLegend} title={t.colorLegendBtn} aria-label={t.colorLegendBtn}>
        ?
      </button>
    </span>}
  </div>;
});
