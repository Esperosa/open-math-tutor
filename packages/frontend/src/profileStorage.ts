import { emptyProfile, EXPLAIN_STYLES, type LearnerProfile } from '@openmathtutor/shared';

// Separate key: the learner profile can be reset or migrated without touching boards or mastery.
const KEY = 'openmathtutor.profile.v1';

export function loadProfile(): LearnerProfile {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return emptyProfile();
    const parsed = JSON.parse(raw) as LearnerProfile;
    if (parsed.version !== 1 || !EXPLAIN_STYLES.every(s => Number.isSafeInteger(parsed.styles?.[s]?.shown) && Number.isSafeInteger(parsed.styles[s].helped))) return emptyProfile();
    return { ...emptyProfile(), ...parsed };
  } catch { return emptyProfile(); }
}

export function saveProfile(profile: LearnerProfile): boolean {
  try { localStorage.setItem(KEY, JSON.stringify(profile)); return true; } catch { return false; }
}
