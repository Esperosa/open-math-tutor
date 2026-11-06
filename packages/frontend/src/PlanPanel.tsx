import { useState } from 'react';
import {
  dayKey as dayKeyAt, getTopicSkills, getTrackTopics, isMastered, nextUnlockedSkill, skillCheckLevel, skillProgress, topicPercent, trackPercent,
  type CourseCatalog, type LearnerProfile, type Locale, type Skill,
} from '@openmathtutor/shared';
import type { MessageKey } from './i18n';
import type { MasteryMap } from './curriculumStorage';

interface Props {
  catalog: CourseCatalog;
  trackId: string;
  mastery: MasteryMap;
  profile: LearnerProfile;
  t: Record<MessageKey, string>;
  locale: Locale;
  currentSkillId: string | null;
  onStartSkill(topicId: string, skillId: string): void;
  onBuildTest(scope: { topicId?: string }, mode: 'print' | 'download'): void;
}

const dayKey = (offset: number) => dayKeyAt(Date.now() - offset * 86400000);

function streak(profile: LearnerProfile): number {
  let i = (profile.days[dayKey(0)]?.solved ?? 0) > 0 ? 0 : 1, n = 0;
  while (i < 400 && (profile.days[dayKey(i)]?.solved ?? 0) > 0) { n++; i++; }
  return n;
}

function Bar({ value, label }: { value: number; label: string }) {
  return <span className="plan-bar" role="progressbar" aria-label={label} aria-valuemin={0} aria-valuemax={100} aria-valuenow={value}>
    <span style={{ width: `${value}%` }} /></span>;
}

export function PlanPanel({ catalog, trackId, mastery, profile, t, locale, currentSkillId, onStartSkill, onBuildTest }: Props) {
  const [scope, setScope] = useState('');
  const track = catalog.tracks.find(tr => tr.id === trackId);
  if (!track) return <div className="plan-panel"><h2>{t.planTitle}</h2><p className="muted">{t.planNothing}</p></div>;
  const topics = getTrackTopics(catalog, trackId);
  const masteredIds = new Set(Object.values(mastery).filter(isMastered).map(s => s.skillId));
  const percent = trackPercent(catalog, trackId, mastery);
  const today = profile.days[dayKey(0)]?.solved ?? 0;
  const days = streak(profile);
  const nextSkill = (skills: Skill[]) => nextUnlockedSkill(skills, masteredIds)?.id;
  const checkLabel = (skill: Skill): string => {
    if (skill.drawing) return t.checkDrawing;
    const level = skillCheckLevel(catalog, skill);
    return level === 'steps' ? t.checkSteps : level === 'answer' ? t.checkAnswer : t.checkNone;
  };
  return <div className="plan-panel">
    <h2>{track.title[locale]}</h2>
    <div className="plan-hero"><strong data-testid="plan-percent">{percent} %</strong><Bar value={percent} label={t.planTitle} /></div>
    <p className="muted">{t.planToday.replace('{n}', String(today))} · {t.planStreak.replace('{n}', String(days))}</p>
    <ol className="plan-topics">
      {topics.map(topic => {
        const skills = getTopicSkills(catalog, topic.id);
        const next = nextSkill(skills);
        return <li key={topic.id}>
          <div className="plan-topic-head"><strong>{topic.title[locale]}</strong><small>{topicPercent(catalog, topic.id, mastery)} %</small></div>
          <ul className="plan-skills">
            {skills.map(skill => {
              const done = masteredIds.has(skill.id);
              const unlocked = skill.prerequisiteSkillIds.every(id => masteredIds.has(id));
              const state = done ? t.planDone : skill.id === currentSkillId ? t.planNow : unlocked ? (skill.id === next ? t.planNext : t.planWaiting) : t.planLocked;
              return <li key={skill.id} data-testid="plan-skill" className={`plan-skill${skill.id === currentSkillId ? ' current' : ''}${done ? ' done' : ''}`}>
                <div><span>{skill.title[locale]}</span><small>{state} · {checkLabel(skill)}</small></div>
                <Bar value={skillProgress(mastery[skill.id])} label={skill.title[locale]} />
                <button disabled={!unlocked && !done} onClick={() => onStartSkill(topic.id, skill.id)}>{t.planStart}</button>
              </li>;
            })}
          </ul>
        </li>;
      })}
    </ol>
    <h2>{t.testTitle}</h2>
    <label>{t.testScope}<select value={scope} onChange={e => setScope(e.target.value)}>
      <option value="">{t.testWholeTrack}</option>
      {topics.map(topic => <option key={topic.id} value={topic.id}>{topic.title[locale]}</option>)}
    </select></label>
    <div className="row">
      <button className="primary" onClick={() => onBuildTest(scope ? { topicId: scope } : {}, 'print')}>{t.testBuild}</button>
      <button onClick={() => onBuildTest(scope ? { topicId: scope } : {}, 'download')}>{t.testDownload}</button>
    </div>
    <p className="muted">{t.testHelp}</p>
  </div>;
}
