import type { Locale, ProviderId } from '@openmathtutor/shared';
import { newBoard, renderableActions, type BoardState } from './boardState';
export interface Settings {
  locale: Locale; theme: 'light' | 'dark'; auto: boolean; voiceEnabled: boolean; voiceURI: string;
  rate: number; provider: ProviderId | ''; model: string; showAI: boolean;
}
export interface Saved { version: 1; boards: BoardState[]; activeId: string; settings: Settings }
const KEY = 'openmathtutor.frontend.v1';
export const defaultSettings: Settings = { locale: 'cs', theme: 'light', auto: false, voiceEnabled: false, voiceURI: '', rate: 1, provider: '', model: '', showAI: true };
export function load(): Saved {
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) {
      const saved = JSON.parse(raw) as Saved;
      if (saved.version === 1 && Array.isArray(saved.boards) && saved.boards.length > 0
        && saved.boards.every(b => typeof b.id === 'string' && Number.isSafeInteger(b.revision) && b.revision >= 0
          && Array.isArray(b.elements) && Array.isArray(b.steps) && Array.isArray(b.annotations) && Array.isArray(b.history)
          && typeof b.statement === 'string' && typeof b.topic === 'string')
        && saved.settings && ['cs', 'en'].includes(saved.settings.locale)) {
        saved.boards = saved.boards.map(b => ({ ...b, annotations: renderableActions(b) }));
        saved.settings = { ...defaultSettings, ...saved.settings };
        if (!saved.boards.some(b => b.id === saved.activeId)) saved.activeId = saved.boards[0].id;
        return saved;
      }
    }
  } catch { /* Invalid/disabled storage never prevents opening a usable local board. */ }
  const board = newBoard();
  return { version: 1, boards: [board], activeId: board.id, settings: defaultSettings };
}
export function save(value: Saved): boolean {
  try { localStorage.setItem(KEY, JSON.stringify(value)); return true; } catch { return false; }
}
