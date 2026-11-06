import { useMemo } from 'react';
import {
  getTopicSkills, isMastered, nextUnlockedSkill, nextUnlockedTopic, trackPercent, trackProgress,
  type CourseCatalog, type Locale,
} from '@openmathtutor/shared';
import type { MessageKey } from '../i18n';
import type { MasteryMap } from '../curriculumStorage';

interface Props {
  catalog: CourseCatalog;
  trackId: string;
  mastery: MasteryMap;
  t: Record<MessageKey, string>;
  locale: Locale;
  onChangeTrack: () => void;
}

/** Always-visible "where am I" indicator: which track, which topic, which
 * skill is next, and how far through the track the student has gotten. */
export function TrackBreadcrumb({ catalog, trackId, mastery, t, locale, onChangeTrack }: Props) {
  const track = catalog.tracks.find(tr => tr.id === trackId);
  const masteredIds = useMemo(() => new Set(Object.values(mastery).filter(isMastered).map(s => s.skillId)), [mastery]);
  if (!track) return null;
  const topic = nextUnlockedTopic(catalog, trackId, masteredIds);
  const skill = topic ? nextUnlockedSkill(getTopicSkills(catalog, topic.id), masteredIds) : null;
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
      <span className="mini-bar" aria-hidden="true"><span style={{ width: `${percent}%` }} /></span>{percent} %</span>
    <button className="track-breadcrumb-change" onClick={onChangeTrack}>{t.changeTrack}</button>
  </div>;
}
