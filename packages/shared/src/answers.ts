/**
 * Programmatic expected answers and answer-line checking. Lets the app judge a
 * finished problem without any AI call: expressions and single-variable linear
 * equations are solved from the safe AST, and templates may carry an
 * `answerTemplate` (physics/chemistry/word problems) evaluated by calcEvaluate.
 */
import { parseMathStatement, type MathStatement } from "./mathAst.js";
import { evaluateMathAst } from "./mathEval.js";
import { calcEvaluate, CalcError } from "./calc.js";
import type { ProblemTemplate } from "./curriculum.js";
import { linearSolution } from "./stepCheck.js";

export interface ExpectedAnswer {
  value: number;
  unit?: string;
  /** Relative tolerance for the comparison (rounded physics answers need more than exact arithmetic). */
  tolerance: number;
}

export interface InstantiatedProblem { statement: string; expected?: ExpectedAnswer }

function evalStatement(statement: MathStatement): number | null {
  try {
    if (statement.form === "expression") return evaluateMathAst(statement.value, {});
    if (statement.value.op !== "eq") return null;
    const solved = linearSolution(statement);
    return solved ? solved.value : null;
  } catch { return null; }
}

/** Expected answer for a plain-grammar statement (expression value or linear-equation root), else undefined. */
export function expectedAnswerFor(statementText: string): ExpectedAnswer | undefined {
  let parsed: MathStatement;
  try { parsed = parseMathStatement(statementText.trim()); } catch { return undefined; }
  const value = evalStatement(parsed);
  return value !== null && Number.isFinite(value) ? { value, tolerance: 1e-9 } : undefined;
}

/** "1+-8" reads badly on a task card: write the sign the way a person would. */
export function prettySigns(statement: string): string {
  return statement.replace(/\+-/g, "-").replace(/--/g, "+").replace(/([*/^])-(\d+(?:[.,]\d+)?)/g, "$1(-$2)")
    .replace(/\(([a-z])[+-]0\)/g, "$1").replace(/(^|[^\d.,\p{L}])1([a-z])(?![\p{L}])/gu, "$1$2");
}

function substitute(text: string, values: Record<string, number>): string {
  let out = text;
  for (const [name, value] of Object.entries(values)) out = out.split(`{${name}}`).join(value < 0 ? `(${value})` : String(value));
  return out;
}

/**
 * Instantiates a template with random values and computes its expected answer. `derived` values are computed
 * from the sampled ones (so a division task can be built to come out even); templates whose answer cannot be
 * computed (for example an equation with no single root) are re-sampled a few times.
 */
export function instantiateProblem(template: ProblemTemplate, random: () => number = Math.random): InstantiatedProblem {
  let last: InstantiatedProblem = { statement: template.statementTemplate };
  for (let attempt = 0; attempt < 25; attempt++) {
    const values: Record<string, number> = {};
    for (const [name, [min, max]] of Object.entries(template.generatorRanges ?? {})) values[name] = min + Math.floor(random() * (max - min + 1));
    for (const [name, formula] of Object.entries(template.derived ?? {})) {
      try { values[name] = calcEvaluate(substitute(formula, values)); } catch (e) { if (!(e instanceof CalcError)) throw e; }
    }
    let statement = template.statementTemplate;
    for (const [name, value] of Object.entries(values)) statement = statement.split(`{${name}}`).join(String(value));
    statement = prettySigns(statement);
    let expected: ExpectedAnswer | undefined;
    if (template.answerTemplate) {
      try {
        const raw = calcEvaluate(substitute(template.answerTemplate, values));
        const value = Math.round(raw * 1e9) / 1e9;
        expected = { value, ...(template.answerUnit ? { unit: template.answerUnit } : {}), tolerance: Number.isInteger(value) ? 1e-9 : 0.01 };
      } catch (e) { if (!(e instanceof CalcError)) throw e; }
    } else if (!template.freeText) expected = expectedAnswerFor(statement);
    last = expected ? { statement, expected } : { statement };
    if (expected || template.freeText || template.answerTemplate) return last;
  }
  return last;
}

const NUMBER = /[-−]?\d+(?:[.,]\d+)?(?:\s*(?:[·×x*]\s*10\s*\^?\s*[-−]?\d+))?/g;

function numberValue(token: string): number | null {
  const m = /^([-−]?\d+(?:[.,]\d+)?)(?:\s*[·×x*]\s*10\s*\^?\s*([-−]?\d+))?$/.exec(token.trim());
  if (!m) return null;
  const base = Number(m[1]!.replace("−", "-").replace(",", "."));
  const exp = m[2] ? Number(m[2].replace("−", "-")) : 0;
  const value = base * Math.pow(10, exp);
  return Number.isFinite(value) ? value : null;
}

/**
 * The number a student wrote as the answer on a line: the leading numeric expression after the last "="
 * (so "2/5", "120/8" and "2,5·10^-3 mol" all work, units are ignored), else the first number found.
 */
const ANSWER_WORDS = /^(?:odpověď|odpoved|výsledek|vysledek|answer|result)\s*[:=]?\s*/i;

const SCIENTIFIC = /^([-−]?\d+(?:[.,]\d+)?)\s*(?:[xX×·*]\s*10\s*\^?\s*([-−]?\d+)|[eE]\s*([-−]?\d+))/;

export function answerFromLine(line: string): number | null {
  const text = line.trim().replace(ANSWER_WORDS, "");
  if (!text) return null;
  const tail = (text.includes("=") ? text.slice(text.lastIndexOf("=") + 1) : text).trim();
  const sci = SCIENTIFIC.exec(tail);
  if (sci) {
    const value = Number(sci[1]!.replace("−", "-").replace(",", ".")) * Math.pow(10, Number((sci[2] ?? sci[3]!).replace("−", "-")));
    if (Number.isFinite(value)) return value;
  }
  const prefix = (/^[\d\s.,+\-−*×·/^()%]+/.exec(tail)?.[0] ?? "").replace(/·/g, "*").trim();
  if (prefix && /\d/.test(prefix)) {
    try { return calcEvaluate(prefix); } catch (e) { if (!(e instanceof CalcError)) throw e; }
  }
  const tokens = tail.match(NUMBER);
  return tokens?.length ? numberValue(tokens[0]!) : null;
}

/**
 * True when a line reads like a final result ("x = 3", "v = 15 m/s", "= 14", a bare number) and not an
 * intermediate step such as "2x = 4". `taskHasSymbols` says whether the task statement contains a variable.
 */
export function looksLikeFinalLine(line: string, taskHasSymbols: boolean): boolean {
  const text = line.trim().replace(ANSWER_WORDS, "");
  if (!text) return false;
  const eq = text.lastIndexOf("=");
  const tail = (eq >= 0 ? text.slice(eq + 1) : text).trim();
  const fractionless = tail.replace(/^([-−]?\d+(?:[.,]\d+)?)\s*\/\s*\d+(?:[.,]\d+)?(?=\s|$|[\p{L}°%µΩπ])/u, "$1");
  const m = /^[-−]?\d+(?:[.,]\d+)?(?:\s*[·×x*]\s*10\s*\^?\s*[-−]?\d+)?\s*(.*)$/u.exec(fractionless);
  if (!m) return false;
  const rest = m[1]!;
  if (rest !== "" && !/^[\p{L}°%µΩ][\p{L}°%µΩ/²³^·\-\d\s.]*$/u.test(rest)) return false;
  if (eq < 0) return true;
  const left = text.slice(0, eq).trim();
  if (left === "") return true;
  if (/^[\p{L}](?:_?[\p{L}\d]{0,3})?(?:\([^)]{0,12}\))?$/u.test(left)) return true;
  return !taskHasSymbols;
}

export type AnswerVerdict = "correct" | "wrong" | "unit" | "none";

const normalizeUnit = (unit: string) => unit.toLowerCase().replace(/[\s·.,;]/g, "").replace(/[π^]/g, "").replace(/²/g, "2").replace(/³/g, "3").replace(/ω|ohm/g, "Ω");

/** The unit the student wrote after the number, or "" (also "" when the trailing text is not a unit at all). */
export function unitFromLine(line: string): string {
  const text = line.trim().replace(ANSWER_WORDS, "");
  const tail = (text.includes("=") ? text.slice(text.lastIndexOf("=") + 1) : text).trim();
  const prefix = /^[\d\s.,+\-−*×·/^()%]+/.exec(tail)?.[0] ?? "";
  const rest = tail.slice(prefix.length).trim();
  return /^[\p{L}°%µΩπ][\p{L}°%µΩπ/²³^·\-\d\s.]{0,14}$/u.test(rest) ? rest : "";
}

export function checkAnswerLine(expected: ExpectedAnswer, line: string): AnswerVerdict {
  const given = answerFromLine(line);
  if (given === null) return "none";
  const scale = Math.max(Math.abs(expected.value), 1e-12);
  if (Math.abs(given - expected.value) > expected.tolerance * scale + 1e-12) return "wrong";
  const unit = unitFromLine(line);
  const written = normalizeUnit(unit);
  if (written && expected.unit && written !== normalizeUnit(expected.unit)) return "unit";
  return "correct";
}

export function formatExpected(expected: ExpectedAnswer, locale: "cs" | "en"): string {
  const { value } = expected;
  let text: string;
  if (value !== 0 && (Math.abs(value) >= 1e6 || Math.abs(value) < 1e-3)) {
    const [mantissa, exponent] = value.toExponential(3).split("e");
    text = `${Number(mantissa)}·10^${Number(exponent)}`;
  } else text = String(Number(value.toPrecision(6)));
  if (locale === "cs") text = text.replace(".", ",");
  return `${text}${expected.unit ? ` ${expected.unit}` : ""}`;
}
