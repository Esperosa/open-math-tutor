/**
 * Allowlisted math AST. This is the ONLY representation that may cross the
 * boundary into the Python verifier (verifier/). It is built node-by-node by
 * a small recursive-descent parser (see parseMathAst below) from a
 * constrained grammar — never from `eval`, `exec`, `sympy.sympify`, or
 * `sympy.parse_expr` on a raw string. The Python side must construct SymPy
 * objects by walking this tree and switching on `kind`, never by re-parsing
 * a string.
 *
 * Grammar (single-letter symbols only, ASCII digits, standard precedence):
 *
 *   equation   := expr ( '=' | '<' | '<=' | '>' | '>=' ) expr
 *   expr       := term (('+' | '-') term)*
 *   term       := factor (('*' | '/') factor)*
 *   factor     := unary ('^' unary)?
 *   unary      := '-' unary | primary
 *   primary    := number | symbol | '(' expr ')'
 *   number     := integer | integer '/' integer   (fraction literal)
 *   symbol     := /[a-zA-Z]/   (single letter; no multi-char identifiers)
 */

export type MathAstNode =
  | { kind: "num"; value: number }
  | { kind: "frac"; numerator: number; denominator: number }
  | { kind: "symbol"; name: string }
  | { kind: "neg"; operand: MathAstNode }
  | { kind: "add"; left: MathAstNode; right: MathAstNode }
  | { kind: "sub"; left: MathAstNode; right: MathAstNode }
  | { kind: "mul"; left: MathAstNode; right: MathAstNode }
  | { kind: "div"; left: MathAstNode; right: MathAstNode }
  | { kind: "pow"; base: MathAstNode; exponent: MathAstNode }
  | { kind: "paren"; inner: MathAstNode };

export type RelOp = "eq" | "lt" | "le" | "gt" | "ge";

export interface MathRelation {
  op: RelOp;
  lhs: MathAstNode;
  rhs: MathAstNode;
}

/** A parsed step is either a bare expression or a relation (equation/inequality). */
export type MathStatement =
  | { form: "expression"; value: MathAstNode }
  | { form: "relation"; value: MathRelation };

export const ALLOWED_SYMBOL_PATTERN = /^[a-zA-Z]$/;
export const MAX_AST_NODES = 200;
export const MAX_SYMBOLS = 6;
export const MAX_INPUT_LENGTH = 400;

export class MathAstParseError extends Error {
  constructor(message: string, readonly position: number) {
    super(message);
    this.name = "MathAstParseError";
  }
}

/**
 * Parses a constrained plain-text math expression (NOT LaTeX — the caller
 * normalizes recognized LaTeX into this plain grammar first, see
 * normalizeLatexToPlainMath in latexBridge.ts) into the allowlisted AST.
 * Throws MathAstParseError on anything outside the grammar. Enforces
 * MAX_INPUT_LENGTH / MAX_AST_NODES / MAX_SYMBOLS so a verification request
 * cannot blow up parse time or downstream SymPy work.
 */
export function parseMathStatement(input: string): MathStatement {
  if (input.length === 0) {
    throw new MathAstParseError("empty input", 0);
  }
  if (input.length > MAX_INPUT_LENGTH) {
    throw new MathAstParseError("input too long", MAX_INPUT_LENGTH);
  }

  const tokens = tokenize(input);
  const parser = new Parser(tokens, input);
  const statement = parser.parseStatement();
  parser.expectEnd();

  const nodeCount = countNodes(
    statement.form === "expression" ? statement.value : statement.value.lhs,
  ) + (statement.form === "relation" ? countNodes(statement.value.rhs) : 0);
  if (nodeCount > MAX_AST_NODES) {
    throw new MathAstParseError("expression too complex", input.length);
  }
  const symbols = new Set<string>();
  collectSymbols(statement.form === "expression" ? statement.value : statement.value.lhs, symbols);
  if (statement.form === "relation") collectSymbols(statement.value.rhs, symbols);
  if (symbols.size > MAX_SYMBOLS) {
    throw new MathAstParseError("too many distinct symbols", input.length);
  }

  return statement;
}

function countNodes(node: MathAstNode): number {
  switch (node.kind) {
    case "num":
    case "frac":
    case "symbol":
      return 1;
    case "neg":
      return 1 + countNodes(node.operand);
    case "paren":
      return 1 + countNodes(node.inner);
    case "add":
    case "sub":
    case "mul":
    case "div":
      return 1 + countNodes(node.left) + countNodes(node.right);
    case "pow":
      return 1 + countNodes(node.base) + countNodes(node.exponent);
  }
}

function collectSymbols(node: MathAstNode, out: Set<string>): void {
  switch (node.kind) {
    case "symbol":
      out.add(node.name);
      return;
    case "num":
    case "frac":
      return;
    case "neg":
      collectSymbols(node.operand, out);
      return;
    case "paren":
      collectSymbols(node.inner, out);
      return;
    case "add":
    case "sub":
    case "mul":
    case "div":
      collectSymbols(node.left, out);
      collectSymbols(node.right, out);
      return;
    case "pow":
      collectSymbols(node.base, out);
      collectSymbols(node.exponent, out);
      return;
  }
}

type Token =
  | { type: "num"; value: number; pos: number }
  | { type: "sym"; name: string; pos: number }
  | { type: "op"; value: "+" | "-" | "*" | "/" | "^" | "(" | ")" | "=" | "<" | "<=" | ">" | ">="; pos: number };

function tokenize(input: string): Token[] {
  const tokens: Token[] = [];
  let i = 0;
  while (i < input.length) {
    const c = input.charAt(i);
    if (c === " " || c === "\t" || c === "\n") {
      i++;
      continue;
    }
    if (c >= "0" && c <= "9") {
      let j = i;
      while (j < input.length && input.charAt(j) >= "0" && input.charAt(j) <= "9") j++;
      tokens.push({ type: "num", value: Number(input.slice(i, j)), pos: i });
      i = j;
      continue;
    }
    if (ALLOWED_SYMBOL_PATTERN.test(c)) {
      tokens.push({ type: "sym", name: c, pos: i });
      i++;
      continue;
    }
    if (c === "<" || c === ">") {
      if (input.charAt(i + 1) === "=") {
        tokens.push({ type: "op", value: (c + "=") as "<=" | ">=", pos: i });
        i += 2;
      } else {
        tokens.push({ type: "op", value: c, pos: i });
        i++;
      }
      continue;
    }
    if ("+-*/^()=".includes(c)) {
      tokens.push({ type: "op", value: c as "+" | "-" | "*" | "/" | "^" | "(" | ")" | "=", pos: i });
      i++;
      continue;
    }
    throw new MathAstParseError(`unexpected character ${JSON.stringify(c)}`, i);
  }
  return tokens;
}

class Parser {
  private index = 0;
  constructor(private readonly tokens: Token[], private readonly source: string) {}

  private peek(): Token | undefined {
    return this.tokens[this.index];
  }

  private next(): Token {
    const t = this.tokens[this.index];
    if (!t) throw new MathAstParseError("unexpected end of input", this.source.length);
    this.index++;
    return t;
  }

  expectEnd(): void {
    if (this.index !== this.tokens.length) {
      const t = this.tokens[this.index];
      throw new MathAstParseError("unexpected trailing input", t ? t.pos : this.source.length);
    }
  }

  parseStatement(): MathStatement {
    const lhs = this.parseExpr();
    const t = this.peek();
    const relOp = this.relOpFor(t);
    if (t && relOp) {
      this.next();
      const rhs = this.parseExpr();
      return { form: "relation", value: { op: relOp, lhs, rhs } };
    }
    return { form: "expression", value: lhs };
  }

  private relOpFor(t: Token | undefined): RelOp | null {
    if (!t || t.type !== "op") return null;
    switch (t.value) {
      case "=":
        return "eq";
      case "<":
        return "lt";
      case "<=":
        return "le";
      case ">":
        return "gt";
      case ">=":
        return "ge";
      default:
        return null;
    }
  }

  private parseExpr(): MathAstNode {
    let node = this.parseTerm();
    for (;;) {
      const t = this.peek();
      if (t && t.type === "op" && (t.value === "+" || t.value === "-")) {
        this.next();
        const right = this.parseTerm();
        node = { kind: t.value === "+" ? "add" : "sub", left: node, right };
      } else {
        break;
      }
    }
    return node;
  }

  private parseTerm(): MathAstNode {
    let node = this.parseFactor();
    for (;;) {
      const t = this.peek();
      if (t && t.type === "op" && (t.value === "*" || t.value === "/")) {
        this.next();
        const right = this.parseFactor();
        node = { kind: t.value === "*" ? "mul" : "div", left: node, right };
      } else if (this.startsFactor(t)) {
        // Implicit multiplication: "2(x+3)", "2x", "x(x+1)".
        const right = this.parseFactor();
        node = { kind: "mul", left: node, right };
      } else {
        break;
      }
    }
    return node;
  }

  private startsFactor(t: Token | undefined): boolean {
    if (!t) return false;
    if (t.type === "num" || t.type === "sym") return true;
    if (t.type === "op" && t.value === "(") return true;
    return false;
  }

  private parseFactor(): MathAstNode {
    const base = this.parseUnary();
    const t = this.peek();
    if (t && t.type === "op" && t.value === "^") {
      this.next();
      const exponent = this.parseUnary();
      return { kind: "pow", base, exponent };
    }
    return base;
  }

  private parseUnary(): MathAstNode {
    const t = this.peek();
    if (t && t.type === "op" && t.value === "-") {
      this.next();
      return { kind: "neg", operand: this.parseUnary() };
    }
    return this.parsePrimary();
  }

  private parsePrimary(): MathAstNode {
    const t = this.next();
    if (t.type === "num") {
      const after = this.peek();
      if (after && after.type === "op" && after.value === "/" ) {
        const savedIndex = this.index;
        this.next();
        const next = this.peek();
        if (next && next.type === "num") {
          this.next();
          return { kind: "frac", numerator: t.value, denominator: next.value };
        }
        this.index = savedIndex;
      }
      return { kind: "num", value: t.value };
    }
    if (t.type === "sym") {
      return { kind: "symbol", name: t.name };
    }
    if (t.type === "op" && t.value === "(") {
      const inner = this.parseExpr();
      const close = this.next();
      if (!(close.type === "op" && close.value === ")")) {
        throw new MathAstParseError("expected ')'", close.pos);
      }
      return { kind: "paren", inner };
    }
    throw new MathAstParseError("unexpected token", t.pos);
  }
}
