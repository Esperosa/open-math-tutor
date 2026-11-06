/**
 * Declarative actions the AI tutor may apply to the board. These are the
 * ONLY way a provider response can touch the board — never raw HTML/JS,
 * never arbitrary coordinates without validation. Every action carries the
 * `boardRevision` it was computed against; the frontend must reject (and
 * request a fresh analysis instead of applying) any action whose revision
 * does not match the board's current revision ("Čekám na dokončení zápisu").
 */

import { ALLOWED_SYMBOL_PATTERN, parseMathStatement } from "./mathAst.js";

export type AnnotationEmphasis = "low" | "medium" | "high";

export interface AnnotationStyle {
  color?: string;
  emphasis?: AnnotationEmphasis;
}

export interface Anchor {
  /** Board-space coordinates (same space Excalidraw elements live in). */
  x: number;
  y: number;
  /** Optional: anchor relative to a recognized step, for robustness to pan/zoom re-reads. */
  relativeToStepId?: string;
}

/** Scene geometry belongs to the client, never to the model. offsetEm is a
 * nonnegative gap measured in the target row's writing size. */
export interface Placement {
  relativeToStepId: string;
  symbolIndex?: number;
  side: "right" | "below" | "above" | "left" | "over";
  offsetEm: number;
}
type WritingPosition = { placement: Placement; anchor?: never } | { anchor: Anchor; placement?: never };
type Target = { targetStepId: string; targetSymbolIndex?: number; style?: AnnotationStyle };

interface BoardActionBase {
  id: string;
  boardRevision: number;
}

export type BoardAction =
  | (BoardActionBase & WritingPosition & { type: "write_math"; latex: string; style?: AnnotationStyle })
  | (BoardActionBase & WritingPosition & { type: "write_text"; text: string; style?: AnnotationStyle })
  | (BoardActionBase & { type: "underline" } & Target)
  | (BoardActionBase & { type: "circle" } & Target)
  | (BoardActionBase & { type: "highlight" } & Target)
  | (BoardActionBase & { type: "strike_through" } & Target)
  | (BoardActionBase & { type: "draw_arrow"; from: Anchor | Placement; to: Anchor | Placement; style?: AnnotationStyle })
  | (BoardActionBase & WritingPosition & { type: "show_hint"; text: string })
  | (BoardActionBase & { type: "erase_own_annotation"; targetAnnotationId: string })
  | (BoardActionBase & {
      type: "plot_function";
      /** Plain-grammar expression in one free variable (same grammar as mathAst.ts), e.g. "2x+3" or "1/2x^2" — never LaTeX, never eval'd as code. */
      expression: string;
      variable: string;
      domain: { min: number; max: number };
      anchor: Anchor;
      width: number;
      height: number;
      style?: AnnotationStyle;
    });

export const BOARD_ACTION_TYPES = [
  "write_math",
  "write_text",
  "underline",
  "circle",
  "highlight",
  "strike_through",
  "draw_arrow",
  "show_hint",
  "erase_own_annotation",
  "plot_function",
] as const;

export const MAX_PLOT_EXPRESSION_LENGTH = 200;
export const MAX_PLOT_SIZE = 2000;

export const MAX_BOARD_ACTIONS_PER_RESPONSE = 12;
export const MAX_LATEX_LENGTH = 300;
export const MAX_TEXT_LENGTH = 500;

const record = (v: unknown): v is Record<string, unknown> => typeof v === "object" && v !== null && !Array.isArray(v);
const id = (v: unknown): v is string => typeof v === "string" && v.length > 0 && v.length <= 128 && !/[\u0000-\u001f<>]/.test(v);
const symbolIndex = (v: unknown) => v === undefined || (Number.isSafeInteger(v) && (v as number) >= 0 && (v as number) < 300);
const keys = (v: Record<string, unknown>, allowed: string[]) => Object.keys(v).every(k => allowed.includes(k));
export function isPlacement(v: unknown): v is Placement {
  return record(v) && keys(v, ["relativeToStepId", "symbolIndex", "side", "offsetEm"]) && id(v.relativeToStepId)
    && symbolIndex(v.symbolIndex) && ["right", "below", "above", "left", "over"].includes(v.side as string)
    && typeof v.offsetEm === "number" && Number.isFinite(v.offsetEm) && v.offsetEm >= 0 && v.offsetEm <= 12;
}
export function isSafeBoardText(v: unknown): v is string {
  return typeof v === "string" && !!v.trim() && v.length <= MAX_TEXT_LENGTH
    && !/<[^>]*>|&(?:#\w+|lt|gt);|[\u0000-\u0008\u000b-\u001f\u202a-\u202e\u2066-\u2069]/i.test(v);
}

/** Small, nonexpanding LaTeX subset, then the existing bounded expression
 * parser. No macros, URLs, HTML, environments or executable expressions.
 * The plain result is also suitable for handwriting (fractions use /). */
export function boardMathToPlain(latex: string): string {
  if (!latex.trim() || latex.length > MAX_LATEX_LENGTH) throw new Error("invalid latex");
  let source = latex.replace(/\$(.*?)\$/g, "$1").replace(/\\(?:left|right)\b/g, "")
    .replace(/\\(?:cdot|times)\b/g, "*").replace(/\\div\b/g, "/")
    .replace(/\\leq?\b/g, "<=").replace(/\\geq?\b/g, ">=")
    .replace(/[−–]/g, "-").replace(/[×·]/g, "*").replace(/÷/g, "/").replace(/(\d),(?=\d)/g, "$1.");
  let cursor = 0;
  function group(): string {
    if (source[cursor++] !== "{") throw new Error("expected group");
    const value = read(true);
    if (source[cursor++] !== "}") throw new Error("unclosed group");
    return value;
  }
  function read(nested = false): string {
    let out = "";
    while (cursor < source.length && !(nested && source[cursor] === "}")) {
      if (source.startsWith("\\frac", cursor)) {
        cursor += 5;
        const numerator = group(), denominator = group();
        out += `((${numerator})/(${denominator}))`;
      } else if (source[cursor] === "{") out += `(${group()})`;
      else out += source[cursor++];
    }
    return out;
  }
  source = read();
  parseMathStatement(source);
  return source;
}

export interface BoardActionValidationError {
  index: number;
  reason: string;
}

/**
 * Structural + bounds validation only (schema, counts, lengths, revision
 * consistency, coordinate range). This does NOT validate whether the LaTeX
 * is mathematically correct — that trust boundary is the SymPy verifier,
 * never the raw model output.
 */
export function validateBoardActions(
  actions: unknown,
  expectedBoardRevision: number,
  boardBounds: { minX: number; minY: number; maxX: number; maxY: number },
): { valid: BoardAction[]; errors: BoardActionValidationError[] } {
  const valid: BoardAction[] = [];
  const errors: BoardActionValidationError[] = [];

  if (!Array.isArray(actions)) {
    return { valid, errors: [{ index: -1, reason: "actions is not an array" }] };
  }
  if (actions.length > MAX_BOARD_ACTIONS_PER_RESPONSE) {
    errors.push({ index: -1, reason: `too many actions (${actions.length})` });
    actions = actions.slice(0, MAX_BOARD_ACTIONS_PER_RESPONSE);
  }

  (actions as unknown[]).forEach((raw, index) => {
    const err = validateOne(raw, index, expectedBoardRevision, boardBounds);
    if (err) {
      errors.push(err);
    } else {
      valid.push(raw as BoardAction);
    }
  });

  return { valid, errors };
}

function validateOne(
  raw: unknown,
  index: number,
  expectedBoardRevision: number,
  bounds: { minX: number; minY: number; maxX: number; maxY: number },
): BoardActionValidationError | null {
  if (typeof raw !== "object" || raw === null) return { index, reason: "not an object" };
  const a = raw as Record<string, unknown>;

  if (!id(a.id)) return { index, reason: "missing id" };
  if (!Number.isSafeInteger(a.boardRevision) || (a.boardRevision as number) < 0) return { index, reason: "missing boardRevision" };
  if (a.boardRevision !== expectedBoardRevision) {
    return { index, reason: `stale boardRevision (${a.boardRevision} != ${expectedBoardRevision})` };
  }
  if (typeof a.type !== "string" || !(BOARD_ACTION_TYPES as readonly string[]).includes(a.type)) {
    return { index, reason: "unknown action type" };
  }

  const inBounds = (p: { x: number; y: number }) =>
    p.x >= bounds.minX && p.x <= bounds.maxX && p.y >= bounds.minY && p.y <= bounds.maxY;
  const isAnchor = (v: unknown): v is Anchor => record(v) && keys(v, ["x", "y", "relativeToStepId"])
    && typeof v.x === "number" && Number.isFinite(v.x) && typeof v.y === "number" && Number.isFinite(v.y)
    && (v.relativeToStepId === undefined || id(v.relativeToStepId)) && inBounds(v as unknown as Anchor);
  const position = () => a.placement !== undefined ? a.anchor === undefined && isPlacement(a.placement) : isAnchor(a.anchor);
  const fields: Record<string, string[]> = {
    write_math: ["latex", "placement", "anchor"], write_text: ["text", "placement", "anchor"], show_hint: ["text", "placement", "anchor"],
    underline: ["targetStepId", "targetSymbolIndex"], circle: ["targetStepId", "targetSymbolIndex"],
    highlight: ["targetStepId", "targetSymbolIndex"], strike_through: ["targetStepId", "targetSymbolIndex"],
    draw_arrow: ["from", "to"], erase_own_annotation: ["targetAnnotationId"],
    plot_function: ["expression", "variable", "domain", "anchor", "width", "height"],
  };
  if (!keys(a, ["id", "boardRevision", "type", "style", ...(fields[a.type as string] ?? [])])) return { index, reason: "unknown action field" };
  if (a.style !== undefined && (!record(a.style) || !keys(a.style, ["color", "emphasis"])
    || (a.style.color !== undefined && (typeof a.style.color !== "string" || !/^#[0-9a-f]{6}$/i.test(a.style.color)))
    || (a.style.emphasis !== undefined && !["low", "medium", "high"].includes(a.style.emphasis as string)))) return { index, reason: "invalid style" };

  switch (a.type) {
    case "write_math": {
      if (typeof a.latex !== "string" || a.latex.length === 0 || a.latex.length > MAX_LATEX_LENGTH) {
        return { index, reason: "invalid latex" };
      }
      try { boardMathToPlain(a.latex); } catch { return { index, reason: "unsafe math grammar" }; }
      if (!position()) return { index, reason: "invalid placement or anchor" };
      return null;
    }
    case "write_text":
    case "show_hint": {
      const text = a.text;
      if (!isSafeBoardText(text)) {
        return { index, reason: "invalid text" };
      }
      if (!position()) return { index, reason: "invalid placement or anchor" };
      return null;
    }
    case "underline":
    case "circle":
    case "highlight":
    case "strike_through": {
      if (!id(a.targetStepId) || !symbolIndex(a.targetSymbolIndex)) {
        return { index, reason: "missing targetStepId" };
      }
      return null;
    }
    case "draw_arrow": {
      if (!(isPlacement(a.from) || isAnchor(a.from)) || !(isPlacement(a.to) || isAnchor(a.to))) {
        return { index, reason: "invalid or out-of-bounds anchor" };
      }
      return null;
    }
    case "erase_own_annotation": {
      if (!id(a.targetAnnotationId)) {
        return { index, reason: "missing targetAnnotationId" };
      }
      return null;
    }
    case "plot_function": {
      if (
        typeof a.expression !== "string" ||
        a.expression.length === 0 ||
        a.expression.length > MAX_PLOT_EXPRESSION_LENGTH
      ) {
        return { index, reason: "invalid expression" };
      }
      if (typeof a.variable !== "string" || !ALLOWED_SYMBOL_PATTERN.test(a.variable)) {
        return { index, reason: "invalid variable" };
      }
      try {
        const parsed = parseMathStatement(a.expression);
        if (parsed.form !== "expression") return { index, reason: "plot expression must not be an equation" };
      } catch {
        return { index, reason: "expression failed to parse under the safe grammar" };
      }
      const domain = a.domain as { min?: unknown; max?: unknown } | undefined;
      if (
        typeof domain !== "object" ||
        domain === null ||
        typeof domain.min !== "number" ||
        typeof domain.max !== "number" ||
        !Number.isFinite(domain.min) || !Number.isFinite(domain.max) || !(domain.min < domain.max)
      ) {
        return { index, reason: "invalid domain" };
      }
      if (
        typeof a.width !== "number" ||
        typeof a.height !== "number" ||
        !Number.isFinite(a.width) || !Number.isFinite(a.height) ||
        a.width <= 0 ||
        a.height <= 0 ||
        a.width > MAX_PLOT_SIZE ||
        a.height > MAX_PLOT_SIZE
      ) {
        return { index, reason: "invalid plot size" };
      }
      if (!isAnchor(a.anchor) || !inBounds(a.anchor)) return { index, reason: "invalid or out-of-bounds anchor" };
      return null;
    }
    default:
      return { index, reason: "unhandled action type" };
  }
}
