import { afterEach, expect, it, vi } from 'vitest';
import { load, save } from './storage';
afterEach(() => { localStorage.clear(); vi.restoreAllMocks(); });
it('persists exercises, step snapshots and complete locale/settings locally', () => {
  const state = load(); state.settings.locale = 'en'; state.settings.theme = 'dark'; state.boards[0].statement = 'x=2';
  expect(save(state)).toBe(true); expect(load()).toEqual(state);
});
it('fails safely on corrupt storage and reports quota failures', () => {
  localStorage.setItem('openmathtutor.frontend.v1', '{bad');
  const state = load(); expect(state.boards).toHaveLength(1);
  vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => { throw new DOMException('quota'); });
  expect(save(state)).toBe(false);
});
