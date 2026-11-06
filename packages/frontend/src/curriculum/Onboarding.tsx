import type { CourseCatalog, Locale } from '@openmathtutor/shared';
import type { MessageKey } from '../i18n';

interface Props {
  catalog: CourseCatalog;
  t: Record<MessageKey, string>;
  locale: Locale;
  onSelectTrack: (trackId: string) => void;
  onSkip: () => void;
}

/** First-run screen: "who are you studying for" before anything else. Reachable
 * again later via the track breadcrumb's "change track" action, not just once. */
export function Onboarding({ catalog, t, locale, onSelectTrack, onSkip }: Props) {
  return <div className="onboarding" role="dialog" aria-label={t.onboardingTitle}>
    <div className="onboarding-card">
      <h1>{t.onboardingTitle}</h1>
      <p className="muted">{t.onboardingSubtitle}</p>
      <ul className="onboarding-tracks">
        {catalog.tracks.map(track => <li key={track.id}>
          <button className="onboarding-track" onClick={() => onSelectTrack(track.id)}>
            <strong>{track.title[locale]}</strong>
            <span>{track.description[locale]}</span>
          </button>
        </li>)}
      </ul>
      <button className="onboarding-skip" onClick={onSkip}>{t.onboardingSkip}</button>
    </div>
  </div>;
}
