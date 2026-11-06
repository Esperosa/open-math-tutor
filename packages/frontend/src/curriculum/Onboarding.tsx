import { Credit } from '../Credit';
import { useState } from 'react';
import type { CourseCatalog, Locale } from '@openmathtutor/shared';
import type { MessageKey } from '../i18n';

export type StartLevel = 1 | 2 | 3;

interface Props {
  catalog: CourseCatalog;
  t: Record<MessageKey, string>;
  locale: Locale;
  onSelectTrack: (trackId: string, level: StartLevel) => void;
  onSkip: () => void;
}

const GROUPS: { id: string; title: MessageKey; hint: MessageKey; trackIds: string[] }[] = [
  { id: 'zs', title: 'whoPrimary', hint: 'whoPrimaryHint', trackIds: ['ss-prijimacky'] },
  { id: 'ss', title: 'whoSecondary', hint: 'whoSecondaryHint', trackIds: ['maturita', 'vs-prijimacky'] },
  { id: 'sci', title: 'whoScience', hint: 'whoScienceHint', trackIds: ['fyzika', 'chemie'] },
  { id: 'vs', title: 'whoUniversity', hint: 'whoUniversityHint', trackIds: ['vysoka-skola', 'vs-analyza', 'vs-linearni-algebra', 'vs-diskretni', 'vs-statistika'] },
];
const LEVELS: { level: StartLevel; label: MessageKey }[] = [
  { level: 1, label: 'levelFresh' }, { level: 2, label: 'levelRefresh' }, { level: 3, label: 'levelAdvanced' },
];

export function Onboarding({ catalog, t, locale, onSelectTrack, onSkip }: Props) {
  const [groupId, setGroupId] = useState<string | null>(null);
  const [level, setLevel] = useState<StartLevel>(1);
  const group = GROUPS.find(g => g.id === groupId) ?? null;
  const tracks = group ? group.trackIds.map(id => catalog.tracks.find(tr => tr.id === id)).filter(tr => tr !== undefined) : [];
  return <div className="onboarding" role="dialog" aria-label={t.onboardingTitle}>
    <div className="onboarding-card">
      {!group ? <>
        <h1>{t.onboardingTitle}</h1>
        <p className="muted">{t.onboardingSubtitle}</p>
        <ul className="onboarding-tracks">
          {GROUPS.map(g => <li key={g.id}>
            <button className="onboarding-track" onClick={() => setGroupId(g.id)}>
              <strong>{t[g.title]}</strong><span>{t[g.hint]}</span>
            </button>
          </li>)}
        </ul>
      </> : <>
        <button className="onboarding-skip" onClick={() => setGroupId(null)}>← {t.onboardingBack}</button>
        <h1>{t[group.title]}</h1>
        <p className="muted">{t.levelQuestion}</p>
        <div className="level-picker" role="radiogroup" aria-label={t.levelQuestion}>
          {LEVELS.map(l => <button key={l.level} role="radio" aria-checked={level === l.level}
            className={level === l.level ? 'primary' : ''} onClick={() => setLevel(l.level)}>{t[l.label]}</button>)}
        </div>
        <ul className="onboarding-tracks">
          {tracks.map(track => <li key={track.id}>
            <button className="onboarding-track" onClick={() => onSelectTrack(track.id, level)}>
              <strong>{track.title[locale]}</strong>
              <span>{track.description[locale]}</span>
              {track.unofficial && <em>{t.unofficialSyllabus}</em>}
            </button>
          </li>)}
        </ul>
      </>}
      <button className="onboarding-skip" onClick={onSkip}>{t.onboardingSkip}</button>
      <div className="onboarding-credit"><Credit locale={locale} /></div>
    </div>
  </div>;
}
