/**
 * Pre-built course catalog types. Actual course content (packages/shared's
 * sibling `content/` package at the repo root, or wherever the catalog is
 * assembled) is original material written for this project, organized
 * against publicly known exam syllabi — never a reproduction of copyrighted
 * past-paper problems. See content/SOURCES.md for how each track's syllabus
 * reference was chosen.
 */

export type ExamFamily = "ss-prijimacky" | "vs-prijimacky" | "maturita" | "vysoka-skola" | "fyzika" | "chemie" | "custom";

export type Subject = "math" | "physics" | "chemistry";

export type CalculatorPolicy = "none" | "basic" | "scientific";

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
  /** Word problem / notation that is not in the safe math grammar: statement is shown as text and never parsed. */
  freeText?: boolean;
  /** Formula over the generator names ({a}, {b}) giving the expected numeric answer, evaluated with the calculator grammar. */
  answerTemplate?: string;
  /** Unit shown with the expected answer, for example m/s. */
  answerUnit?: string;
}

export interface Skill {
  id: string;
  title: LocalizedText;
  /** Skills that should reach a passing mastery level before this one is introduced in lesson mode. */
  prerequisiteSkillIds: string[];
  problemTemplateIds: string[];
  /** False when no local/SymPy verifier can check this skill's steps; the UI says so honestly. Default true. */
  autoCheck?: boolean;
  /** The task is to draw something (circuit, forces, formula); the tutor cannot see drawings yet. */
  drawing?: boolean;
  /** Extra search terms (cs/en) so a student can find this skill by what they call it. */
  keywords?: { cs: string[]; en: string[] };
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
  /** Subject the track belongs to; defaults to math. */
  subject?: Subject;
  /** What the real exam allows; drives the in-app calculator. */
  calculator?: CalculatorPolicy;
  /** Public page the calculator/topic policy was taken from. */
  sourceUrl?: string;
  /** Syllabus is a draft built from general curriculum knowledge, not an official published list. */
  unofficial?: boolean;
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

/** First topic in a track (in order) that still has an unlocked, unmastered skill — where lesson mode should resume. */
export function nextUnlockedTopic(catalog: CourseCatalog, trackId: string, masteredSkillIds: ReadonlySet<string>): Topic | null {
  for (const topic of getTrackTopics(catalog, trackId)) {
    if (nextUnlockedSkill(getTopicSkills(catalog, topic.id), masteredSkillIds)) return topic;
  }
  return null;
}

/** Picks a template for `skillId` at `difficultyLevel`, falling back to any template for that skill if none match exactly. */
export function pickTemplateForDifficulty(
  catalog: CourseCatalog,
  skillId: string,
  difficultyLevel: number,
  random: () => number = Math.random,
): ProblemTemplate | null {
  const exact = getSkillTemplates(catalog, skillId, difficultyLevel);
  const pool = exact.length > 0 ? exact : getSkillTemplates(catalog, skillId);
  if (pool.length === 0) return null;
  return pool[Math.floor(random() * pool.length)] ?? null;
}

/** How far a student has gotten through a track: skills mastered out of the track's total. */
export function trackProgress(catalog: CourseCatalog, trackId: string, masteredSkillIds: ReadonlySet<string>): { masteredCount: number; totalCount: number } {
  const skillIds = new Set(getTrackTopics(catalog, trackId).flatMap(topic => getTopicSkills(catalog, topic.id).map(s => s.id)));
  let masteredCount = 0;
  for (const id of skillIds) if (masteredSkillIds.has(id)) masteredCount++;
  return { masteredCount, totalCount: skillIds.size };
}

const fold = (value: string) => value.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();

export type SearchHit =
  | { kind: "track"; trackId: string; label: string }
  | { kind: "topic"; trackId: string; topicId: string; label: string }
  | { kind: "skill"; trackId: string; topicId: string; skillId: string; label: string };

/** Diacritics-insensitive search over track, topic and skill titles and skill keywords. Every query word must match. */
export function searchCatalog(catalog: CourseCatalog, query: string, locale: "cs" | "en", limit = 12): SearchHit[] {
  const words = fold(query).split(/\s+/).filter(Boolean);
  if (!words.length) return [];
  const matches = (haystack: string) => { const h = fold(haystack); return words.every(w => h.includes(w)); };
  const hits: SearchHit[] = [];
  for (const track of catalog.tracks) {
    if (matches(`${track.title.cs} ${track.title.en} ${track.description.cs}`)) hits.push({ kind: "track", trackId: track.id, label: track.title[locale] });
    for (const topic of getTrackTopics(catalog, track.id)) {
      if (matches(`${topic.title.cs} ${topic.title.en}`)) hits.push({ kind: "topic", trackId: track.id, topicId: topic.id, label: `${track.title[locale]} › ${topic.title[locale]}` });
      for (const skill of getTopicSkills(catalog, topic.id)) {
        const text = `${skill.title.cs} ${skill.title.en} ${topic.title.cs} ${(skill.keywords?.cs ?? []).join(" ")} ${(skill.keywords?.en ?? []).join(" ")}`;
        if (matches(text)) hits.push({ kind: "skill", trackId: track.id, topicId: topic.id, skillId: skill.id, label: `${skill.title[locale]} (${track.title[locale]})` });
      }
    }
  }
  const rank = { skill: 0, topic: 1, track: 2 } as const;
  return hits.sort((a, b) => rank[a.kind] - rank[b.kind]).slice(0, limit);
}

export type CheckLevel = "steps" | "answer" | "none";

/** How far the app can check this skill on its own: step by step, only the final answer, or not at all. */
export function skillCheckLevel(catalog: CourseCatalog, skill: Skill): CheckLevel {
  if (skill.autoCheck !== false) return "steps";
  const templates = getSkillTemplates(catalog, skill.id);
  return templates.length > 0 && templates.every(t => t.answerTemplate !== undefined) ? "answer" : "none";
}
