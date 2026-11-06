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

it('drops broken steps and history entries instead of crashing the render', async () => {
  const { defaultSettings } = await import('./storage');
  const { newBoard } = await import('./boardState');
  const board = { ...newBoard(), steps: [null, { stepId: 's', latexGuess: 1 }, { stepId: 'ok', latexGuess: '2+2', boardRevision: 1, box: { x: 0, y: 0, width: 1, height: 1 }, elementIds: [] }], history: [null, { id: 'h' }] };
  localStorage.setItem('openmathtutor.frontend.v1', JSON.stringify({ version: 1, boards: [board], activeId: board.id, settings: defaultSettings }));
  const loaded = load();
  expect(loaded.boards[0]!.steps.map(s => s.stepId)).toEqual(['ok']);
  expect(loaded.boards[0]!.history).toEqual([]);
});
