import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { BoardActivity, PEN_PAUSE_MS, TEXT_PAUSE_MS, bindGaze } from './activity';

let clock = 0;
const make = () => new BoardActivity(() => clock);
beforeEach(() => { vi.useFakeTimers(); clock = 0; });
afterEach(() => { vi.useRealTimers(); vi.unstubAllGlobals(); });
const advance = (ms: number) => { clock += ms; vi.advanceTimersByTime(ms); };

it('never calls a line finished while the pen is down, then waits the pen pause after the lift', () => {
  const a = make();
  a.penStart({ x: 10, y: 10 });
  expect(a.phase).toBe('writing');
  advance(5000);
  expect(a.remaining()).toBe(PEN_PAUSE_MS);
  a.penEnd();
  expect(a.phase).toBe('checking');
  expect(a.remaining()).toBe(PEN_PAUSE_MS);
  advance(PEN_PAUSE_MS - 50);
  expect(a.remaining()).toBe(50);
  advance(50);
  expect(a.remaining()).toBe(0);
});

it('a second stroke inside the pause restarts it, so "5 + 2 =" is not judged before the next digit', () => {
  const a = make();
  a.penStart({ x: 0, y: 0 }); a.penEnd();
  advance(300);
  a.penStart({ x: 40, y: 0 });
  expect(a.remaining()).toBe(PEN_PAUSE_MS);
  advance(100); a.penEnd();
  expect(a.remaining()).toBe(PEN_PAUSE_MS);
});

it('a typed line is finished shortly after Escape, not after every key', () => {
  const a = make();
  a.key(false);
  expect(a.phase).toBe('writing');
  advance(TEXT_PAUSE_MS - 20);
  expect(a.remaining()).toBe(20);
  a.key(true);
  expect(a.phase).toBe('checking');
  expect(a.remaining()).toBe(TEXT_PAUSE_MS);
  a.textLineEnded();
  expect(a.lastKind).toBe('text');
});

it('falls back to idle once the checking look has had its time, and typing without Escape stops "watching" by itself', () => {
  const a = make();
  const seen: string[] = [];
  a.subscribePhase(() => seen.push(a.phase));
  a.penStart({ x: 0, y: 0 }); a.penEnd();
  advance(PEN_PAUSE_MS + 200);
  expect(a.phase).toBe('idle');
  a.key(false);
  advance(1000);
  expect(a.phase).toBe('idle');
  expect(seen).toEqual(['writing', 'checking', 'idle', 'writing', 'idle']);
});

it('ignores pen moves and lifts when no stroke is in progress', () => {
  const a = make();
  a.penMove({ x: 5, y: 5 }); a.penEnd();
  expect(a.point).toBeNull();
  expect(a.phase).toBe('idle');
  expect(a.remaining()).toBe(0);
});

it('points the mascot eyes at the last stroke through CSS variables, at most once per frame', () => {
  const frames: FrameRequestCallback[] = [];
  vi.stubGlobal('requestAnimationFrame', (cb: FrameRequestCallback) => frames.push(cb));
  vi.stubGlobal('cancelAnimationFrame', vi.fn());
  const el = document.createElement('button');
  el.getBoundingClientRect = () => ({ left: 900, right: 972, top: 800, bottom: 872, width: 72, height: 72, x: 900, y: 800, toJSON: () => ({}) });
  const a = make();
  const off = bindGaze(a, el);
  a.penStart({ x: 100, y: 836 }); a.penMove({ x: 120, y: 836 }); a.penMove({ x: 140, y: 836 });
  expect(frames).toHaveLength(1);
  frames[0]!(0);
  expect(Number(el.style.getPropertyValue('--gaze-x'))).toBeLessThan(-0.9); // far to the left
  expect(Math.abs(Number(el.style.getPropertyValue('--gaze-y')))).toBeLessThan(0.1);
  off();
});
