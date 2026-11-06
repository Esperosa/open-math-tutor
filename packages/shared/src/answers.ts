/**
 * Programmatic expected answers and answer-line checking. Lets the app judge a
 * finished problem without any AI call: expressions and single-variable linear
 * equations are solved from the safe AST, and templates may carry an
 * `answerTemplate` (physics/chemistry/word problems) evaluated by calcEvaluate.
 */
import { numberMatches } from "./numberMatch.js";
import { MAX_INPUT_LENGTH, parseMathStatement, type MathStatement } from "./mathAst.js";
import { evaluateMathAst } from "./mathEval.js";
import { calcEvaluate, CalcError } from "./calc.js";
import type { ProblemTemplate } from "./curriculum.js";
import { linearSolution } from "./stepCheck.js";

export interface ExpectedAnswer {
  value: number;
  unit?: string;
  /** Legacy persisted field; comparisons use written precision, not a relative error band. */
  tolerance: number;
  /** A word problem: lines with other numbers are usually given data or intermediate results, not wrong answers. */
  wordProblem?: boolean;
  /** Numbers written in the statement itself: a line that merely repeats one of them is given data. */
  givens?: number[];
  /** Explicit school fraction: permit the conventional two-place decimal approximation. */
  fractionRounding?: boolean;
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
/** Every number written in a statement (decimal comma allowed). */
export function numbersIn(text: string): number[] {
  return (text.match(/\d+(?:[.,]\d+)?/g) ?? []).map(n => Number(n.replace(",", "."))).filter(Number.isFinite);
}

export function expectedAnswerFor(statementText: string): ExpectedAnswer | undefined {
  if (statementText.length > MAX_INPUT_LENGTH) return undefined;
  let parsed: MathStatement;
  try { parsed = parseMathStatement(statementText.trim()); } catch {
    // The verifier grammar intentionally accepts integers only; local decimal
    // arithmetic is still safe to evaluate with the allowlisted calculator.
    if (!/^[\d.,\s+\-−*/()·×÷^]+$/.test(statementText)) return undefined;
    try { return { value: calcEvaluate(statementText.replace(/·/g, '*')), tolerance: 1e-9 }; } catch { return undefined; }
  }
  const value = evalStatement(parsed);
  return value !== null && Number.isFinite(value) ? { value, tolerance: 1e-9,
    ...(parsed.form === 'expression' && /^\s*[-−]?\d+\s*\/\s*\d+\s*$/.test(statementText) ? { fractionRounding: true } : {}) } : undefined;
}

/** "1+-8" reads badly on a task card: write the sign the way a person would. */
export function prettySigns(statement: string): string {
  return statement.replace(/\+-/g, "-").replace(/--/g, "+").replace(/([*/^])-(\d+(?:[.,]\d+)?)/g, "$1(-$2)")
    .replace(/\(([a-z])[+-]0\)/g, "$1").replace(/[+-]0(?=[=+\-)]|$)/g, "").replace(/(^|[^\d.,\p{L}])1([a-z])(?![\p{L}])/gu, "$1$2");
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
        const value = raw;
        expected = { value, ...(template.answerUnit ? { unit: template.answerUnit } : {}), tolerance: 1e-9, ...(template.freeText ? { wordProblem: true, givens: numbersIn(statement) } : {}) };
      } catch (e) { if (!(e instanceof CalcError)) throw e; }
    } else if (!template.freeText) expected = expectedAnswerFor(statement);
    last = expected ? { statement, expected } : { statement };
    if (expected || template.freeText || template.answerTemplate) return last;
  }
  return last;
}

const NUMBER = /[-−]?\d+(?:[.,]\d+)?(?:\s*(?:[·×x*]\s*10\s*\^?\s*[+−-]?\d+))?/g;

function numberValue(token: string): number | null {
  const m = /^([-−]?\d+(?:[.,]\d+)?)(?:\s*[·×x*]\s*10\s*\^?\s*([+−-]?\d+))?$/.exec(token.trim());
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

const SCIENTIFIC = /^([-−]?\d+(?:[.,]\d+)?)\s*(?:[xX×·*]\s*10\s*\^?\s*([+−-]?\d+)|[eE]\s*([+−-]?\d+))/;

export function answerFromLine(line: string): number | null {
  if (line.length > MAX_INPUT_LENGTH) return null;
  const text = line.trim().replace(ANSWER_WORDS, "");
  if (!text) return null;
  const tail = (text.includes("=") ? text.slice(text.lastIndexOf("=") + 1) : text).trim();
  const mixed = /^([-−]?\d+)\s+(\d+)\s*\/\s*(\d+)(?!\d)/.exec(tail);
  if (mixed && Number(mixed[3]) !== 0) {
    const whole = Number(mixed[1]!.replace("−", "-"));
    const fraction = Number(mixed[2]) / Number(mixed[3]);
    return whole < 0 || mixed[1]!.startsWith("-") || mixed[1]!.startsWith("−") ? whole - fraction : whole + fraction;
  }
  const sci = SCIENTIFIC.exec(tail);
  if (sci) {
    const value = Number(sci[1]!.replace("−", "-").replace(",", ".")) * Math.pow(10, Number((sci[2] ?? sci[3]!).replace("−", "-")));
    if (Number.isFinite(value)) return value;
  }
  const prefix = (/^[\d\s.,+\-−*×·/^()%]+/.exec(tail)?.[0] ?? "").replace(/·/g, "*").replace(/\s*%\s*$/, "").trim();
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
  if (line.length > MAX_INPUT_LENGTH) return false;
  const text = line.trim().replace(ANSWER_WORDS, "");
  if (!text) return false;
  const eq = text.lastIndexOf("=");
  const tail = (eq >= 0 ? text.slice(eq + 1) : text).trim();
  const numericTail = SCIENTIFIC.test(tail) ? tail.replace(SCIENTIFIC, "1") : tail;
  const mixedless = numericTail.replace(/^([-−]?\d+)\s+\d+\s*\/\s*\d+(?=\s|$|[\p{L}°%µΩπ])/u, "$1");
  const fractionless = mixedless.replace(/^([-−]?\d+(?:[.,]\d+)?)\s*\/\s*\d+(?:[.,]\d+)?(?=\s|$|[\p{L}°%µΩπ])/u, "$1");
  const m = /^[-−]?\d+(?:[.,]\d+)?(?:\s*[·×x*]\s*10\s*\^?\s*[+−-]?\d+)?\s*(.*)$/u.exec(fractionless);
  if (!m) return false;
  const rest = m[1]!;
  if (rest !== "" && !/^[\p{L}°%µΩ][\p{L}°%µΩ/²³⁻^·\-\d\s.]*$/u.test(rest)) return false;
  if (eq < 0) return true;
  const firstLeft = text.slice(0, text.indexOf("=")).trim();
  if (/^[\p{L}](?:_?[\p{L}\d]{0,3})?(?:\([^)]{0,12}\))?$/u.test(firstLeft)) return true;
  const left = text.slice(0, eq).trim();
  if (left === "") return true;
  if (/^[\p{L}](?:_?[\p{L}\d]{0,3})?(?:\([^)]{0,12}\))?$/u.test(left)) return true;
  return !taskHasSymbols;
}

export type AnswerVerdict = "correct" | "wrong" | "maybe" | "unit" | "none";

const UNIT_WORDS: [RegExp, string][] = [
  [/newton(?:ů|u|y)?/g, "n"], [/ohm(?:ů|u|y)?/g, "Ω"], [/korun(?:a|y)?|\bkc\b/g, "kč"], [/procent(?:o|a|ech)?/g, "%"], [/mol(?:ů|u|y)?(?![/a-z])/g, "mol"],
  [/joul(?:ů|u|y|e)?/g, "j"], [/kilometr(?:ů|u|y)?/g, "km"], [/kilopascal(?:ů|u|y)?/g, "kpa"], [/g\.?cm\^?-3/g, "g/cm3"], [/watt(?:ů|u|y)?/g, "w"], [/volt(?:ů|u|y)?/g, "v"], [/ampér(?:ů|u|y)?/g, "a"], [/kilogram(?:ů|u|y)?/g, "kg"], [/gram(?:ů|u|y)?/g, "g"],
  [/metr(?:ů|u|y)?/g, "m"], [/sekund(?:a|y|)?/g, "s"], [/hodin(?:a|y)?/g, "h"], [/pascal(?:ů|u|y)?/g, "pa"], [/litr(?:ů|u|y)?/g, "l"],
];
const BASE_UNITS = new Set(["m", "km", "cm", "mm", "mol", "kg", "g", "n", "j", "w", "v", "a", "l", "s", "h", "pa", "kč"]);
export function normalizeUnit(unit: string): string {
  if (unit.trim() === "M") return "mol/l";
  let u = unit.toLowerCase().trim().replace(/[.,;]+$/, "");
  u = u.replace(/⁻/g, "-").replace(/³/g, "3").replace(/[\s·]/g, "");
  for (const [pattern, replacement] of UNIT_WORDS) u = u.replace(pattern, replacement);
  u = u.replace(/[\s·.]/g, "").replace(/π/g, "").replace(/²/g, "2").replace(/³/g, "3").replace(/ω/g, "Ω").replace(/dm3/g, "l").replace(/dm-3/g, "/l");
  const inverse = /^([a-zµΩ]+)\^?-1$/.exec(u);
  if (inverse) {
    const body = inverse[1]!;
    for (let k = body.length - 1; k >= 1; k--) {
      if (BASE_UNITS.has(body.slice(0, k)) && BASE_UNITS.has(body.slice(k))) { u = `${body.slice(0, k)}/${body.slice(k)}`; break; }
    }
  }
  return u.replace(/\^/g, "");
}

/** The unit the student wrote after the number, or "" (also "" when the trailing text is not a unit at all). */
export function unitFromLine(line: string): string {
  if (line.length > MAX_INPUT_LENGTH) return "";
  const text = line.trim().replace(ANSWER_WORDS, "");
  const tail = (text.includes("=") ? text.slice(text.lastIndexOf("=") + 1) : text).trim();
  const sci = SCIENTIFIC.exec(tail);
  const prefix = sci ? sci[0] : /^[\d\s.,+\-−*×·/^()%]+/.exec(tail)?.[0] ?? "";
  const rest = tail.slice(prefix.replace(/%\s*$/, "").length).trim();
  return /^[\p{L}°%µΩπ][\p{L}°%µΩπ/²³⁻^·\-\d\s.]{0,14}$/u.test(rest) ? rest : "";
}

export function checkAnswerLine(expected: ExpectedAnswer, line: string): AnswerVerdict {
  const given = answerFromLine(line);
  if (given === null) return "none";
  const unit = unitFromLine(line);
  const isChain = (line.match(/=/g) ?? []).length >= 2;
  const isGiven = !isChain && Array.isArray(expected.givens) && expected.givens.some(g => Math.abs(g - given) <= 1e-9 * Math.max(1, Math.abs(g)));
  const tail = line.slice(line.lastIndexOf("=") + 1).trim().replace(ANSWER_WORDS, "");
  const numericText = unit ? tail.slice(0, tail.length - unit.length).trim() : tail;
  const valueMatches = numberMatches(expected.value, given, numericText, expected.fractionRounding);
  const written = normalizeUnit(unit);
  const sameUnit = !written || !expected.unit || written === normalizeUnit(expected.unit);
  if (!valueMatches) {
    if (!expected.wordProblem) return "wrong";
    const numericEquality = /^[\d.,\s+\-−*/()·×÷^]+=/.test(line);
    return !isGiven && ((!written && !numericEquality) || (!!written && !!expected.unit && sameUnit)) ? "maybe" : "none";
  }
  if (!sameUnit) return isGiven ? "none" : "unit";
  // The answer is a multiple of pi: a bare number that is also in the statement is the given radius or diameter, not the result.
  if (isGiven && expected.unit?.includes("π") && !line.includes("π")) return "none";
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
