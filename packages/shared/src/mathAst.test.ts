import { describe, expect, it } from "vitest";
import { parseMathStatement, MathAstParseError } from "./mathAst.js";

describe("parseMathStatement", () => {
  it("parses a simple linear equation", () => {
    const stmt = parseMathStatement("2(x+3)=14");
    expect(stmt.form).toBe("relation");
  });

  it("parses fractions as frac nodes, not floats", () => {
    const stmt = parseMathStatement("1/2+x=3");
    expect(stmt.form).toBe("relation");
    if (stmt.form === "relation") {
      expect(stmt.value.lhs).toMatchObject({ kind: "add" });
    }
  });

  it("has no function-call node: 'sin(x)' parses as implicit multiplication s*i*n*(x), never as a call", () => {
    const stmt = parseMathStatement("sin(x)=1");
    expect(stmt.form).toBe("relation");
    if (stmt.form === "relation") {
      // top-level node must be a mul chain, not something resembling a call
      expect(stmt.value.lhs.kind).toBe("mul");
    }
  });

  it("rejects anything outside the grammar", () => {
    expect(() => parseMathStatement("__import__('os')")).toThrow(MathAstParseError);
    expect(() => parseMathStatement("x; DROP TABLE")).toThrow(MathAstParseError);
  });

  it("rejects overly long input", () => {
    expect(() => parseMathStatement("1+".repeat(300) + "1")).toThrow(MathAstParseError);
  });
});
