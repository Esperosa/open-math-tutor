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
      if (template.freeText) continue;
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

describe("catalog honesty", () => {
  it("every skill the local checker claims to verify only has parseable, non-free-text templates", () => {
    for (const skill of catalog.skills.filter(s => s.autoCheck !== false)) {
      for (const id of skill.problemTemplateIds) {
        expect(catalog.problemTemplates.find(tp => tp.id === id)?.freeText, `${id} is free text but ${skill.id} claims autoCheck`).not.toBe(true);
      }
    }
  });
  it("every skill is in a topic and every topic is used by a track", () => {
    const usedTopics = new Set(catalog.tracks.flatMap(tr => tr.topicIds));
    for (const topic of catalog.topics) expect(usedTopics.has(topic.id), `unused topic ${topic.id}`).toBe(true);
    const inTopic = new Set(catalog.topics.flatMap(tp => tp.skillIds));
    for (const skill of catalog.skills) expect(inTopic.has(skill.id), `orphan skill ${skill.id}`).toBe(true);
  });
  it("prerequisites are offered inside every track that uses the skill (no unplayable skills)", () => {
    for (const track of catalog.tracks) {
      const inTrack = new Set(getTrackTopics(catalog, track.id).flatMap(tp => tp.skillIds));
      for (const id of inTrack) {
        for (const pre of catalog.skills.find(s => s.id === id)!.prerequisiteSkillIds) {
          expect(inTrack.has(pre), `track ${track.id}: skill ${id} needs ${pre}, which the track never offers`).toBe(true);
        }
      }
    }
  });
  it("exam tracks name their calculator policy; unofficial university tracks say so", () => {
    for (const id of ["ss-prijimacky", "maturita"]) expect(catalog.tracks.find(t => t.id === id)?.calculator).toBeDefined();
    for (const id of ["vs-analyza", "vs-linearni-algebra", "vs-diskretni", "vs-statistika"]) expect(catalog.tracks.find(t => t.id === id)?.unofficial).toBe(true);
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

describe("expected answers", () => {
  it("every template with an answerTemplate yields a finite expected answer for 200 random instantiations", async () => {
    const { instantiateProblem } = await import("@openmathtutor/shared");
    for (const template of catalog.problemTemplates.filter(t => t.answerTemplate)) {
      for (let i = 0; i < 200; i++) {
        const problem = instantiateProblem(template);
        expect(problem.expected && Number.isFinite(problem.expected.value), `${template.id}: ${problem.statement}`).toBe(true);
        expect(problem.statement, template.id).not.toMatch(/\{[a-z]+\}/);
      }
    }
  });
  it("division tasks come out even and every checkable statement has a single answer", async () => {
    const { instantiateProblem } = await import("@openmathtutor/shared");
    for (const id of ["fy-velocity-1", "fy-force-2", "fy-ohm-1", "ch-mole-1", "proportion-2"]) {
      const template = catalog.problemTemplates.find(t => t.id === id)!;
      for (let i = 0; i < 100; i++) expect(Number.isInteger(instantiateProblem(template).expected!.value), id).toBe(true);
    }
    const checked = new Set(catalog.skills.filter(sk => sk.autoCheck !== false).map(sk => sk.id));
    for (const template of catalog.problemTemplates.filter(t => checked.has(t.skillId) && !t.freeText && !t.answerTemplate)) {
      for (let i = 0; i < 100; i++) expect(instantiateProblem(template).expected, `${template.id} (never ends without an answer)`).toBeDefined();
    }
  });
  it("physics and chemistry tracks are mostly answer-checked and say which skills are drawings", async () => {
    const { skillCheckLevel } = await import("@openmathtutor/shared");
    for (const trackId of ["fyzika", "chemie"]) {
      const skills = getTrackTopics(catalog, trackId).flatMap(tp => tp.skillIds).map(id => catalog.skills.find(s => s.id === id)!);
      expect(skills.filter(s => skillCheckLevel(catalog, s) === "answer").length).toBeGreaterThanOrEqual(4);
      for (const skill of skills.filter(s => skillCheckLevel(catalog, s) === "none")) expect(skill.drawing === true || skill.id === "ch-balance", skill.id).toBe(true);
    }
  });
});

describe("content quality and difficulty (D8, D12)", () => {
  it("every problem template instance contains an operation or prompt and is not degenerate", async () => {
    const { instantiateProblem } = await import("@openmathtutor/shared");
    for (const template of catalog.problemTemplates) {
      for (let i = 0; i < 20; i++) {
        const problem = instantiateProblem(template);
        const s = problem.statement.trim();
        expect(s.length).toBeGreaterThan(0);
        // Not a bare number like '5' or '-4'
        expect(s, `${template.id} produced bare number: ${s}`).not.toMatch(/^-?\d+$/);
        // Not a trivial identity like 'x=29'
        expect(s, `${template.id} produced trivial identity: ${s}`).not.toMatch(/^x\s*=\s*-?\d+$/);
        // Contains an operation or prompt/instruction
        const hasOpOrPrompt = s.includes("?") || /[-+*/=^<>≤≥·~]/i.test(s) || /(?:Vypočítej|Urči|Řeš|Rozlož|Roznásob|Zjednoduš|Kolik|Jak|Najdi|Dokaž|Zderivuj|Sestav|Vyčísli|Nakresli|Máš|Převeď|Zneguj|Rozhodni|Formuluj|Co\s+znamená|V\s+aritmetické|V\s+geometrické|V\s+pytlíku|V\s+průzkumu|V\s+třídě|Na\s+účet|Cena\s+zboží|Vklad|Žebřík|Odvěsny|Test\s+má|Hodíš|Házíš|Dva\s+rezistory|Výběr|Z\s+balíčku|Z\s+drátu|Zobrazení|Je\s+f|Je\s+relace|Je\s+matice|Je\s+dělitelnost|Je\s+graf|Existuje\s+graf)/i.test(s);
        expect(hasOpOrPrompt, `template ${template.id} instance "${s}" has no operation or prompt`).toBe(true);
        // If arithmetic with negative numbers, it must contain a negative sign followed by digits
        if (template.skillId === "arithmetic-integers") {
          expect(s, `${template.id} arithmetic-integers has no negative number: ${s}`).toMatch(/-\d/);
        }
      }
    }
  });

  it("'Další příklad' never returns the same statement twice in a row in 50 attempts for courses/skills with >= 6 variants", async () => {
    const { instantiateProblem } = await import("@openmathtutor/shared");
    const richSkills = catalog.skills.filter(sk => sk.problemTemplateIds.length >= 6);
    expect(richSkills.length).toBeGreaterThan(0);
    for (const skill of richSkills) {
      const templates = skill.problemTemplateIds.map(id => catalog.problemTemplates.find(t => t.id === id)!);
      let previous = null;
      for (let step = 0; step < 50; step++) {
        let current = "";
        for (let attempt = 0; attempt < 10; attempt++) {
          const tpl = templates[Math.floor(Math.random() * templates.length)];
          const cand = instantiateProblem(tpl).statement;
          if (cand !== previous) {
            current = cand;
            break;
          }
        }
        expect(current).not.toBe(previous);
        previous = current;
      }
    }
  });

  it("difficulty levels match the course: maturita and vs-prijimacky do not start with 2-2 / basic arithmetic", () => {
    for (const trackId of ["maturita", "vs-prijimacky", "vysoka-skola"]) {
      const track = catalog.tracks.find(t => t.id === trackId);
      // First topic must not be TOPIC_NUMBERS
      expect(track.topicIds[0]).not.toBe("zaklady-cisla");
      // All starting skills in the first topic have difficulty >= 2 and don't include arithmetic-integers
      const firstTopicSkills = getTopicSkills(catalog, track.topicIds[0]);
      for (const skill of firstTopicSkills) {
        expect(skill.id).not.toBe("arithmetic-integers");
        const templates = getSkillTemplates(catalog, skill.id);
        for (const tpl of templates) {
          expect(tpl.difficultyLevel).toBeGreaterThanOrEqual(2);
        }
      }
    }
  });
});
