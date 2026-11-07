import type { CourseCatalog, Locale, ProblemTemplate } from '@openmathtutor/shared';
import {
  instantiateProblem,
  type InstantiatedProblem,
  getSkillTemplates,
  getTopicSkills,
  nextUnlockedTopic,
  nextUnlockedSkill,
  isMastered,
  type MasteryState,
} from '@openmathtutor/shared';

export function instantiateWithLocale(
  template: ProblemTemplate,
  locale: Locale,
  random: () => number = Math.random,
): InstantiatedProblem {
  const effectiveTemplate =
    locale === 'en' && template.statementTemplateEn
      ? { ...template, statementTemplate: template.statementTemplateEn }
      : template;
  return instantiateProblem(effectiveTemplate, random);
}

export interface PickProblemResult {
  problem: InstantiatedProblem;
  template: ProblemTemplate;
  skillId: string;
}

export function pickNextProblemForSkill({
  catalog,
  skillId,
  difficultyLevel,
  recentStatements = [],
  locale,
  random = Math.random,
}: {
  catalog: CourseCatalog;
  skillId: string;
  difficultyLevel: number;
  recentStatements?: readonly string[];
  locale: Locale;
  random?: () => number;
}): PickProblemResult | null {
  const recentSet = new Set(recentStatements);
  const templates = getSkillTemplates(catalog, skillId);
  if (!templates.length) return null;

  const diffTemplates = templates.filter(t => t.difficultyLevel === difficultyLevel);
  const primaryTemplates = diffTemplates.length > 0 ? diffTemplates : templates;

  // 1. Fast random sampling from primary templates
  for (let i = 0; i < 40; i++) {
    const tpl = primaryTemplates[Math.floor(random() * primaryTemplates.length)]!;
    const candidate = instantiateWithLocale(tpl, locale, random);
    if (!recentSet.has(candidate.statement)) {
      return { problem: candidate, template: tpl, skillId };
    }
  }

  // 2. Fast random sampling from any template in the skill
  for (let i = 0; i < 40; i++) {
    const tpl = templates[Math.floor(random() * templates.length)]!;
    const candidate = instantiateWithLocale(tpl, locale, random);
    if (!recentSet.has(candidate.statement)) {
      return { problem: candidate, template: tpl, skillId };
    }
  }

  // 3. Exhaustive search across all templates in this skill
  for (const tpl of templates) {
    const tries = tpl.generatorRanges && Object.keys(tpl.generatorRanges).length > 0 ? 30 : 1;
    for (let i = 0; i < tries; i++) {
      const candidate = instantiateWithLocale(tpl, locale, random);
      if (!recentSet.has(candidate.statement)) {
        return { problem: candidate, template: tpl, skillId };
      }
    }
  }

  // 4. If all variations in this skill are exhausted, find sibling skill in the same topic
  const topic = catalog.topics.find(tp => tp.skillIds.includes(skillId));
  if (topic) {
    for (const sibId of topic.skillIds) {
      if (sibId === skillId) continue;
      const sibTemplates = getSkillTemplates(catalog, sibId);
      for (const tpl of sibTemplates) {
        const tries = tpl.generatorRanges && Object.keys(tpl.generatorRanges).length > 0 ? 20 : 1;
        for (let i = 0; i < tries; i++) {
          const candidate = instantiateWithLocale(tpl, locale, random);
          if (!recentSet.has(candidate.statement)) {
            return { problem: candidate, template: tpl, skillId: sibId };
          }
        }
      }
    }
  }

  // Fallback: instantiate primary template
  const fallbackTpl = primaryTemplates[0] ?? templates[0]!;
  return { problem: instantiateWithLocale(fallbackTpl, locale, random), template: fallbackTpl, skillId };
}

export function pickNextProblemForTrack({
  catalog,
  trackId,
  level,
  mastery,
  recentStatements = [],
  locale,
  random = Math.random,
}: {
  catalog: CourseCatalog;
  trackId: string;
  level: number;
  mastery: Record<string, MasteryState>;
  recentStatements?: readonly string[];
  locale: Locale;
  random?: () => number;
}): (PickProblemResult & { topicId: string }) | null {
  const masteredIds = new Set(
    Object.values(mastery)
      .filter(isMastered)
      .map(s => s.skillId),
  );
  const topic = nextUnlockedTopic(catalog, trackId, masteredIds);
  const skill = topic ? nextUnlockedSkill(getTopicSkills(catalog, topic.id), masteredIds) : null;
  if (!topic || !skill) return null;

  const difficultyLevel = mastery[skill.id]?.difficultyLevel ?? level;
  const res = pickNextProblemForSkill({
    catalog,
    skillId: skill.id,
    difficultyLevel,
    recentStatements,
    locale,
    random,
  });
  if (!res) return null;
  return { ...res, topicId: topic.id };
}
