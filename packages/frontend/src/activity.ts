import { useEffect, useRef, useSyncExternalStore } from 'react';

/**
 * Quiet time after a pen stroke before the written line counts as finished.
 * Measured pauses between digits of one handwritten number reach 2 s; a
 * shorter window judged half-written lines (`12+7=1` before the final `9`).
 */
export const PEN_PAUSE_MS = 2400;
/** Krátká pauza pro pochvalu; oprava čeká celou PEN_PAUSE_MS. */
export const PEN_QUICK_MS = 450;
/** Quiet time after the end of a typed line (Escape, Ctrl+Enter or a click elsewhere); the line is complete, so this is short. */
export const TEXT_PAUSE_MS = 220;
/** While typing, the mascot keeps watching until the keys stay quiet this long. */
const TYPING_HOLD_MS = 900;
/** The "checking" look stays up a moment longer than the pause so the verdict can take over smoothly. */
const CHECKING_TAIL_MS = 160;

export type WritingPhase = 'idle' | 'writing' | 'checking';
export interface Point { x: number; y: number }
export type InputKind = 'pen' | 'text';

/**
 * What the student's hands are doing right now, independent of React: pen down, last stroke position,
 * and when the last line ended. The coach asks it "is the line finished?" instead of using a fixed debounce.
 */
export class BoardActivity {
  penDown = false;
  strokeVersion = 0;
  point: Point | null = null;
  lastKind: InputKind | null = null;
  private lastEndAt = Number.NEGATIVE_INFINITY;
  private _phase: WritingPhase = 'idle';
  private timer: ReturnType<typeof setTimeout> | undefined;
  private readonly phaseListeners = new Set<() => void>();
  private readonly pointListeners = new Set<(point: Point) => void>();
  constructor(private readonly now: () => number = () => performance.now()) {}

  get phase(): WritingPhase { return this._phase; }
  pause(negative = true): number {
    if (this.lastKind === 'pen') return negative ? PEN_PAUSE_MS : PEN_QUICK_MS;
    return TEXT_PAUSE_MS;
  }
  /** Milliseconds until the last line counts as finished; a pen that is down is never finished. */
  remaining(negative = true): number {
    if (this.penDown) return this.pause(negative);
    return Math.max(0, this.lastEndAt + this.pause(negative) - this.now());
  }

  penStart(point: Point) {
    this.strokeVersion++;
    this.penDown = true; this.lastKind = 'pen'; this.moveTo(point);
    this.setPhase('writing');
  }
  penMove(point: Point) { if (this.penDown) this.moveTo(point); }
  penEnd() {
    if (!this.penDown) return;
    this.penDown = false; this.lastEndAt = this.now();
    this.setPhase('checking', PEN_PAUSE_MS + CHECKING_TAIL_MS);
  }
  /** A key press inside the text editor; Escape or Ctrl+Enter ends the line. */
  key(endOfLine: boolean) {
    this.lastKind = 'text'; this.lastEndAt = this.now();
    if (endOfLine) this.setPhase('checking', TEXT_PAUSE_MS + CHECKING_TAIL_MS);
    else this.setPhase('writing', TYPING_HOLD_MS);
  }
  /** A click away from an open editor also finishes the typed line. */
  textLineEnded() {
    this.lastKind = 'text'; this.lastEndAt = this.now();
    this.setPhase('checking', TEXT_PAUSE_MS + CHECKING_TAIL_MS);
  }
  reset() { clearTimeout(this.timer); this.penDown = false; this._phase = 'idle'; this.emitPhase(); }
  dispose() { clearTimeout(this.timer); this.phaseListeners.clear(); this.pointListeners.clear(); }

  subscribePhase(listener: () => void) { this.phaseListeners.add(listener); return () => { this.phaseListeners.delete(listener); }; }
  subscribePoint(listener: (point: Point) => void) { this.pointListeners.add(listener); return () => { this.pointListeners.delete(listener); }; }

  private moveTo(point: Point) { this.point = point; for (const l of this.pointListeners) l(point); }
  private emitPhase() { for (const l of this.phaseListeners) l(); }
  private setPhase(phase: WritingPhase, holdMs?: number) {
    clearTimeout(this.timer);
    if (this._phase !== phase) { this._phase = phase; this.emitPhase(); }
    if (holdMs !== undefined) this.timer = setTimeout(() => this.setPhase('idle'), holdMs);
  }
}

const DRAWING_TOOLS = new Set(['freedraw', 'line', 'arrow', 'rectangle', 'ellipse', 'diamond']);
const surfaceOf = (target: EventTarget | null) => (target instanceof Element ? target.closest<HTMLElement>('.board-surface') : null);
const inEditor = (target: EventTarget | null) => target instanceof Element && !!target.closest('.excalidraw textarea, .excalidraw [contenteditable="true"]');

/** One activity tracker for the whole app, fed by document-level listeners so the board component stays untouched. */
export function useBoardActivity(): { activity: BoardActivity; phase: WritingPhase } {
  const ref = useRef<BoardActivity>();
  ref.current ??= new BoardActivity();
  const activity = ref.current;
  useEffect(() => {
    const down = (e: PointerEvent) => {
      const surface = surfaceOf(e.target);
      if (!surface || (e.target as Element).closest('.ctx-menu, .Island, footer, .layer-badge')) return;
      const tool = surface.dataset.tool ?? '';
      if (DRAWING_TOOLS.has(tool)) activity.penStart({ x: e.clientX, y: e.clientY });
      else if (tool === 'text' && document.querySelector('.excalidraw textarea.excalidraw-wysiwyg')) activity.textLineEnded();
    };
    const move = (e: PointerEvent) => { if (activity.penDown) activity.penMove({ x: e.clientX, y: e.clientY }); };
    const up = () => activity.penEnd();
    const key = (e: KeyboardEvent) => { if (inEditor(e.target)) activity.key(e.key === 'Escape' || (e.key === 'Enter' && (e.ctrlKey || e.metaKey))); };
    document.addEventListener('pointerdown', down, true);
    document.addEventListener('pointermove', move, true);
    document.addEventListener('pointerup', up, true);
    document.addEventListener('pointercancel', up, true);
    document.addEventListener('keydown', key, true);
    return () => {
      document.removeEventListener('pointerdown', down, true);
      document.removeEventListener('pointermove', move, true);
      document.removeEventListener('pointerup', up, true);
      document.removeEventListener('pointercancel', up, true);
      document.removeEventListener('keydown', key, true);
      activity.reset();
    };
  }, [activity]);
  const phase = useSyncExternalStore(l => activity.subscribePhase(l), () => activity.phase);
  return { activity, phase };
}

/**
 * Points the mascot's eyes and pencil at the last stroke by writing CSS variables on `element`.
 * Runs outside React (one rAF per frame at most), so following the pen never re-renders anything.
 */
export function bindGaze(activity: BoardActivity, element: HTMLElement): () => void {
  let frame = 0;
  const apply = (point: Point) => {
    if (frame) return;
    frame = requestAnimationFrame(() => {
      frame = 0;
      const box = element.getBoundingClientRect();
      const dx = point.x - (box.left + box.width / 2), dy = point.y - (box.bottom - 36);
      const length = Math.hypot(dx, dy) || 1;
      const reach = Math.min(1, length / 240);
      element.style.setProperty('--gaze-x', (dx / length * reach).toFixed(3));
      element.style.setProperty('--gaze-y', (dy / length * reach).toFixed(3));
    });
  };
  if (activity.point) apply(activity.point);
  const off = activity.subscribePoint(apply);
  return () => { off(); cancelAnimationFrame(frame); };
}
