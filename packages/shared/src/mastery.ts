/**
 * Per-skill mastery tracking. Deliberately simple (not a full SM-2/Leitner
 * implementation): difficulty steps up after two consecutive correct
 * answers at the current level, steps down after two consecutive misses,
 * and a skill counts as "mastered" once the student has answered correctly
 * at the top difficulty level twice in a row. This is enough to drive
 * "teach progressively, notice how I'm doing" without over-engineering a
 * review-scheduling system nothing here yet needs.
 */

export const MIN_DIFFICULTY = 1;
export const MAX_DIFFICULTY = 5;
export const MASTERED_STREAK_REQUIRED = 2;

export interface MasteryState {
  skillId: string;
  difficultyLevel: number;
  /** Consecutive correct answers at the current difficultyLevel. */
  correctStreak: number;
  /** Consecutive incorrect answers at the current difficultyLevel. */
  incorrectStreak: number;
  attempts: number;
  masteredAt: number | null;
  lastPracticedAt: number;
}

export function createMasteryState(skillId: string, now: number): MasteryState {
  return {
    skillId,
    difficultyLevel: MIN_DIFFICULTY,
    correctStreak: 0,
    incorrectStreak: 0,
    attempts: 0,
    masteredAt: null,
    lastPracticedAt: now,
  };
}

/** Pure state transition: given the outcome of one attempt, returns the next MasteryState. */
export function recordAttempt(state: MasteryState, wasCorrect: boolean, now: number): MasteryState {
  const attempts = state.attempts + 1;
  if (!wasCorrect) {
    const incorrectStreak = state.incorrectStreak + 1;
    const difficultyLevel = incorrectStreak >= 2 ? Math.max(MIN_DIFFICULTY, state.difficultyLevel - 1) : state.difficultyLevel;
    return {
      ...state,
      attempts,
      correctStreak: 0,
      incorrectStreak: difficultyLevel !== state.difficultyLevel ? 0 : incorrectStreak,
      difficultyLevel,
      masteredAt: null,
      lastPracticedAt: now,
    };
  }

  const correctStreak = state.correctStreak + 1;
  const atTopDifficulty = state.difficultyLevel === MAX_DIFFICULTY;
  if (atTopDifficulty && correctStreak >= MASTERED_STREAK_REQUIRED) {
    return {
      ...state,
      attempts,
      correctStreak,
      incorrectStreak: 0,
      masteredAt: state.masteredAt ?? now,
      lastPracticedAt: now,
    };
  }
  if (!atTopDifficulty && correctStreak >= MASTERED_STREAK_REQUIRED) {
    return {
      ...state,
      attempts,
      correctStreak: 0,
      incorrectStreak: 0,
      difficultyLevel: Math.min(MAX_DIFFICULTY, state.difficultyLevel + 1),
      lastPracticedAt: now,
    };
  }
  return { ...state, attempts, correctStreak, incorrectStreak: 0, lastPracticedAt: now };
}

export function isMastered(state: MasteryState): boolean {
  return state.masteredAt !== null;
}
