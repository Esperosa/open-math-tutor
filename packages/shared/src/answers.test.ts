import { describe, expect, it } from "vitest";
import { prettySigns, unitFromLine, answerFromLine, checkAnswerLine, expectedAnswerFor, formatExpected, instantiateProblem, looksLikeFinalLine } from "./answers.js";
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
    expect(looksLikeFinalLine("v = 120/8", true)).toBe(true); // a plain fraction is a result
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
    expect(problem.expected).toEqual({ value: 15, unit: "m/s", tolerance: 1e-9 });
  });
  it("derives the answer for plain arithmetic templates and gives none for free text without a formula", () => {
    const arithmetic: ProblemTemplate = { id: "a", skillId: "s", difficultyLevel: 1, topic: "t", statementTemplate: "{a}+{b}", generatorRanges: { a: [2, 2], b: [3, 3] } };
    expect(instantiateProblem(arithmetic, () => 0).expected?.value).toBe(5);
    expect(instantiateProblem({ ...velocity, answerTemplate: undefined }).expected).toBeUndefined();
  });
});

describe("audit regressions", () => {
  it("whole-number answers are exact, rounded ones keep a 1 % tolerance", () => {
    const whole = instantiateProblem({ id: "w", skillId: "s", difficultyLevel: 1, topic: "t", freeText: true, statementTemplate: "x", answerTemplate: "3024" }).expected!;
    expect(checkAnswerLine(whole, "3000")).toBe("wrong");
    expect(checkAnswerLine(whole, "3024")).toBe("correct");
    const rounded = instantiateProblem({ id: "r", skillId: "s", difficultyLevel: 1, topic: "t", freeText: true, statementTemplate: "x", answerTemplate: "10/3" }).expected!;
    expect(checkAnswerLine(rounded, "3,33")).toBe("correct");
  });
  it("catches a wrong unit but tolerates a missing one and notation variants", () => {
    const e = { value: 100, unit: "m/s", tolerance: 1e-9 };
    expect(checkAnswerLine(e, "v = 100 km/h")).toBe("unit");
    expect(checkAnswerLine(e, "v = 100 m/s")).toBe("correct");
    expect(checkAnswerLine(e, "v = 100")).toBe("correct");
    expect(checkAnswerLine({ value: 9, unit: "π cm²", tolerance: 1e-9 }, "S = 9π cm2")).toBe("correct");
    expect(unitFromLine("v = 15 m/s")).toBe("m/s");
  });
  it("understands an answer introduced by a word and prints signs the way a person writes them", () => {
    expect(answerFromLine("Odpověď: 66 N")).toBe(66);
    expect(looksLikeFinalLine("Výsledek: 66 N", true)).toBe(true);
    expect(prettySigns("5+-6")).toBe("5-6");
    expect(prettySigns("6--1")).toBe("6+1");
    expect(prettySigns("5*-3")).toBe("5*(-3)");
  });
  it("derived values make division tasks come out even and degenerate equations are re-sampled", () => {
    const t: ProblemTemplate = { id: "d", skillId: "s", difficultyLevel: 1, topic: "t", freeText: true, statementTemplate: "{s} m za {t} s", generatorRanges: { v: [5, 30], t: [2, 12] },
      derived: { s: "{v}*{t}" }, answerTemplate: "{s}/{t}" };
    for (let i = 0; i < 20; i++) {
      const p = instantiateProblem(t);
      const [s, tt] = /(\d+) m za (\d+) s/.exec(p.statement)!.slice(1).map(Number);
      expect(s! % tt!).toBe(0);
      expect(p.expected!.value).toBe(s! / tt!);
    }
    const degenerate: ProblemTemplate = { id: "g", skillId: "s", difficultyLevel: 1, topic: "t", statementTemplate: "{a}x+1={c}x+2", generatorRanges: { a: [1, 3], c: [1, 3] } };
    for (let i = 0; i < 50; i++) expect(instantiateProblem(degenerate).expected).toBeDefined();
  });
  it("formats very large answers as a power of ten", () => {
    expect(formatExpected({ value: 1.204e24, tolerance: 0.01 }, "cs")).toBe("1,204·10^24");
  });
});

describe("audit round 2", () => {
  it("fractions are results, a lone pi is not a different unit, scientific notation variants are read", () => {
    expect(looksLikeFinalLine("P = 5/8", true)).toBe(true);
    expect(looksLikeFinalLine("2x = 10/2", true)).toBe(false);
    expect(checkAnswerLine({ value: 0.625, tolerance: 0.01 }, "P = 5/8")).toBe("correct");
    expect(checkAnswerLine({ value: 36, unit: "π cm²", tolerance: 1e-9 }, "36π")).toBe("correct");
    expect(checkAnswerLine({ value: 36, unit: "π cm²", tolerance: 1e-9 }, "36π cm²")).toBe("correct");
    expect(answerFromLine("5 x 10^3")).toBe(5000);
    expect(answerFromLine("1,806 x 10^24")).toBeCloseTo(1.806e24, -10);
    expect(answerFromLine("2,5e-3")).toBeCloseTo(0.0025, 12);
  });
  it("answers built from floating point arithmetic stay exact when they are whole numbers", () => {
    const t: ProblemTemplate = { id: "f", skillId: "s", difficultyLevel: 1, topic: "t", freeText: true, statementTemplate: "x", answerTemplate: "0.1*600" };
    const e = instantiateProblem(t).expected!;
    expect(e.tolerance).toBe(1e-9);
    expect(checkAnswerLine(e, "60,3")).toBe("wrong");
  });
  it("prints coefficients and zeros the way people write them", () => {
    expect(prettySigns("1x+3=7")).toBe("x+3=7");
    expect(prettySigns("y=1x+2")).toBe("y=x+2");
    expect(prettySigns("2(x-0)=8")).toBe("2x=8");
    expect(prettySigns("21x+1")).toBe("21x+1");
  });
});
