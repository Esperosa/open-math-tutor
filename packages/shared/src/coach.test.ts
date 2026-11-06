import { describe, expect, it } from "vitest";
import { coachLine, nextCoachEvent, stepKey, type CoachInput } from "./coach.js";
import { chooseStyle, emptyProfile, profileSummary, recordError, recordSolved, recordStyleShown, resolveStyleOutcome } from "./learnerProfile.js";

const step = (id: string, text: string) => ({ stepId: id, latexGuess: text });
const base = (over: Partial<CoachInput>): CoachInput => ({ mode: "live", statement: "5+1", steps: [], handled: new Set(), ...over });

describe("nextCoachEvent", () => {
  it("is idle when off or when everything is handled", () => {
    expect(nextCoachEvent(base({ mode: "off", steps: [step("a", "5+1=8")] })).kind).toBe("idle");
    const s = step("a", "5+1=8");
    expect(nextCoachEvent(base({ steps: [s], handled: new Set([stepKey(s)]) })).kind).toBe("idle");
  });
  it("live mode reacts to a wrong line at once (5+1=8)", () => {
    expect(nextCoachEvent(base({ steps: [step("a", "5+1=8")] }))).toMatchObject({ kind: "wrong_step", reason: "arithmetic", n: 1 });
  });
  it("recognizes a solved task and a wrong final result", () => {
    const expected = { value: 6, tolerance: 1e-9 };
    expect(nextCoachEvent(base({ steps: [step("a", "5+1=6")], expected })).kind).toBe("solved");
    expect(nextCoachEvent(base({ statement: "2x+3=7", steps: [step("a", "x=3")], expected: { value: 2, tolerance: 1e-9 } })).kind).toBe("wrong_step");
    expect(nextCoachEvent(base({ statement: "2x+3=7", steps: [step("a", "2x=4"), step("b", "x=2")], expected: { value: 2, tolerance: 1e-9 }, handled: new Set([stepKey(step("a", "2x=4"))]) })).kind).toBe("solved");
  });
  it("final mode waits for a result and then names the first wrong line", () => {
    const steps = [step("a", "2x=5"), step("b", "x=2")];
    const expected = { value: 2, tolerance: 1e-9 };
    expect(nextCoachEvent(base({ mode: "final", statement: "2x+3=7", steps: [step("a", "2x=5")], expected }))).toEqual({ kind: "idle" });
    expect(nextCoachEvent(base({ mode: "final", statement: "2x+3=7", steps, expected }))).toMatchObject({ kind: "wrong_step", n: 1 });
  });
  it("is honest about lines it cannot check", () => {
    expect(nextCoachEvent(base({ statement: "Urči obsah kruhu", steps: [step("a", "S = pi r^2")] })).kind).toBe("unclear");
  });
});

describe("coachLine", () => {
  it("is warm, brief and localized, and varies by variant", () => {
    const event = { kind: "wrong_step", key: "k", n: 2, reason: "not_equivalent" } as const;
    expect(coachLine(event, "cs", 2)).toContain("Řádek 2");
    expect(coachLine(event, "en", 0)).toMatch(/step/);
    expect(coachLine({ kind: "idle" }, "cs")).toBe("");
  });
});

describe("learner profile", () => {
  it("learns which explanation style works and prefers it, still sampling others early", () => {
    let p = emptyProfile();
    for (let i = 0; i < 6; i++) { p = recordStyleShown(p, "worked", `k${i}`); p = resolveStyleOutcome(p, true); }
    for (let i = 0; i < 6; i++) { p = recordStyleShown(p, "hint", `h${i}`); p = resolveStyleOutcome(p, false); }
    expect(chooseStyle(p, () => 0)).not.toBe("hint");
    expect(["worked", "analogy", "visual"]).toContain(chooseStyle(p, () => 0));
    expect(chooseStyle(emptyProfile(), () => 0, "hint")).not.toBe("hint");
  });
  it("records errors and solved problems per day and summarizes them for the AI", () => {
    let p = recordError(emptyProfile(), "fractions-basic", "arithmetic", Date.UTC(2026, 10, 6));
    p = recordError(p, "fractions-basic", "arithmetic", Date.UTC(2026, 10, 6));
    p = recordSolved(p, Date.UTC(2026, 10, 6));
    expect(p.skillErrors["fractions-basic"]?.arithmetic).toBe(2);
    expect(p.days["2026-11-06"]).toEqual({ solved: 1, wrong: 2 });
    for (let i = 0; i < 3; i++) { p = recordStyleShown(p, "analogy", `k${i}`); p = resolveStyleOutcome(p, i < 2); }
    const text = profileSummary(p, "cs", "analogy");
    expect(text).toContain("arithmetic (2x)");
    expect(text).toContain("příměr");
    expect(text.length).toBeLessThanOrEqual(700);
  });
});
