import { numbersIn, type CoachMode, type Locale, type ProviderId } from '@openmathtutor/shared';
import { newBoard, renderableActions, type BoardState } from './boardState';
export interface Settings {
  locale: Locale; theme: 'light' | 'dark'; auto: boolean; voiceEnabled: boolean; voiceURI: string;
  rate: number; provider: ProviderId | ''; model: string; showAI: boolean;
  /** Track the student picked in the onboarding screen. */
  activeTrackId: string;
  /** Shown once until the student picks a track or explicitly skips. */
  onboardingDismissed: boolean;
  /** Starting difficulty (1-3) chosen in onboarding, used for skills without mastery data yet. */
  startLevel: number;
  /** live: check every line as it is written; final: wait for the result; off: stay quiet. */
  coachMode: CoachMode;
  /** The tutor speaks its comments aloud. */
  tutorVoice: boolean;
}
export interface Saved { version: 1; boards: BoardState[]; activeId: string; settings: Settings }
const KEY = 'openmathtutor.frontend.v1';
export const defaultSettings: Settings = {
  locale: 'cs', theme: 'light', auto: false, voiceEnabled: false, voiceURI: '', rate: 1, provider: '', model: '', showAI: true,
  activeTrackId: '', onboardingDismissed: false, startLevel: 1,
  coachMode: 'live', tutorVoice: false,
};
const isObj = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null;
const isBox = (v: unknown) => isObj(v) && ['x', 'y', 'width', 'height'].every(k => Number.isFinite(v[k]));
/** Drops damaged entries (a null step, a history item without text) instead of letting render crash on every reload. */
function sanitizeBoard(board: BoardState): BoardState {
  return { ...board,
    steps: board.steps.filter(s => isObj(s) && typeof s.stepId === 'string' && typeof s.latexGuess === 'string' && isBox(s.box) && Array.isArray(s.elementIds)),
    history: board.history.filter(h => isObj(h) && typeof h.id === 'string' && typeof h.text === 'string' && typeof h.ttsText === 'string'),
    elements: board.elements.filter(e => isObj(e)),
    ...(board.handled && !Array.isArray(board.handled) ? { handled: [] } : {}),
    ...(board.expected && !(Number.isFinite(board.expected.value) && Number.isFinite(board.expected.tolerance)) ? { expected: undefined } : {}),
    // Boards saved before 'givens' existed: rebuild them from the statement so word-problem data lines are still recognised.
    ...(board.expected?.wordProblem && !Array.isArray(board.expected.givens) ? { expected: { ...board.expected, givens: numbersIn(board.statement) } } : {}) };
}
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
        saved.boards = saved.boards.map(sanitizeBoard).map(b => ({ ...b, annotations: renderableActions(b) }));
        saved.settings = { ...defaultSettings, ...saved.settings };
        if (!['live', 'final', 'off'].includes(saved.settings.coachMode)) saved.settings.coachMode = defaultSettings.coachMode;
        // The tutor is silent by default; a one-time reset mutes users who had the old default (voice on).
        if (!localStorage.getItem('openmathtutor.voice-default.v2')) { saved.settings.tutorVoice = false; localStorage.setItem('openmathtutor.voice-default.v2', '1'); }
        if (!['light', 'dark'].includes(saved.settings.theme)) saved.settings.theme = defaultSettings.theme;
        if (!Number.isFinite(saved.settings.rate)) saved.settings.rate = defaultSettings.rate;
        if (![1, 2, 3].includes(saved.settings.startLevel)) saved.settings.startLevel = defaultSettings.startLevel;
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
