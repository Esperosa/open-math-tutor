import { createMasteryState, type MasteryState } from '@openmathtutor/shared';

// Separate storage key from the board/settings blob (storage.ts) so a
// mastery-schema change never risks the board save path or vice versa.
const KEY = 'openmathtutor.mastery.v1';
export type MasteryMap = Record<string, MasteryState>;

function isMasteryState(value: unknown): value is MasteryState {
  if (typeof value !== 'object' || value === null) return false;
  const v = value as Record<string, unknown>;
  return typeof v.skillId === 'string' && Number.isSafeInteger(v.difficultyLevel)
    && Number.isSafeInteger(v.correctStreak) && Number.isSafeInteger(v.incorrectStreak)
    && Number.isSafeInteger(v.attempts) && (v.masteredAt === null || Number.isSafeInteger(v.masteredAt))
    && Number.isSafeInteger(v.lastPracticedAt);
}

export function loadMastery(): MasteryMap {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw) as unknown;
    if (typeof parsed !== 'object' || parsed === null) return {};
    const entries = Object.entries(parsed as Record<string, unknown>).filter(([, v]) => isMasteryState(v));
    return Object.fromEntries(entries) as MasteryMap;
  } catch {
    return {};
  }
}

export function saveMastery(map: MasteryMap): boolean {
  try { localStorage.setItem(KEY, JSON.stringify(map)); return true; } catch { return false; }
}

export function getOrCreateMastery(map: MasteryMap, skillId: string, now: number): MasteryState {
  return map[skillId] ?? createMasteryState(skillId, now);
}
