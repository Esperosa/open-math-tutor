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

/** Instantiates a template (random values) and computes its expected answer, if one can be computed. */
export function instantiateProblem(template: ProblemTemplate, random: () => number = Math.random): InstantiatedProblem {
  const values: Record<string, number> = {};
  let statement = template.statementTemplate;
  for (const [name, [min, max]] of Object.entries(template.generatorRanges ?? {})) {
    const value = min + Math.floor(random() * (max - min + 1));
    values[name] = value;
    statement = statement.split(`{${name}}`).join(String(value));
  }
  if (template.answerTemplate) {
    let formula = template.answerTemplate;
    for (const [name, value] of Object.entries(values)) formula = formula.split(`{${name}}`).join(value < 0 ? `(${value})` : String(value));
    try {
      const value = calcEvaluate(formula);
      return { statement, expected: { value, ...(template.answerUnit ? { unit: template.answerUnit } : {}), tolerance: 0.01 } };
    } catch (e) { if (!(e instanceof CalcError)) throw e; }
  }
  if (template.freeText) return { statement };
  const expected = expectedAnswerFor(statement);
  return expected ? { statement, expected } : { statement };
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
export function answerFromLine(line: string): number | null {
  const text = line.trim();
  if (!text) return null;
  const tail = (text.includes("=") ? text.slice(text.lastIndexOf("=") + 1) : text).trim();
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
  const text = line.trim();
  if (!text) return false;
  const eq = text.lastIndexOf("=");
  const tail = (eq >= 0 ? text.slice(eq + 1) : text).trim();
  const m = /^[-−]?\d+(?:[.,]\d+)?(?:\s*[·×x*]\s*10\s*\^?\s*[-−]?\d+)?\s*(.*)$/u.exec(tail);
  if (!m) return false;
  const rest = m[1]!;
  if (rest !== "" && !/^[\p{L}°%µΩ][\p{L}°%µΩ/²³^·\-\d\s.]*$/u.test(rest)) return false;
  if (eq < 0) return true;
  const left = text.slice(0, eq).trim();
  if (left === "") return true;
  if (/^[\p{L}](?:_?[\p{L}\d]{0,3})?(?:\([^)]{0,12}\))?$/u.test(left)) return true;
  return !taskHasSymbols;
}

export type AnswerVerdict = "correct" | "wrong" | "none";

export function checkAnswerLine(expected: ExpectedAnswer, line: string): AnswerVerdict {
  const given = answerFromLine(line);
  if (given === null) return "none";
  const scale = Math.max(Math.abs(expected.value), 1e-12);
  return Math.abs(given - expected.value) <= expected.tolerance * scale + 1e-12 ? "correct" : "wrong";
}

export function formatExpected(expected: ExpectedAnswer, locale: "cs" | "en"): string {
  const rounded = Number(expected.value.toPrecision(6));
  const text = String(rounded);
  return `${locale === "cs" ? text.replace(".", ",") : text}${expected.unit ? ` ${expected.unit}` : ""}`;
}
