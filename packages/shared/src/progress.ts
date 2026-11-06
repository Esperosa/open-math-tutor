import { MASTERED_STREAK_REQUIRED, MAX_DIFFICULTY, type MasteryState } from "./mastery.js";
import { getTopicSkills, getTrackTopics, type CourseCatalog } from "./curriculum.js";

/** 0-100 for one skill, driven only by mastery data: untouched is 0, mastered is 100, in between follows difficulty and streak. */
export function skillProgress(state: MasteryState | undefined): number {
  if (!state || state.attempts === 0) return 0;
  if (state.masteredAt !== null) return 100;
  // Progress is earned by correct work: a failed first attempt does not move the bar.
  if ((state.correctTotal ?? (state.correctStreak > 0 ? 1 : 0)) === 0) return 0;
  const raw = ((state.difficultyLevel - 1) + Math.min(1, state.correctStreak / MASTERED_STREAK_REQUIRED)) / MAX_DIFFICULTY;
  return Math.max(3, Math.min(95, Math.round(raw * 95)));
}

/** Any real progress shows as at least 1 %, so a first correct answer visibly moves the bar. */
const roundUp = (value: number) => (value > 0 ? Math.max(1, Math.round(value)) : 0);

export function trackSkills(catalog: CourseCatalog, trackId: string) {
  const seen = new Set<string>();
  return getTrackTopics(catalog, trackId).flatMap(topic => getTopicSkills(catalog, topic.id)).filter(skill => !seen.has(skill.id) && seen.add(skill.id));
}

/** Percentage of a whole track, the average of its skills' progress (changes with every solved or failed problem). */
export function trackPercent(catalog: CourseCatalog, trackId: string, mastery: Readonly<Record<string, MasteryState>>): number {
  const skills = trackSkills(catalog, trackId);
  if (!skills.length) return 0;
  return roundUp(skills.reduce((sum, skill) => sum + skillProgress(mastery[skill.id]), 0) / skills.length);
}

export function topicPercent(catalog: CourseCatalog, topicId: string, mastery: Readonly<Record<string, MasteryState>>): number {
  const skills = getTopicSkills(catalog, topicId);
  if (!skills.length) return 0;
  return roundUp(skills.reduce((sum, skill) => sum + skillProgress(mastery[skill.id]), 0) / skills.length);
}

export function topicMastered(catalog: CourseCatalog, topicId: string, mastery: Readonly<Record<string, MasteryState>>): boolean {
  const skills = getTopicSkills(catalog, topicId);
  return skills.length > 0 && skills.every(skill => mastery[skill.id]?.masteredAt != null);
}
