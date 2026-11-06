import { describe, expect, it } from "vitest";
import { CalcError, calcEvaluate, formatCalcResult } from "./calc.js";

describe("calcEvaluate", () => {
  it("respects precedence, parentheses and unary minus", () => {
    expect(calcEvaluate("2+3*4")).toBe(14);
    expect(calcEvaluate("(2+3)*4")).toBe(20);
    expect(calcEvaluate("-2^2")).toBe(-4);
    expect(calcEvaluate("2^3^2")).toBe(512);
    expect(calcEvaluate("-(3-5)")).toBe(2);
  });
  it("handles decimals with point or comma, percent, π and implicit multiplication", () => {
    expect(calcEvaluate("1,5+2.5")).toBe(4);
    expect(calcEvaluate("50%*80")).toBe(40);
    expect(calcEvaluate("2(3+4)")).toBe(14);
    expect(calcEvaluate("2π")).toBeCloseTo(6.2832, 4);
    expect(calcEvaluate("6×7÷2")).toBe(21);
  });
  it("rejects bad input instead of guessing or running anything", () => {
    for (const bad of ["", "2+", "(1+2", "1/0", "abc", "2**3", "__import__('os')", "1;2", "alert(1)"]) {
      expect(() => calcEvaluate(bad), bad).toThrow(CalcError);
    }
    expect(() => calcEvaluate("(".repeat(100) + "1" + ")".repeat(100))).toThrow(CalcError);
    expect(() => calcEvaluate("1+".repeat(200) + "1")).toThrow(CalcError);
  });
});

describe("formatCalcResult", () => {
  it("trims float noise and localizes the separator", () => {
    expect(formatCalcResult(0.1 + 0.2, "en")).toBe("0.3");
    expect(formatCalcResult(1 / 3, "cs")).toBe("0,3333333333");
    expect(formatCalcResult(-0, "en")).toBe("0");
  });
});
