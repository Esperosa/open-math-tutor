/**
 * Pure numeric evaluator over the allowlisted MathAstNode tree (mathAst.ts).
 * Used only to sample points for plotting a parsed, already-validated
 * expression — never to evaluate untrusted text directly (parse first with
 * parseMathStatement, which enforces the grammar/size limits; this module
 * only walks the resulting tree). No eval/Function/new Function anywhere.
 */

import type { MathAstNode } from "./mathAst.js";

export class MathEvalError extends Error {}

/** Evaluates `node` with every `symbol` bound from `bindings` (by name). */
export function evaluateMathAst(node: MathAstNode, bindings: Readonly<Record<string, number>>): number {
  switch (node.kind) {
    case "num":
      return node.value;
    case "frac":
      if (node.denominator === 0) throw new MathEvalError("division by zero");
      return node.numerator / node.denominator;
    case "symbol": {
      const value = bindings[node.name];
      if (value === undefined) throw new MathEvalError(`unbound symbol ${node.name}`);
      return value;
    }
    case "neg":
      return -evaluateMathAst(node.operand, bindings);
    case "paren":
      return evaluateMathAst(node.inner, bindings);
    case "add":
      return evaluateMathAst(node.left, bindings) + evaluateMathAst(node.right, bindings);
    case "sub":
      return evaluateMathAst(node.left, bindings) - evaluateMathAst(node.right, bindings);
    case "mul":
      return evaluateMathAst(node.left, bindings) * evaluateMathAst(node.right, bindings);
    case "div": {
      const divisor = evaluateMathAst(node.right, bindings);
      if (divisor === 0) throw new MathEvalError("division by zero");
      return evaluateMathAst(node.left, bindings) / divisor;
    }
    case "pow":
      return Math.pow(evaluateMathAst(node.base, bindings), evaluateMathAst(node.exponent, bindings));
  }
}

export interface PlotPoint {
  x: number;
  y: number | null;
}

/**
 * Samples `node` over [domain.min, domain.max] with `steps` evenly spaced
 * points, binding `variable` to each x. Points where evaluation throws
 * (division by zero, domain errors) are reported as y: null so the caller
 * can render a gap instead of a false/zero value.
 */
export function sampleFunction(
  node: MathAstNode,
  variable: string,
  domain: { min: number; max: number },
  steps = 200,
): PlotPoint[] {
  if (!(domain.max > domain.min)) throw new MathEvalError("invalid domain");
  if (steps < 2 || steps > 5000) throw new MathEvalError("invalid sample count");
  const points: PlotPoint[] = [];
  const step = (domain.max - domain.min) / (steps - 1);
  for (let i = 0; i < steps; i++) {
    const x = domain.min + i * step;
    try {
      const y = evaluateMathAst(node, { [variable]: x });
      points.push({ x, y: Number.isFinite(y) ? y : null });
    } catch {
      points.push({ x, y: null });
    }
  }
  return points;
}
