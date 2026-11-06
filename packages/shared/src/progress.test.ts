import { describe, expect, it } from "vitest";
import { skillProgress, topicMastered, topicPercent, trackPercent } from "./progress.js";
import { generateTest, answerKeyText } from "./testGen.js";
import { createMasteryState, recordAttempt } from "./mastery.js";
import type { CourseCatalog } from "./curriculum.js";

const catalog: CourseCatalog = {
  tracks: [{ id: "tr", title: { cs: "T", en: "T" }, description: { cs: "", en: "" }, examFamily: "custom", topicIds: ["tp"] }],
  topics: [{ id: "tp", title: { cs: "Téma", en: "Topic" }, skillIds: ["a", "b"] }],
  skills: [
    { id: "a", title: { cs: "A", en: "A" }, prerequisiteSkillIds: [], problemTemplateIds: ["a1", "a2"] },
    { id: "b", title: { cs: "B", en: "B" }, prerequisiteSkillIds: ["a"], problemTemplateIds: ["b1"], drawing: true },
  ],
  problemTemplates: [
    { id: "a1", skillId: "a", difficultyLevel: 1, topic: "tp", statementTemplate: "{x}+{y}", generatorRanges: { x: [2, 2], y: [3, 3] } },
    { id: "a2", skillId: "a", difficultyLevel: 2, topic: "tp", statementTemplate: "Kolik je {x} krát {y}?", generatorRanges: { x: [4, 4], y: [5, 5] }, freeText: true, answerTemplate: "{x}*{y}", answerUnit: "ks" },
    { id: "b1", skillId: "b", difficultyLevel: 1, topic: "tp", statementTemplate: "Nakresli obvod.", freeText: true },
  ],
};

describe("progress", () => {
  it("is 0 for untouched skills, grows with practice and is 100 only when mastered", () => {
    expect(skillProgress(undefined)).toBe(0);
    let state = recordAttempt(createMasteryState("a", 0), true, 1);
    const first = skillProgress(state);
    expect(first).toBeGreaterThan(0);
    for (let i = 0; i < 30; i++) state = recordAttempt(state, true, i + 2);
    expect(skillProgress(state)).toBe(100);
    expect(first).toBeLessThan(100);
  });
  it("averages skills for topics and tracks and detects a finished topic", () => {
    let a = createMasteryState("a", 0), b = createMasteryState("b", 0);
    for (let i = 0; i < 30; i++) { a = recordAttempt(a, true, i); b = recordAttempt(b, true, i); }
    expect(trackPercent(catalog, "tr", {})).toBe(0);
    expect(trackPercent(catalog, "tr", { a })).toBe(50);
    expect(topicPercent(catalog, "tp", { a, b })).toBe(100);
    expect(topicMastered(catalog, "tp", { a })).toBe(false);
    expect(topicMastered(catalog, "tp", { a, b })).toBe(true);
  });
});

describe("generateTest", () => {
  it("builds numbered items with computed answers and marks drawing tasks", () => {
    const test = generateTest(catalog, { trackId: "tr", topicId: "tp" }, 2, () => 0);
    expect(test.items.map(i => i.n)).toEqual([1, 2, 3]);
    expect(test.items[0]).toMatchObject({ statement: "2+3", expected: { value: 5 } });
    expect(test.items[1]).toMatchObject({ statement: "Kolik je 4 krát 5?", expected: { value: 20, unit: "ks" } });
    expect(test.items[2]).toMatchObject({ drawing: true });
    expect(answerKeyText(test.items[1]!, "cs")).toBe("20 ks");
    expect(answerKeyText(test.items[2]!, "cs")).toContain("kresba");
  });
});

describe("progress is earned by correct work", () => {
  it("a failed first attempt does not move the bar, the first correct answer shows at least 1 %", () => {
    const failed = recordAttempt(createMasteryState("a", 0), false, 1);
    expect(skillProgress(failed)).toBe(0);
    expect(trackPercent(catalog, "tr", { a: failed })).toBe(0);
    const solved = recordAttempt(failed, true, 2);
    expect(skillProgress(solved)).toBeGreaterThan(0);
    expect(trackPercent(catalog, "tr", { a: solved })).toBeGreaterThanOrEqual(1);
  });
});
