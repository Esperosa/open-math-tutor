import { describe, expect, it } from "vitest";
import { parseMathStatement } from "./mathAst.js";
import { evaluateMathAst, sampleFunction, MathEvalError } from "./mathEval.js";

function expr(text: string) {
  const stmt = parseMathStatement(text);
  if (stmt.form !== "expression") throw new Error("expected expression");
  return stmt.value;
}

describe("evaluateMathAst", () => {
  it("evaluates a linear expression at a bound variable", () => {
    expect(evaluateMathAst(expr("2x+3"), { x: 5 })).toBe(13);
  });

  it("evaluates fractions exactly", () => {
    expect(evaluateMathAst(expr("1/2x"), { x: 4 })).toBe(2);
  });

  it("throws on division by zero rather than returning Infinity silently", () => {
    expect(() => evaluateMathAst(expr("1/x"), { x: 0 })).toThrow(MathEvalError);
  });

  it("throws on an unbound symbol", () => {
    expect(() => evaluateMathAst(expr("x+y"), { x: 1 })).toThrow(MathEvalError);
  });
});

describe("sampleFunction", () => {
  it("samples a linear function across the domain", () => {
    const points = sampleFunction(expr("2x"), "x", { min: 0, max: 10 }, 11);
    expect(points).toHaveLength(11);
    expect(points[0]).toEqual({ x: 0, y: 0 });
    expect(points[10]).toEqual({ x: 10, y: 20 });
  });

  it("reports a gap (y: null) instead of throwing at a pole", () => {
    const points = sampleFunction(expr("1/x"), "x", { min: -1, max: 1 }, 5);
    const mid = points.find(p => Math.abs(p.x) < 1e-9);
    expect(mid?.y).toBeNull();
  });

  it("rejects an invalid domain", () => {
    expect(() => sampleFunction(expr("x"), "x", { min: 5, max: 1 })).toThrow(MathEvalError);
  });
});
