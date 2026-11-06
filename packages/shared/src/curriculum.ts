/**
 * Pre-built course catalog types. Actual course content (packages/shared's
 * sibling `content/` package at the repo root, or wherever the catalog is
 * assembled) is original material written for this project, organized
 * against publicly known exam syllabi — never a reproduction of copyrighted
 * past-paper problems. See content/SOURCES.md for how each track's syllabus
 * reference was chosen.
 */

export type ExamFamily = "ss-prijimacky" | "vs-prijimacky" | "maturita" | "vysoka-skola" | "custom";

export interface LocalizedText {
  cs: string;
  en: string;
}

export interface ProblemTemplate {
  id: string;
  skillId: string;
  /** Difficulty tier this template is tuned for, 1 (easiest) .. 5 (hardest). */
  difficultyLevel: number;
  /** Plain-grammar statement (mathAst.ts grammar) or LaTeX-ready text; `generator` fields (if present) are substituted in before parsing. */
  statementTemplate: string;
  /** Optional integer ranges for randomized coefficients, e.g. { a: [2, 9], b: [-5, 5] }. Substituted into statementTemplate as {a}, {b}, etc. */
  generatorRanges?: Record<string, [min: number, max: number]>;
  topic: string;
}

export interface Skill {
  id: string;
  title: LocalizedText;
  /** Skills that should reach a passing mastery level before this one is introduced in lesson mode. */
  prerequisiteSkillIds: string[];
  problemTemplateIds: string[];
}

export interface Topic {
  id: string;
  title: LocalizedText;
  skillIds: string[];
}

export interface Track {
  id: string;
  title: LocalizedText;
  description: LocalizedText;
  examFamily: ExamFamily;
  topicIds: string[];
}

export interface CourseCatalog {
  tracks: Track[];
  topics: Topic[];
  skills: Skill[];
  problemTemplates: ProblemTemplate[];
}

export function getTrackTopics(catalog: CourseCatalog, trackId: string): Topic[] {
  const track = catalog.tracks.find(t => t.id === trackId);
  if (!track) return [];
  return track.topicIds.map(id => catalog.topics.find(t => t.id === id)).filter((t): t is Topic => Boolean(t));
}

export function getTopicSkills(catalog: CourseCatalog, topicId: string): Skill[] {
  const topic = catalog.topics.find(t => t.id === topicId);
  if (!topic) return [];
  return topic.skillIds.map(id => catalog.skills.find(s => s.id === id)).filter((s): s is Skill => Boolean(s));
}

export function getSkillTemplates(catalog: CourseCatalog, skillId: string, difficultyLevel?: number): ProblemTemplate[] {
  const skill = catalog.skills.find(s => s.id === skillId);
  if (!skill) return [];
  const templates = skill.problemTemplateIds
    .map(id => catalog.problemTemplates.find(t => t.id === id))
    .filter((t): t is ProblemTemplate => Boolean(t));
  return difficultyLevel === undefined ? templates : templates.filter(t => t.difficultyLevel === difficultyLevel);
}

/** Substitutes {name} placeholders in a statement template with integers randomly drawn from generatorRanges. Pure given an injected `random`, for testability. */
export function instantiateTemplate(template: ProblemTemplate, random: () => number = Math.random): string {
  if (!template.generatorRanges) return template.statementTemplate;
  let statement = template.statementTemplate;
  for (const [name, [min, max]] of Object.entries(template.generatorRanges)) {
    const value = min + Math.floor(random() * (max - min + 1));
    statement = statement.split(`{${name}}`).join(String(value));
  }
  return statement;
}

/** First skill in `topicSkills` whose prerequisites are all mastered, honoring ordering as a tie-break. */
export function nextUnlockedSkill(topicSkills: readonly Skill[], masteredSkillIds: ReadonlySet<string>): Skill | null {
  for (const skill of topicSkills) {
    if (masteredSkillIds.has(skill.id)) continue;
    if (skill.prerequisiteSkillIds.every(id => masteredSkillIds.has(id))) return skill;
  }
  return null;
}
