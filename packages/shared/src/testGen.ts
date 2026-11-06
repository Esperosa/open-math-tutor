import { getSkillTemplates, getTopicSkills, getTrackTopics, type CourseCatalog } from "./curriculum.js";
import { formatExpected, instantiateProblem, type ExpectedAnswer } from "./answers.js";

export interface TestItem {
  n: number;
  skillId: string;
  skillTitle: string;
  statement: string;
  expected?: ExpectedAnswer;
  answerNote?: string;
  /** The task is to draw; the answer is judged by a person. */
  drawing: boolean;
}
export interface GeneratedTest { trackId: string; topicId: string | null; items: TestItem[] }

/** Builds a printable test from the catalog with no AI: per skill the templates are used from easy to hard, each with fresh numbers. */
export function generateTest(catalog: CourseCatalog, scope: { trackId: string; topicId?: string }, perSkill = 2, random: () => number = Math.random): GeneratedTest {
  const skills = scope.topicId ? getTopicSkills(catalog, scope.topicId)
    : getTrackTopics(catalog, scope.trackId).flatMap(topic => getTopicSkills(catalog, topic.id));
  const seen = new Set<string>();
  const items: TestItem[] = [];
  for (const skill of skills) {
    if (seen.has(skill.id)) continue;
    seen.add(skill.id);
    const templates = [...getSkillTemplates(catalog, skill.id)].sort((a, b) => a.difficultyLevel - b.difficultyLevel);
    if (!templates.length) continue;
    for (let i = 0; i < Math.min(perSkill, templates.length); i++) {
      const template = templates[Math.min(templates.length - 1, Math.round(i * (templates.length - 1) / Math.max(1, perSkill - 1)))]!;
      const problem = instantiateProblem(template, random);
      items.push({ n: items.length + 1, skillId: skill.id, skillTitle: skill.title.cs, statement: problem.statement,
        ...(problem.expected ? { expected: problem.expected } : {}), ...(template.answerNote ? { answerNote: template.answerNote } : {}), drawing: skill.drawing === true });
    }
  }
  return { trackId: scope.trackId, topicId: scope.topicId ?? null, items };
}

export function answerKeyText(item: TestItem, locale: "cs" | "en"): string {
  if (item.expected) return formatExpected(item.expected, locale);
  if (item.answerNote) return item.answerNote;
  if (item.drawing) return locale === "cs" ? "kresba, posuzuje učitel" : "a drawing, judged by a teacher";
  return locale === "cs" ? "výsledek se musí ověřit (bez automatického řešení)" : "needs checking by hand (no automatic solution)";
}
