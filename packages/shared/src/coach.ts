/**
 * Local tutoring coach. Pure functions that look at what the student wrote and
 * decide what, if anything, the tutor should react to — no AI, no network.
 * The caller keeps the `handled` set so every written line is judged once.
 */
import { checkStep, checkSteps, statementHasSymbols } from "./stepCheck.js";
import { checkAnswerLine, looksLikeFinalLine, type ExpectedAnswer } from "./answers.js";

export type CoachMode = "live" | "final" | "off";
export type WrongReason = "arithmetic" | "not_equivalent" | "wrong_value";

export type CoachEvent =
  | { kind: "idle" }
  | { kind: "ok_step"; key: string; n: number }
  | { kind: "wrong_step"; key: string; n: number; reason: WrongReason }
  | { kind: "check_in"; key: string; n: number }
  | { kind: "solved"; key: string; n: number }
  | { kind: "wrong_final"; key: string; n: number; reason?: "unit" }
  | { kind: "unclear"; key: string; n: number };

export interface CoachInput {
  mode: CoachMode;
  statement: string;
  steps: readonly { stepId: string; latexGuess: string }[];
  expected?: ExpectedAnswer | undefined;
  handled: ReadonlySet<string>;
}

export const stepKey = (step: { stepId: string; latexGuess: string }) => `${step.stepId}:${step.latexGuess}`;

export function nextCoachEvent(input: CoachInput): CoachEvent {
  if (input.mode === "off") return { kind: "idle" };
  const written = input.steps.map((s, i) => ({ ...s, n: i + 1 })).filter(s => s.latexGuess.trim());
  const newest = written.filter(s => !input.handled.has(stepKey(s))).at(-1);
  if (!newest) return { kind: "idle" };
  const key = stepKey(newest);
  const hasSymbols = statementHasSymbols(input.statement) || written.some(s => statementHasSymbols(s.latexGuess));
  const final = looksLikeFinalLine(newest.latexGuess, hasSymbols);
  const index = written.indexOf(newest);
  const previous = index > 0 ? written[index - 1]!.latexGuess : input.statement.trim() || null;

  if (input.mode === "final") {
    if (!final || newest !== written.at(-1)) return { kind: "idle" };
    const verdicts = checkSteps(input.statement, written);
    const firstWrong = written.find(s => verdicts[s.stepId]?.status === "wrong");
    if (firstWrong) return { kind: "wrong_step", key, n: firstWrong.n, reason: verdicts[firstWrong.stepId]!.reason ?? "not_equivalent" };
    if (input.expected) {
      const answer = checkAnswerLine(input.expected, newest.latexGuess);
      if (answer === "correct") return { kind: "solved", key, n: newest.n };
      if (answer === "wrong") return { kind: "wrong_final", key, n: newest.n };
      if (answer === "maybe") return { kind: "check_in", key, n: newest.n };
      if (answer === "unit") return { kind: "wrong_final", key, n: newest.n, reason: "unit" };
    }
    return { kind: "unclear", key, n: newest.n };
  }

  const verdict = checkStep(newest.latexGuess, previous);
  // The first line of a free board is the task itself: nothing to verify, nothing to comment on.
  if (verdict.status === "unknown" && input.statement.trim() === newest.latexGuess.trim()) return { kind: "ok_step", key, n: newest.n };
  if (verdict.status === "wrong") return { kind: "wrong_step", key, n: newest.n, reason: verdict.reason ?? "not_equivalent" };
  if (input.expected) {
    const answer = checkAnswerLine(input.expected, newest.latexGuess);
    if (answer === "correct" && (final || verdict.status === "ok")) return { kind: "solved", key, n: newest.n };
    if (answer === "wrong" && final) return { kind: "wrong_final", key, n: newest.n };
    if (answer === "maybe" && final) return { kind: "check_in", key, n: newest.n };
    if (answer === "unit" && final) return { kind: "wrong_final", key, n: newest.n, reason: "unit" };
  }
  if (verdict.status === "ok") return { kind: "ok_step", key, n: newest.n };
  return { kind: "unclear", key, n: newest.n };
}

type Locale = "cs" | "en";
const LINES: Record<string, Record<Locale, string[]>> = {
  arithmetic: {
    cs: ["Tady se to nesčítá. Zkus ten řádek přepočítat.", "Ten výsledek nesedí. Projdi si to ještě jednou.", "Pozor, v tomhle řádku je chyba v počítání."],
    en: ["That does not add up. Try recalculating this line.", "That result is off. Go through it once more.", "Careful, there is a calculation slip on this line."],
  },
  not_equivalent: {
    cs: ["Tenhle krok nevyplývá z předchozího. Co jsi udělal(a) s oběma stranami?", "Tady se rovnice změnila. Zkus úpravu zopakovat krok po kroku.", "Řádek {n} nesedí s předchozím. Chceš se na něj podívat spolu?"],
    en: ["This step does not follow from the previous one. What did you do to both sides?", "The equation changed here. Redo the step slowly.", "Line {n} does not match the one before. Shall we look at it together?"],
  },
  wrong_value: {
    cs: ["Tahle hodnota nesouhlasí se zadáním.", "Počítáš to správně, ale něco jiného, než se ptá zadání."],
    en: ["This value does not match the task.", "The calculation is fine, but it answers something other than the task."],
  },
  check_in: {
    cs: ["To ještě není výsledek, který čekám. Je to mezivýsledek? Pokračuj, nebo se zeptej."],
    en: ["That is not the result I am expecting yet. Is it an intermediate result? Keep going, or ask."],
  },
  wrong_unit: {
    cs: ["Číslo sedí, ale jednotka ne. Podívej se na ni ještě jednou."],
    en: ["The number is right, but the unit is not. Take another look at it."],
  },
  wrong_final: {
    cs: ["Výsledek zatím nesedí. Hledáme chybu spolu?", "Skoro. Výsledek ještě není ono, chceš nápovědu?"],
    en: ["The result is not right yet. Shall we look for the slip together?", "Close. The result is not quite it, want a hint?"],
  },
  solved: {
    cs: ["Výborně, sedí!", "Správně! Pěkná práce.", "To je ono, výsledek sedí."],
    en: ["Well done, that is right!", "Correct! Nice work.", "That is it, the result matches."],
  },
  ok_step: { cs: ["Dobře.", "Sedí.", "Pokračuj."], en: ["Good.", "That works.", "Keep going."] },
  unclear: {
    cs: ["Tohle neumím rychle ověřit sám. Chceš, aby se na to podíval AI učitel?"],
    en: ["I cannot check this one quickly myself. Want the AI teacher to take a look?"],
  },
};

export function coachLine(event: CoachEvent, locale: Locale, variant = 0): string {
  const group = event.kind === "wrong_step" ? event.reason : event.kind === "wrong_final" && event.reason ? "wrong_unit" : event.kind;
  const options = LINES[group]?.[locale];
  if (!options?.length) return "";
  const text = options[Math.abs(variant) % options.length]!;
  return "n" in event ? text.replace("{n}", String(event.n)) : text;
}

/** Events that interrupt the student (vs. the quiet ok_step). */
export const isInterruption = (event: CoachEvent) => event.kind === "wrong_step" || event.kind === "wrong_final" || event.kind === "unclear";
