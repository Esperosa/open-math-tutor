import { describe, expect, it } from "vitest";
import { parseMathStatement, getTrackTopics, getTopicSkills, getSkillTemplates, nextUnlockedTopic } from "@openmathtutor/shared";
import { catalog } from "./catalog.js";

function instantiateAt(
  statementTemplate: string,
  generatorRanges: Record<string, [number, number]> | undefined,
  pick: (min: number, max: number) => number,
): string {
  if (!generatorRanges) return statementTemplate;
  let statement = statementTemplate;
  for (const [name, [min, max]] of Object.entries(generatorRanges)) {
    statement = statement.split(`{${name}}`).join(String(pick(min, max)));
  }
  return statement;
}

const instantiateAtMidpoint = (template: string, ranges?: Record<string, [number, number]>) =>
  instantiateAt(template, ranges, (min, max) => Math.round((min + max) / 2));
const instantiateAtMin = (template: string, ranges?: Record<string, [number, number]>) =>
  instantiateAt(template, ranges, min => min);
const instantiateAtMax = (template: string, ranges?: Record<string, [number, number]>) =>
  instantiateAt(template, ranges, (_min, max) => max);

describe("catalog integrity", () => {
  it("every track's topicIds resolve to real topics", () => {
    for (const track of catalog.tracks) {
      for (const topicId of track.topicIds) {
        expect(catalog.topics.some(t => t.id === topicId), `track ${track.id} references missing topic ${topicId}`).toBe(true);
      }
    }
  });

  it("every topic's skillIds resolve to real skills", () => {
    for (const topic of catalog.topics) {
      for (const skillId of topic.skillIds) {
        expect(catalog.skills.some(s => s.id === skillId), `topic ${topic.id} references missing skill ${skillId}`).toBe(true);
      }
    }
  });

  it("every skill's problemTemplateIds resolve to real templates", () => {
    for (const skill of catalog.skills) {
      for (const templateId of skill.problemTemplateIds) {
        expect(
          catalog.problemTemplates.some(t => t.id === templateId),
          `skill ${skill.id} references missing template ${templateId}`,
        ).toBe(true);
      }
    }
  });

  it("every skill's prerequisiteSkillIds resolve to real skills", () => {
    for (const skill of catalog.skills) {
      for (const prereqId of skill.prerequisiteSkillIds) {
        expect(
          catalog.skills.some(s => s.id === prereqId),
          `skill ${skill.id} references missing prerequisite ${prereqId}`,
        ).toBe(true);
      }
    }
  });

  it("has no skill that is (directly or transitively) its own prerequisite", () => {
    const byId = new Map(catalog.skills.map(s => [s.id, s]));
    function hasCycle(skillId: string, visiting: Set<string>): boolean {
      if (visiting.has(skillId)) return true;
      const skill = byId.get(skillId);
      if (!skill) return false;
      const next = new Set(visiting);
      next.add(skillId);
      return skill.prerequisiteSkillIds.some(id => hasCycle(id, next));
    }
    for (const skill of catalog.skills) {
      expect(hasCycle(skill.id, new Set()), `cycle detected starting at ${skill.id}`).toBe(false);
    }
  });

  it("every problem template parses under the safe grammar at min, mid, and max of its generator ranges", () => {
    for (const template of catalog.problemTemplates) {
      for (const instantiate of [instantiateAtMin, instantiateAtMidpoint, instantiateAtMax]) {
        const statement = instantiate(template.statementTemplate, template.generatorRanges);
        expect(
          () => parseMathStatement(statement),
          `template ${template.id} produced unparseable statement: ${statement}`,
        ).not.toThrow();
      }
    }
  });

  it("every problem template references an existing skill", () => {
    for (const template of catalog.problemTemplates) {
      expect(
        catalog.skills.some(s => s.id === template.skillId),
        `template ${template.id} references missing skill ${template.skillId}`,
      ).toBe(true);
    }
  });
});

describe("catalog walkability per track", () => {
  for (const track of catalog.tracks) {
    it(`${track.id}: topics -> skills -> templates resolves to a non-empty set`, () => {
      const topics = getTrackTopics(catalog, track.id);
      expect(topics.length).toBeGreaterThan(0);
      let templateCount = 0;
      for (const topic of topics) {
        const skills = getTopicSkills(catalog, topic.id);
        expect(skills.length).toBeGreaterThan(0);
        for (const skill of skills) {
          templateCount += getSkillTemplates(catalog, skill.id).length;
        }
      }
      expect(templateCount).toBeGreaterThan(0);
    });
  }

  for (const track of catalog.tracks) {
    it(`${track.id}: a brand-new student (no mastery) has at least one reachable skill`, () => {
      // Regression: a track whose topicIds skip a topic that every one of its
      // skills is (directly or transitively) prerequisite-gated behind is
      // unplayable from zero mastery — nextUnlockedTopic returns null forever,
      // which the UI misreports as "all done" instead of "stuck".
      expect(nextUnlockedTopic(catalog, track.id, new Set())).not.toBeNull();
    });
  }
});
