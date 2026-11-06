import { useMemo } from 'react';
import {
  getTopicSkills, isMastered, nextUnlockedSkill, nextUnlockedTopic, trackPercent, trackProgress,
  type CourseCatalog, type Locale,
} from '@openmathtutor/shared';
import type { MessageKey } from '../i18n';
import type { MasteryMap } from '../curriculumStorage';
import { useTween } from '../useTween';

interface Props {
  catalog: CourseCatalog;
  trackId: string;
  mastery: MasteryMap;
  t: Record<MessageKey, string>;
  locale: Locale;
  onChangeTrack: () => void;
  /** Skill of the lesson on the board; when set, topic and skill shown are those, not the next unmastered ones. */
  currentSkillId?: string | null;
}

/** Always-visible "where am I" indicator: which track, which topic, which
 * skill is next, and how far through the track the student has gotten. */
export function TrackBreadcrumb({ catalog, trackId, mastery, t, locale, onChangeTrack, currentSkillId }: Props) {
  const track = catalog.tracks.find(tr => tr.id === trackId);
  const shownPercent = useTween(track ? trackPercent(catalog, trackId, mastery) : 0);
  const masteredIds = useMemo(() => new Set(Object.values(mastery).filter(isMastered).map(s => s.skillId)), [mastery]);
  if (!track) return null;
  const current = currentSkillId ? catalog.skills.find(sk => sk.id === currentSkillId) ?? null : null;
  const currentTopic = current ? catalog.topics.find(tp => tp.skillIds.includes(current.id) && track.topicIds.includes(tp.id)) ?? null : null;
  const topic = currentTopic ?? nextUnlockedTopic(catalog, trackId, masteredIds);
  const skill = currentTopic ? current : topic ? nextUnlockedSkill(getTopicSkills(catalog, topic.id), masteredIds) : null;
  const progress = trackProgress(catalog, trackId, masteredIds);
  const percent = trackPercent(catalog, trackId, mastery);

  return <div className="track-breadcrumb" data-testid="track-breadcrumb">
    <span className="track-breadcrumb-path">
      <strong>{track.title[locale]}</strong>
      {topic && <> <span aria-hidden="true">›</span> {topic.title[locale]}</>}
      {skill && <> <span aria-hidden="true">›</span> {skill.title[locale]}</>}
      {!topic && <> <span aria-hidden="true">›</span> {t.trackComplete}</>}
    </span>
    <span className="track-breadcrumb-progress" title={`${progress.masteredCount}/${progress.totalCount}`}>
      <span className="mini-bar" aria-hidden="true"><span style={{ width: `${percent}%` }} /></span>{shownPercent} %</span>
    <button className="track-breadcrumb-change" onClick={onChangeTrack}>{t.changeTrack}</button>
  </div>;
}
