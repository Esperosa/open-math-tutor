import { act, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { BoardActivity, PEN_PAUSE_MS, PEN_QUICK_MS } from './activity';
import { useSettledValue } from './settled';

beforeEach(() => vi.useFakeTimers());
afterEach(() => vi.useRealTimers());
const point = { x: 0, y: 0 };
it('shows praise quickly but holds a correction for the full pause', () => {
  const activity = new BoardActivity();
  activity.penStart(point); activity.penEnd();
  const { result, rerender } = renderHook(({ value }) => ({
    ok: useSettledValue(value, activity, 'board', false, ''),
    wrong: useSettledValue(value, activity, 'board', true, ''),
  }), { initialProps: { value: '' } });
  rerender({ value: 'verdict' });
  act(() => vi.advanceTimersByTime(PEN_QUICK_MS + 10));
  expect(result.current).toEqual({ ok: 'verdict', wrong: '' });
  act(() => vi.advanceTimersByTime(PEN_PAUSE_MS - PEN_QUICK_MS));
  expect(result.current.wrong).toBe('verdict');
  act(() => activity.penStart(point));
  expect(result.current).toEqual({ ok: '', wrong: '' });
  act(() => activity.penEnd());
  expect(result.current).toEqual({ ok: '', wrong: '' });
  act(() => vi.advanceTimersByTime(PEN_QUICK_MS + 10));
  expect(result.current).toEqual({ ok: 'verdict', wrong: '' });
});
it('retracts a correction at pen-down and does not resurrect it at pen-up', () => {
  const activity = new BoardActivity();
  const { result } = renderHook(() => useSettledValue('wrong', activity, 'board', true, ''));
  expect(result.current).toBe('wrong');
  act(() => activity.penStart(point));
  expect(result.current).toBe('');
  act(() => vi.advanceTimersByTime(5000));
  expect(result.current).toBe('');
  act(() => activity.penEnd());
  expect(result.current).toBe('');
  act(() => vi.advanceTimersByTime(PEN_PAUSE_MS - 1));
  expect(result.current).toBe('');
  act(() => vi.advanceTimersByTime(10));
  expect(result.current).toBe('wrong');
});
it('cancels a partial-line timer and settles the last digit instead', () => {
  const activity = new BoardActivity();
  activity.penStart(point); activity.penEnd();
  const { result, rerender } = renderHook(({ value }) => useSettledValue(value, activity, 'board', true, ''), {
    initialProps: { value: '' },
  });
  rerender({ value: '12+7=1' });
  act(() => vi.advanceTimersByTime(1800));
  act(() => activity.penStart(point));
  act(() => vi.advanceTimersByTime(800));
  rerender({ value: '12+7=19' });
  act(() => activity.penEnd());
  act(() => vi.advanceTimersByTime(PEN_PAUSE_MS + 10));
  expect(result.current).toBe('12+7=19');
});
