/**
 * Cheap, local, deterministic check of a student's written step. Runs in the
 * browser while the student writes so a wrong line is flagged without waiting
 * for (or paying for) an AI call. Works only on the already-parsed allowlisted
 * AST; anything it cannot decide is reported as "unknown", never as "ok".
 */
import { parseMathStatement, type MathAstNode, type MathStatement } from "./mathAst.js";
import { evaluateMathAst } from "./mathEval.js";

export type StepVerdict = { status: "ok" | "wrong" | "unknown"; reason?: "arithmetic" | "not_equivalent" | "wrong_value" };

const EPS = 1e-9;
const close = (a: number, b: number) => Math.abs(a - b) <= EPS * Math.max(1, Math.abs(a), Math.abs(b));

function symbolsOf(node: MathAstNode, into: Set<string>): Set<string> {
  switch (node.kind) {
    case "symbol": into.add(node.name); break;
    case "neg": symbolsOf(node.operand, into); break;
    case "paren": symbolsOf(node.inner, into); break;
    case "add": case "sub": case "mul": case "div": symbolsOf(node.left, into); symbolsOf(node.right, into); break;
    case "pow": symbolsOf(node.base, into); symbolsOf(node.exponent, into); break;
    default: break;
  }
  return into;
}

function tryParse(text: string): MathStatement | null {
  try { return parseMathStatement(text.trim()); } catch { return null; }
}

function numeric(node: MathAstNode, bindings: Record<string, number> = {}): number | null {
  try {
    const value = evaluateMathAst(node, bindings);
    return Number.isFinite(value) ? value : null;
  } catch { return null; }
}

/** a·x + b for f(x) = lhs - rhs, or null if f is not linear in the single symbol. */
function linearForm(statement: MathStatement): { symbol: string; a: number; b: number } | null {
  if (statement.form !== "relation" || statement.value.op !== "eq") return null;
  const { lhs, rhs } = statement.value;
  const names = symbolsOf(rhs, symbolsOf(lhs, new Set()));
  if (names.size !== 1) return null;
  const symbol = [...names][0]!;
  const f = (x: number) => {
    const l = numeric(lhs, { [symbol]: x }), r = numeric(rhs, { [symbol]: x });
    return l === null || r === null ? null : l - r;
  };
  const f0 = f(0), f1 = f(1), f2 = f(2), f5 = f(5);
  if (f0 === null || f1 === null || f2 === null || f5 === null) return null;
  const a = f1 - f0;
  if (!close(f2, f0 + 2 * a) || !close(f5, f0 + 5 * a)) return null;
  return { symbol, a, b: f0 };
}

/** Does this single line hold on its own (numeric equation) or contradict the task value? */
export function checkStep(stepText: string, previousText: string | null): StepVerdict {
  const step = tryParse(stepText);
  if (!step) return { status: "unknown" };

  if (step.form === "relation" && step.value.op === "eq"
      && symbolsOf(step.value.rhs, symbolsOf(step.value.lhs, new Set())).size === 0) {
    const l = numeric(step.value.lhs), r = numeric(step.value.rhs);
    if (l === null || r === null) return { status: "unknown" };
    if (!close(l, r)) return { status: "wrong", reason: "arithmetic" };
    const prev = previousText ? tryParse(previousText) : null;
    if (prev?.form === "expression") {
      const pv = numeric(prev.value);
      if (pv !== null && !close(pv, l)) return { status: "wrong", reason: "wrong_value" };
    }
    return { status: "ok" };
  }

  const prev = previousText ? tryParse(previousText) : null;
  if (!prev) return { status: "unknown" };
  const now = linearForm(step), before = linearForm(prev);
  if (now && before && now.symbol === before.symbol) {
    const degenerate = (f: { a: number; b: number }) => close(f.a, 0) && close(f.b, 0);
    if (degenerate(now) || degenerate(before)) return { status: "unknown" };
    // Two linear equations a1·x+b1=0 and a2·x+b2=0 have the same solution set iff (a,b) are parallel.
    const cross = before.a * now.b - now.a * before.b;
    return close(cross, 0) ? { status: "ok" } : { status: "wrong", reason: "not_equivalent" };
  }
  return { status: "unknown" };
}

/** Verdicts for every written step; the first step is compared with the task statement. */
export function checkSteps(statement: string, steps: readonly { stepId: string; latexGuess: string }[]): Record<string, StepVerdict> {
  const result: Record<string, StepVerdict> = {};
  let previous: string | null = statement.trim() ? statement : null;
  for (const step of steps) {
    if (!step.latexGuess.trim()) { result[step.stepId] = { status: "unknown" }; continue; }
    result[step.stepId] = checkStep(step.latexGuess, previous);
    previous = step.latexGuess;
  }
  return result;
}
