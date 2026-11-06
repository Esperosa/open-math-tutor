/**
 * Calculator evaluator: hand-written recursive descent over a tiny grammar
 * (decimals with "." or ",", + - * / ^, parentheses, unary minus, postfix %,
 * the constant π). Pure function — no eval, no Function, no dynamic code.
 */
export class CalcError extends Error {}

const MAX_LENGTH = 200;
const MAX_DEPTH = 40;

export function calcEvaluate(input: string): number {
  if (input.length > MAX_LENGTH) throw new CalcError("too long");
  const text = input.replace(/\s+/g, "").replace(/×/g, "*").replace(/[÷:]/g, "/").replace(/−/g, "-");
  if (!text) throw new CalcError("empty");
  let pos = 0, depth = 0;
  const peek = () => text[pos];
  function number(): number {
    if (text.startsWith("π", pos)) { pos += 1; return Math.PI; }
    const match = /^\d+(?:[.,]\d+)?/.exec(text.slice(pos));
    if (!match) throw new CalcError(`unexpected ${peek() ?? "end"}`);
    pos += match[0].length;
    return Number(match[0].replace(",", "."));
  }
  function primary(): number {
    if (peek() === "(") {
      if (++depth > MAX_DEPTH) throw new CalcError("too deep");
      pos++;
      const value = expression();
      if (peek() !== ")") throw new CalcError("missing )");
      pos++; depth--;
      return value;
    }
    return number();
  }
  function postfix(): number {
    let value = primary();
    while (peek() === "%") { pos++; value /= 100; }
    return value;
  }
  function power(): number {
    const base = postfix();
    if (peek() === "^") { pos++; return Math.pow(base, unary()); }
    return base;
  }
  function unary(): number {
    if (peek() === "-") { pos++; return -unary(); }
    if (peek() === "+") { pos++; return unary(); }
    return power();
  }
  function term(): number {
    let value = unary();
    for (;;) {
      const op = peek();
      if (op === "*") { pos++; value *= unary(); }
      else if (op === "/") {
        pos++;
        const divisor = unary();
        if (divisor === 0) throw new CalcError("division by zero");
        value /= divisor;
      } else if (op === "(" || op === "π") value *= unary(); // implicit multiplication: 2(3+4), 2π
      else return value;
    }
  }
  function expression(): number {
    let value = term();
    for (;;) {
      const op = peek();
      if (op === "+") { pos++; value += term(); }
      else if (op === "-") { pos++; value -= term(); }
      else return value;
    }
  }
  const result = expression();
  if (pos !== text.length) throw new CalcError(`unexpected ${peek()}`);
  if (!Number.isFinite(result)) throw new CalcError("not finite");
  return result;
}

/** Display form: at most 10 significant digits, no trailing zeros, decimal comma for Czech. */
export function formatCalcResult(value: number, locale: "cs" | "en"): string {
  const rounded = Number(value.toPrecision(10));
  const text = String(Object.is(rounded, -0) ? 0 : rounded);
  return locale === "cs" ? text.replace(".", ",") : text;
}
