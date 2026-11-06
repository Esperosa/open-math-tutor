import { useMemo, useState } from 'react';
import {
  getTrackTopics, getTopicSkills, getSkillTemplates, instantiateTemplate, nextUnlockedSkill,
  isMastered, type CourseCatalog, type CurriculumContext, type Locale, type ProblemTemplate, type Skill,
} from '@openmathtutor/shared';
import type { MessageKey } from '../i18n';
import type { MasteryMap } from '../curriculumStorage';

export interface LessonStart { skillId: string; statementText: string; topic: string; curriculumContext: CurriculumContext }

interface Props {
  catalog: CourseCatalog;
  mastery: MasteryMap;
  t: Record<MessageKey, string>;
  locale: Locale;
  onStartLesson: (lesson: LessonStart) => void;
  activeSkillId: string | null;
}

function pickTemplate(catalog: CourseCatalog, skillId: string, difficultyLevel: number): ProblemTemplate | null {
  const exact = getSkillTemplates(catalog, skillId, difficultyLevel);
  const pool = exact.length > 0 ? exact : getSkillTemplates(catalog, skillId);
  if (pool.length === 0) return null;
  return pool[Math.floor(Math.random() * pool.length)] ?? null;
}

function masteryLabel(t: Record<MessageKey, string>, skill: Skill, mastery: MasteryMap, unlocked: boolean): string {
  const state = mastery[skill.id];
  if (state && isMastered(state)) return t.skillMastered;
  if (!unlocked) return t.skillLocked;
  if (state && state.attempts > 0) return t.skillInProgress;
  return t.skillNotStarted;
}

export function CoursesPanel({ catalog, mastery, t, locale, onStartLesson, activeSkillId }: Props) {
  const [trackId, setTrackId] = useState('');
  const [topicId, setTopicId] = useState('');
  const track = catalog.tracks.find(tr => tr.id === trackId) ?? null;
  const topics = useMemo(() => (track ? getTrackTopics(catalog, track.id) : []), [catalog, track]);
  const topic = topics.find(tp => tp.id === topicId) ?? null;
  const skills = useMemo(() => (topic ? getTopicSkills(catalog, topic.id) : []), [catalog, topic]);
  const masteredIds = useMemo(() => new Set(Object.values(mastery).filter(isMastered).map(s => s.skillId)), [mastery]);

  function start(skill: Skill) {
    if (!track || !topic) return;
    const state = mastery[skill.id];
    const difficultyLevel = state?.difficultyLevel ?? 1;
    const template = pickTemplate(catalog, skill.id, difficultyLevel);
    if (!template) return;
    const statementText = instantiateTemplate(template);
    onStartLesson({
      skillId: skill.id, statementText, topic: topic.title[locale],
      curriculumContext: { trackId: track.id, topicId: topic.id, skillId: skill.id, difficultyLevel: template.difficultyLevel },
    });
  }

  return <section className="courses-panel">
    <h2>{t.courses}</h2>
    <label>{t.track}<select value={trackId} onChange={e => { setTrackId(e.target.value); setTopicId(''); }}>
      <option value="">{t.choose}</option>
      {catalog.tracks.map(tr => <option key={tr.id} value={tr.id}>{tr.title[locale]}</option>)}
    </select></label>
    {track && <p className="muted">{track.description[locale]}</p>}
    {track && <label>{t.lessonTopic}<select value={topicId} onChange={e => setTopicId(e.target.value)}>
      <option value="">{t.choose}</option>
      {topics.map(tp => <option key={tp.id} value={tp.id}>{tp.title[locale]}</option>)}
    </select></label>}
    {topic && <ul className="skills-list">
      {skills.map(skill => {
        const unlocked = skill.prerequisiteSkillIds.every(id => masteredIds.has(id));
        const isNext = nextUnlockedSkill(skills, masteredIds)?.id === skill.id;
        return <li key={skill.id} data-testid="skill-item" className={skill.id === activeSkillId ? 'active' : ''}>
          <span>{skill.title[locale]}</span>
          <small>{masteryLabel(t, skill, mastery, unlocked)}</small>
          <button disabled={!unlocked} onClick={() => start(skill)}>
            {!unlocked ? t.skillLocked : isNext ? t.startNextSkill : t.practiceSkill}
          </button>
        </li>;
      })}
    </ul>}
  </section>;
}
