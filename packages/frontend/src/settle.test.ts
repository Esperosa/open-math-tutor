import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { StrokeSettler } from './settle';
beforeEach(() => vi.useFakeTimers());
afterEach(() => vi.useRealTimers());
it('requires two consecutive quiet windows, never a request per stroke', () => {
  const stable = vi.fn(), settle = new StrokeSettler(stable);
  for (let i = 0; i < 30; i++) { settle.update(`stroke-${i}`, true); vi.advanceTimersByTime(50); }
  expect(stable).not.toHaveBeenCalled();
  vi.advanceTimersByTime(1749); expect(stable).not.toHaveBeenCalled();
  vi.advanceTimersByTime(1); expect(stable).toHaveBeenCalledTimes(1);
  settle.update('stroke-29', true); vi.advanceTimersByTime(5000); expect(stable).toHaveBeenCalledTimes(1);
});
it('suspends during pointer/text edits and ignores incomplete lines', () => {
  const stable = vi.fn(), settle = new StrokeSettler(stable);
  settle.update('math', true); vi.advanceTimersByTime(1000);
  settle.update('math', false); vi.advanceTimersByTime(5000); expect(stable).not.toHaveBeenCalled();
  settle.update('math', true); vi.advanceTimersByTime(1800); expect(stable).toHaveBeenCalledOnce();
  settle.update('correction', true); settle.cancel(); vi.advanceTimersByTime(5000); expect(stable).toHaveBeenCalledOnce();
});
