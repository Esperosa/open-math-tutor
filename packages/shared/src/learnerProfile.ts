/**
 * What the app has learned about one student, built silently from what they do:
 * which kinds of mistakes they make and which explanation styles actually worked.
 * Pure state transitions; storage lives in the frontend.
 */
export type ExplainStyle = "hint" | "worked" | "analogy" | "visual";
export const EXPLAIN_STYLES: readonly ExplainStyle[] = ["hint", "worked", "analogy", "visual"];

export interface StyleStat { shown: number; helped: number }
export interface LearnerProfile {
  version: 1;
  styles: Record<ExplainStyle, StyleStat>;
  errors: Record<string, number>;
  skillErrors: Record<string, Record<string, number>>;
  days: Record<string, { solved: number; wrong: number }>;
  /** Style just shown, waiting for the next line to tell whether it helped. */
  pending?: { style: ExplainStyle; key: string };
}

export function emptyProfile(): LearnerProfile {
  return { version: 1, styles: { hint: { shown: 0, helped: 0 }, worked: { shown: 0, helped: 0 }, analogy: { shown: 0, helped: 0 }, visual: { shown: 0, helped: 0 } },
    errors: {}, skillErrors: {}, days: {} };
}

/** Calendar day in the student's own time zone (the streak must not flip at 1 a.m. Czech time). */
export const dayKey = (now: number) => {
  const d = new Date(now);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
};

export function recordError(profile: LearnerProfile, skillId: string | null, reason: string, now: number): LearnerProfile {
  const day = profile.days[dayKey(now)] ?? { solved: 0, wrong: 0 };
  return { ...profile,
    errors: { ...profile.errors, [reason]: (profile.errors[reason] ?? 0) + 1 },
    skillErrors: skillId ? { ...profile.skillErrors, [skillId]: { ...profile.skillErrors[skillId], [reason]: (profile.skillErrors[skillId]?.[reason] ?? 0) + 1 } } : profile.skillErrors,
    days: { ...profile.days, [dayKey(now)]: { ...day, wrong: day.wrong + 1 } } };
}

export function recordSolved(profile: LearnerProfile, now: number): LearnerProfile {
  const day = profile.days[dayKey(now)] ?? { solved: 0, wrong: 0 };
  return { ...profile, days: { ...profile.days, [dayKey(now)]: { ...day, solved: day.solved + 1 } } };
}

/** Picks the explanation style with the best observed success, with a small bonus for styles not tried much. */
export function chooseStyle(profile: LearnerProfile, random: () => number = Math.random, avoid?: ExplainStyle): ExplainStyle {
  let best: ExplainStyle = "hint", bestScore = -Infinity;
  for (const style of EXPLAIN_STYLES) {
    if (style === avoid && EXPLAIN_STYLES.length > 1) continue;
    const { shown, helped } = profile.styles[style];
    const score = (helped + 1) / (shown + 2) + 0.35 / Math.sqrt(shown + 1) + random() * 0.05;
    if (score > bestScore) { best = style; bestScore = score; }
  }
  return best;
}

export function recordStyleShown(profile: LearnerProfile, style: ExplainStyle, key: string): LearnerProfile {
  return { ...profile, styles: { ...profile.styles, [style]: { ...profile.styles[style], shown: profile.styles[style].shown + 1 } }, pending: { style, key } };
}

/** The line written after an explanation was fine (helped) or still wrong (did not help). */
export function resolveStyleOutcome(profile: LearnerProfile, helped: boolean): LearnerProfile {
  if (!profile.pending) return profile;
  const { style } = profile.pending;
  const { pending: _pending, ...rest } = profile;
  void _pending;
  return { ...rest, styles: { ...profile.styles, [style]: { ...profile.styles[style], helped: profile.styles[style].helped + (helped ? 1 : 0) } } };
}

const STYLE_TEXT: Record<ExplainStyle, { cs: string; en: string }> = {
  hint: { cs: "krátká nápověda a naváděcí otázka", en: "a short hint and a guiding question" },
  worked: { cs: "vzorový příklad krok za krokem", en: "a worked example step by step" },
  analogy: { cs: "příměr z běžného života", en: "an everyday analogy" },
  visual: { cs: "obrázek nebo schéma", en: "a picture or diagram" },
};
export const styleDescription = (style: ExplainStyle, locale: "cs" | "en") => STYLE_TEXT[style][locale];

/** Short, plain-text summary handed to the AI so it explains the way this student learns best. */
export function profileSummary(profile: LearnerProfile, locale: "cs" | "en", preferred?: ExplainStyle, skillTitles: Record<string, string> = {}): string {
  const weakSkills = Object.entries(profile.skillErrors).map(([id, errs]) => [id, Object.values(errs).reduce((a, b) => a + b, 0)] as const)
    .sort((a, b) => b[1] - a[1]).slice(0, 2).filter(([id]) => skillTitles[id]).map(([id]) => skillTitles[id]);
  const topErrors = Object.entries(profile.errors).sort((a, b) => b[1] - a[1]).slice(0, 2).map(([k, v]) => `${k} (${v}x)`);
  const tried = EXPLAIN_STYLES.filter(s => profile.styles[s].shown >= 2)
    .map(s => `${styleDescription(s, locale)}: ${Math.round(100 * profile.styles[s].helped / profile.styles[s].shown)} %`);
  const parts = locale === "cs"
    ? [topErrors.length ? `Časté chyby studenta: ${topErrors.join(", ")}.` : "", weakSkills.length ? `Nejvíc chyb dělá v: ${weakSkills.join("; ")}.` : "", tried.length ? `Co mu pomáhá: ${tried.join("; ")}.` : "",
       preferred ? `Teď použij: ${styleDescription(preferred, locale)}.` : "", "Buď vřelý, stručný a jasný."]
    : [topErrors.length ? `Frequent mistakes: ${topErrors.join(", ")}.` : "", weakSkills.length ? `Most mistakes in: ${weakSkills.join("; ")}.` : "", tried.length ? `What helps: ${tried.join("; ")}.` : "",
       preferred ? `Use now: ${styleDescription(preferred, locale)}.` : "", "Be warm, brief and clear."];
  return parts.filter(Boolean).join(" ").slice(0, 700);
}
