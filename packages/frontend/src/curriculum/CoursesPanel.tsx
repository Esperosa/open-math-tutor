import { useMemo, useState } from 'react';
import {
  getTrackTopics, getTopicSkills, instantiateTemplate, nextUnlockedSkill, pickTemplateForDifficulty,
  isMastered, searchCatalog, type CourseCatalog, type CurriculumContext, type Locale, type Skill,
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
  onAsk?: (question: string) => void;
}

function masteryLabel(t: Record<MessageKey, string>, skill: Skill, mastery: MasteryMap, unlocked: boolean): string {
  const state = mastery[skill.id];
  if (state && isMastered(state)) return t.skillMastered;
  if (!unlocked) return t.skillLocked;
  if (state && state.attempts > 0) return t.skillInProgress;
  return t.skillNotStarted;
}

export function CoursesPanel({ catalog, mastery, t, locale, onStartLesson, activeSkillId, onAsk }: Props) {
  const [trackId, setTrackId] = useState('');
  const [topicId, setTopicId] = useState('');
  const [query, setQuery] = useState('');
  const hits = useMemo(() => searchCatalog(catalog, query, locale), [catalog, query, locale]);
  const track = catalog.tracks.find(tr => tr.id === trackId) ?? null;
  const topics = useMemo(() => (track ? getTrackTopics(catalog, track.id) : []), [catalog, track]);
  const topic = topics.find(tp => tp.id === topicId) ?? null;
  const skills = useMemo(() => (topic ? getTopicSkills(catalog, topic.id) : []), [catalog, topic]);
  const masteredIds = useMemo(() => new Set(Object.values(mastery).filter(isMastered).map(s => s.skillId)), [mastery]);

  function start(skill: Skill, tr = track, tp = topic) {
    if (!tr || !tp) return;
    const state = mastery[skill.id];
    const difficultyLevel = state?.difficultyLevel ?? 1;
    const template = pickTemplateForDifficulty(catalog, skill.id, difficultyLevel);
    if (!template) return;
    const statementText = instantiateTemplate(template);
    onStartLesson({
      skillId: skill.id, statementText, topic: tp.title[locale],
      curriculumContext: { trackId: tr.id, topicId: tp.id, skillId: skill.id, difficultyLevel: template.difficultyLevel },
    });
  }

  function open(hit: (typeof hits)[number]) {
    const tr = catalog.tracks.find(x => x.id === hit.trackId) ?? null;
    setTrackId(hit.trackId); setQuery('');
    if (hit.kind === 'track') { setTopicId(''); return; }
    setTopicId(hit.topicId);
    if (hit.kind === 'skill') {
      const tp = catalog.topics.find(x => x.id === hit.topicId) ?? null;
      const skill = catalog.skills.find(x => x.id === hit.skillId);
      if (skill && tr && tp) start(skill, tr, tp);
    }
  }

  return <section className="courses-panel">
    <h2>{t.courses}</h2>
    <label><span className="sr">{t.searchLabel}</span>
      <input id="course-search" type="search" value={query} placeholder={t.searchPlaceholder} onChange={e => setQuery(e.target.value)} /></label>
    {query.trim() && <ul className="search-results" data-testid="search-results">
      {hits.map(hit => <li key={`${hit.kind}-${hit.trackId}-${'topicId' in hit ? hit.topicId : ''}-${'skillId' in hit ? hit.skillId : ''}`}>
        <button onClick={() => open(hit)}>{hit.label}</button></li>)}
      {!hits.length && <li className="muted">{t.searchNone}</li>}
      {onAsk && <li><button className="primary" onClick={() => { onAsk(query.trim()); setQuery(''); }}>{t.searchAskAI.replace('{q}', query.trim())}</button></li>}
    </ul>}
    <label>{t.track}<select value={trackId} onChange={e => { setTrackId(e.target.value); setTopicId(''); }}>
      <option value="">{t.choose}</option>
      {catalog.tracks.map(tr => <option key={tr.id} value={tr.id}>{tr.title[locale]}</option>)}
    </select></label>
    {track && <p className="muted">{track.description[locale]}{track.unofficial && <> <em>({t.unofficialSyllabus})</em></>}</p>}
    {track && <label>{t.lessonTopic}<select value={topicId} onChange={e => setTopicId(e.target.value)}>
      <option value="">{t.choose}</option>
      {topics.map(tp => <option key={tp.id} value={tp.id}>{tp.title[locale]}</option>)}
    </select></label>}
    {topic && <ul className="skills-list">
      {skills.map(skill => {
        const unlocked = skill.prerequisiteSkillIds.every(id => masteredIds.has(id));
        const isNext = nextUnlockedSkill(skills, masteredIds)?.id === skill.id;
        return <li key={skill.id} data-testid="skill-item" className={skill.id === activeSkillId ? 'active' : ''}>
          <span>{skill.title[locale]}{skill.autoCheck === false && <small className="no-check" title={t.noAutoCheck}> · {t.noAutoCheck}</small>}</span>
          <small>{masteryLabel(t, skill, mastery, unlocked)}</small>
          <button disabled={!unlocked} onClick={() => start(skill)}>
            {!unlocked ? t.skillLocked : isNext ? t.startNextSkill : t.practiceSkill}
          </button>
        </li>;
      })}
    </ul>}
  </section>;
}
