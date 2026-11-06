import { describe, expect, it } from "vitest";
import { createMasteryState, recordAttempt, isMastered, MAX_DIFFICULTY, MIN_DIFFICULTY } from "./mastery.js";

describe("mastery", () => {
  it("starts at the minimum difficulty, unmastered", () => {
    const state = createMasteryState("skill-1", 1000);
    expect(state.difficultyLevel).toBe(MIN_DIFFICULTY);
    expect(isMastered(state)).toBe(false);
  });

  it("steps up difficulty after two consecutive correct answers", () => {
    let state = createMasteryState("skill-1", 0);
    state = recordAttempt(state, true, 1);
    expect(state.difficultyLevel).toBe(MIN_DIFFICULTY);
    state = recordAttempt(state, true, 2);
    expect(state.difficultyLevel).toBe(MIN_DIFFICULTY + 1);
    expect(state.correctStreak).toBe(0);
  });

  it("steps down difficulty after two consecutive misses", () => {
    let state = createMasteryState("skill-1", 0);
    state = { ...state, difficultyLevel: 3 };
    state = recordAttempt(state, false, 1);
    expect(state.difficultyLevel).toBe(3);
    state = recordAttempt(state, false, 2);
    expect(state.difficultyLevel).toBe(2);
  });

  it("never drops below the minimum or exceeds the maximum difficulty", () => {
    let state = createMasteryState("skill-1", 0);
    for (let i = 0; i < 10; i++) state = recordAttempt(state, false, i);
    expect(state.difficultyLevel).toBeGreaterThanOrEqual(MIN_DIFFICULTY);

    state = { ...createMasteryState("skill-1", 0), difficultyLevel: MAX_DIFFICULTY };
    for (let i = 0; i < 10; i++) state = recordAttempt(state, true, i);
    expect(state.difficultyLevel).toBeLessThanOrEqual(MAX_DIFFICULTY);
  });

  it("marks mastered after two consecutive correct answers at max difficulty", () => {
    let state = { ...createMasteryState("skill-1", 0), difficultyLevel: MAX_DIFFICULTY };
    state = recordAttempt(state, true, 1);
    expect(isMastered(state)).toBe(false);
    state = recordAttempt(state, true, 2);
    expect(isMastered(state)).toBe(true);
  });

  it("un-masters a skill if the student starts missing it again", () => {
    let state = { ...createMasteryState("skill-1", 0), difficultyLevel: MAX_DIFFICULTY };
    state = recordAttempt(state, true, 1);
    state = recordAttempt(state, true, 2);
    expect(isMastered(state)).toBe(true);
    state = recordAttempt(state, false, 3);
    expect(isMastered(state)).toBe(false);
  });
});
