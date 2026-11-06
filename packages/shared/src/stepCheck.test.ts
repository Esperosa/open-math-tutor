import { describe, expect, it } from "vitest";
import { checkStep, checkSteps } from "./stepCheck.js";

describe("checkStep", () => {
  it("flags a false numeric equation (5+1=8)", () => {
    expect(checkStep("5+1=8", null)).toEqual({ status: "wrong", reason: "arithmetic" });
  });
  it("accepts a true numeric equation", () => {
    expect(checkStep("5+1=6", null).status).toBe("ok");
    expect(checkStep("-6+-8=-14", "-6+-8").status).toBe("ok");
  });
  it("flags a true equation whose value differs from the task expression", () => {
    expect(checkStep("2+2=4", "-6+-8")).toEqual({ status: "wrong", reason: "wrong_value" });
  });
  it("accepts equivalent linear equations and flags non-equivalent ones", () => {
    expect(checkStep("2x = 4", "2x+3=7").status).toBe("ok");
    expect(checkStep("x = 2", "2x+3=7").status).toBe("ok");
    expect(checkStep("x = 3", "2x+3=7")).toEqual({ status: "wrong", reason: "not_equivalent" });
    expect(checkStep("2x+3=14", "2(x+3)=14")).toEqual({ status: "wrong", reason: "not_equivalent" });
  });
  it("never reports ok for things it cannot decide", () => {
    expect(checkStep("hello", null).status).toBe("unknown");
    expect(checkStep("x^2 = 4", "x = 2").status).toBe("unknown");
    expect(checkStep("x = 2", null).status).toBe("unknown");
    expect(checkStep("1/0 = 1", null).status).toBe("unknown");
  });
});

describe("checkSteps", () => {
  it("compares each step with the previous one and the first with the task", () => {
    const verdicts = checkSteps("2x+3=7", [
      { stepId: "a", latexGuess: "2x=4" }, { stepId: "b", latexGuess: "x=3" }, { stepId: "c", latexGuess: "" },
    ]);
    expect(verdicts.a?.status).toBe("ok");
    expect(verdicts.b?.status).toBe("wrong");
    expect(verdicts.c?.status).toBe("unknown");
  });
});
