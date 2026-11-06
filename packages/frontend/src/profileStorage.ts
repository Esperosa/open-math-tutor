import { emptyProfile, EXPLAIN_STYLES, type LearnerProfile } from '@openmathtutor/shared';

// Separate key: the learner profile can be reset or migrated without touching boards or mastery.
const KEY = 'openmathtutor.profile.v1';

export function loadProfile(): LearnerProfile {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return emptyProfile();
    const parsed = JSON.parse(raw) as LearnerProfile;
    if (parsed.version !== 1 || !EXPLAIN_STYLES.every(s => Number.isSafeInteger(parsed.styles?.[s]?.shown) && Number.isSafeInteger(parsed.styles[s].helped))) return emptyProfile();
    const plain = (v: unknown) => typeof v === 'object' && v !== null && !Array.isArray(v);
    const base = emptyProfile();
    const pendingOk = parsed.pending && EXPLAIN_STYLES.includes(parsed.pending.style) && typeof parsed.pending.key === 'string';
    const numbers = (v: unknown) => plain(v) && Object.values(v as object).every(n => Number.isFinite(n));
    const daysOk = plain(parsed.days) && Object.values(parsed.days).every(d => plain(d) && Number.isFinite((d as { solved: number }).solved) && Number.isFinite((d as { wrong: number }).wrong));
    return { ...base, ...parsed, errors: numbers(parsed.errors) ? parsed.errors : base.errors, pending: pendingOk ? parsed.pending : undefined, skillErrors: plain(parsed.skillErrors) && Object.values(parsed.skillErrors).every(plain) ? parsed.skillErrors : base.skillErrors, days: daysOk ? parsed.days : base.days };
  } catch { return emptyProfile(); }
}

export function saveProfile(profile: LearnerProfile): boolean {
  try { localStorage.setItem(KEY, JSON.stringify(profile)); return true; } catch { return false; }
}
