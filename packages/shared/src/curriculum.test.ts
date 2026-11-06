import { describe, expect, it } from "vitest";
import {
  getTrackTopics, getTopicSkills, getSkillTemplates, instantiateTemplate, nextUnlockedSkill,
  nextUnlockedTopic, pickTemplateForDifficulty, trackProgress, searchCatalog, type CourseCatalog,
} from "./curriculum.js";

const catalog: CourseCatalog = {
  tracks: [{
    id: "track-1", title: { cs: "Test", en: "Test" }, description: { cs: "", en: "" },
    examFamily: "custom", topicIds: ["topic-1", "topic-2"],
  }],
  topics: [
    { id: "topic-1", title: { cs: "T1", en: "T1" }, skillIds: ["skill-a", "skill-b"] },
    { id: "topic-2", title: { cs: "T2", en: "T2" }, skillIds: ["skill-c"] },
  ],
  skills: [
    { id: "skill-a", title: { cs: "A", en: "A" }, prerequisiteSkillIds: [], problemTemplateIds: ["t-a-1", "t-a-2"] },
    { id: "skill-b", title: { cs: "B", en: "B" }, prerequisiteSkillIds: ["skill-a"], problemTemplateIds: ["t-b-1"] },
    { id: "skill-c", title: { cs: "C", en: "C" }, prerequisiteSkillIds: ["skill-b"], problemTemplateIds: [] },
  ],
  problemTemplates: [
    { id: "t-a-1", skillId: "skill-a", difficultyLevel: 1, topic: "topic-1", statementTemplate: "{a}+1", generatorRanges: { a: [1, 3] } },
    { id: "t-a-2", skillId: "skill-a", difficultyLevel: 3, topic: "topic-1", statementTemplate: "{a}+2", generatorRanges: { a: [1, 3] } },
    { id: "t-b-1", skillId: "skill-b", difficultyLevel: 1, topic: "topic-1", statementTemplate: "x+1=2" },
  ],
};

describe("getTrackTopics / getTopicSkills / getSkillTemplates", () => {
  it("resolves a track's topics in order", () => {
    expect(getTrackTopics(catalog, "track-1").map(t => t.id)).toEqual(["topic-1", "topic-2"]);
  });
  it("returns an empty array for an unknown track/topic", () => {
    expect(getTrackTopics(catalog, "nope")).toEqual([]);
    expect(getTopicSkills(catalog, "nope")).toEqual([]);
  });
  it("filters templates by difficulty level when given one", () => {
    expect(getSkillTemplates(catalog, "skill-a", 1).map(t => t.id)).toEqual(["t-a-1"]);
    expect(getSkillTemplates(catalog, "skill-a").map(t => t.id)).toEqual(["t-a-1", "t-a-2"]);
  });
});

describe("instantiateTemplate", () => {
  it("substitutes generator ranges deterministically given a fixed random source", () => {
    const template = catalog.problemTemplates[0]!;
    expect(instantiateTemplate(template, () => 0)).toBe("1+1");
    expect(instantiateTemplate(template, () => 0.999)).toBe("3+1");
  });
  it("returns the template unchanged when it has no generator ranges", () => {
    expect(instantiateTemplate(catalog.problemTemplates[2]!)).toBe("x+1=2");
  });
});

describe("nextUnlockedSkill / nextUnlockedTopic", () => {
  it("picks the first skill whose prerequisites are mastered", () => {
    const skills = getTopicSkills(catalog, "topic-1");
    expect(nextUnlockedSkill(skills, new Set())?.id).toBe("skill-a");
    expect(nextUnlockedSkill(skills, new Set(["skill-a"]))?.id).toBe("skill-b");
    expect(nextUnlockedSkill(skills, new Set(["skill-a", "skill-b"]))).toBeNull();
  });
  it("finds the first topic in a track that still has something to do", () => {
    expect(nextUnlockedTopic(catalog, "track-1", new Set())?.id).toBe("topic-1");
    expect(nextUnlockedTopic(catalog, "track-1", new Set(["skill-a", "skill-b"]))?.id).toBe("topic-2");
    expect(nextUnlockedTopic(catalog, "track-1", new Set(["skill-a", "skill-b", "skill-c"]))).toBeNull();
  });
});

describe("pickTemplateForDifficulty", () => {
  it("prefers an exact difficulty match", () => {
    expect(pickTemplateForDifficulty(catalog, "skill-a", 3, () => 0)?.id).toBe("t-a-2");
  });
  it("falls back to any template for the skill when none match the difficulty exactly", () => {
    expect(pickTemplateForDifficulty(catalog, "skill-a", 5, () => 0)?.id).toBe("t-a-1");
  });
  it("returns null for a skill with no templates", () => {
    expect(pickTemplateForDifficulty(catalog, "skill-c", 1)).toBeNull();
  });
});

describe("trackProgress", () => {
  it("counts mastered skills out of the track total", () => {
    expect(trackProgress(catalog, "track-1", new Set())).toEqual({ masteredCount: 0, totalCount: 3 });
    expect(trackProgress(catalog, "track-1", new Set(["skill-a"]))).toEqual({ masteredCount: 1, totalCount: 3 });
    expect(trackProgress(catalog, "track-1", new Set(["skill-a", "skill-b", "skill-c"]))).toEqual({ masteredCount: 3, totalCount: 3 });
  });
});

describe("searchCatalog", () => {
  const search: CourseCatalog = {
    tracks: [{ id: "tr", title: { cs: "Maturita", en: "School-leaving exam" }, description: { cs: "", en: "" }, examFamily: "maturita", topicIds: ["tp"] }],
    topics: [{ id: "tp", title: { cs: "Rovnice", en: "Equations" }, skillIds: ["sk"] }],
    skills: [{ id: "sk", title: { cs: "Kvadratické rovnice", en: "Quadratic equations" }, prerequisiteSkillIds: [], problemTemplateIds: [],
      keywords: { cs: ["diskriminant"], en: ["discriminant"] } }],
    problemTemplates: [],
  };
  it("finds skills ignoring case and diacritics, by title or keyword", () => {
    expect(searchCatalog(search, "kvadraticke", "cs")[0]).toMatchObject({ kind: "skill", skillId: "sk" });
    expect(searchCatalog(search, "DISKRIMINANT", "cs")[0]).toMatchObject({ kind: "skill", skillId: "sk" });
    expect(searchCatalog(search, "discriminant", "en")).toHaveLength(1);
  });
  it("requires every word to match and returns nothing for an empty or unknown query", () => {
    expect(searchCatalog(search, "kvadraticke logaritmy", "cs")).toEqual([]);
    expect(searchCatalog(search, "   ", "cs")).toEqual([]);
  });
  it("ranks skills before topics before tracks", () => {
    const kinds = searchCatalog(search, "rovnice", "cs").map(h => h.kind);
    expect(kinds).toEqual(["skill", "topic"]);
  });
});
