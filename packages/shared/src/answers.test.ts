import { describe, expect, it } from "vitest";
import { answerFromLine, checkAnswerLine, expectedAnswerFor, formatExpected, instantiateProblem, looksLikeFinalLine } from "./answers.js";
import type { ProblemTemplate } from "./curriculum.js";

describe("expectedAnswerFor", () => {
  it("evaluates expressions and solves linear equations, nothing else", () => {
    expect(expectedAnswerFor("-6+-8")?.value).toBe(-14);
    expect(expectedAnswerFor("2x+3=7")?.value).toBe(2);
    expect(expectedAnswerFor("3(x-1)=12")?.value).toBe(5);
    expect(expectedAnswerFor("x^2=4")).toBeUndefined();
    expect(expectedAnswerFor("Řeš soustavu")).toBeUndefined();
  });
});

describe("answer lines", () => {
  it("reads the number after the last equals sign, with decimals, units and powers of ten", () => {
    expect(answerFromLine("v = 15 m/s")).toBe(15);
    expect(answerFromLine("x = -3,5")).toBe(-3.5);
    expect(answerFromLine("n = 2,5·10^-3 mol")).toBeCloseTo(0.0025, 10);
    expect(answerFromLine("p = 2/5")).toBeCloseTo(0.4, 10);
    expect(answerFromLine("v = 120/8 = 15 m/s")).toBe(15);
    expect(answerFromLine("hello")).toBeNull();
  });
  it("tells final results from intermediate steps", () => {
    expect(looksLikeFinalLine("x = 3", true)).toBe(true);
    expect(looksLikeFinalLine("2x = 4", true)).toBe(false);
    expect(looksLikeFinalLine("-6+-8 = -14", false)).toBe(true);
    expect(looksLikeFinalLine("v = 120/8", true)).toBe(false);
    expect(looksLikeFinalLine("15 m/s", true)).toBe(true);
    expect(looksLikeFinalLine("3+4", false)).toBe(false);
  });
  it("compares with the tolerance of the expected answer", () => {
    const exact = { value: -14, tolerance: 1e-9 };
    expect(checkAnswerLine(exact, "-6+-8 = -14")).toBe("correct");
    expect(checkAnswerLine(exact, "= -13")).toBe("wrong");
    expect(checkAnswerLine(exact, "bla")).toBe("none");
    expect(checkAnswerLine({ value: 15, unit: "m/s", tolerance: 0.01 }, "v = 15,1 m/s")).toBe("correct");
    expect(checkAnswerLine({ value: 15, tolerance: 0.01 }, "v = 16")).toBe("wrong");
  });
  it("formats the expected answer with the locale separator and unit", () => {
    expect(formatExpected({ value: 12.5, unit: "m/s", tolerance: 0.01 }, "cs")).toBe("12,5 m/s");
  });
});

describe("instantiateProblem", () => {
  const velocity: ProblemTemplate = { id: "v", skillId: "s", difficultyLevel: 1, topic: "t", freeText: true,
    statementTemplate: "Auto ujede {a} m za {b} s. Urči rychlost.", generatorRanges: { a: [120, 120], b: [8, 8] }, answerTemplate: "{a}/{b}", answerUnit: "m/s" };
  it("computes the expected answer from answerTemplate", () => {
    const problem = instantiateProblem(velocity, () => 0);
    expect(problem.statement).toBe("Auto ujede 120 m za 8 s. Urči rychlost.");
    expect(problem.expected).toEqual({ value: 15, unit: "m/s", tolerance: 0.01 });
  });
  it("derives the answer for plain arithmetic templates and gives none for free text without a formula", () => {
    const arithmetic: ProblemTemplate = { id: "a", skillId: "s", difficultyLevel: 1, topic: "t", statementTemplate: "{a}+{b}", generatorRanges: { a: [2, 2], b: [3, 3] } };
    expect(instantiateProblem(arithmetic, () => 0).expected?.value).toBe(5);
    expect(instantiateProblem({ ...velocity, answerTemplate: undefined }).expected).toBeUndefined();
  });
});
