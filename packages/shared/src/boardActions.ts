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

interface BoardActionBase {
  id: string;
  boardRevision: number;
}

export type BoardAction =
  | (BoardActionBase & { type: "write_math"; latex: string; anchor: Anchor; style?: AnnotationStyle })
  | (BoardActionBase & { type: "write_text"; text: string; anchor: Anchor; style?: AnnotationStyle })
  | (BoardActionBase & { type: "underline"; targetStepId: string; style?: AnnotationStyle })
  | (BoardActionBase & { type: "circle"; targetStepId: string; style?: AnnotationStyle })
  | (BoardActionBase & { type: "highlight"; targetStepId: string; style?: AnnotationStyle })
  | (BoardActionBase & { type: "draw_arrow"; from: Anchor; to: Anchor; style?: AnnotationStyle })
  | (BoardActionBase & { type: "show_hint"; text: string; anchor: Anchor })
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

  if (typeof a.id !== "string" || a.id.length === 0) return { index, reason: "missing id" };
  if (typeof a.boardRevision !== "number") return { index, reason: "missing boardRevision" };
  if (a.boardRevision !== expectedBoardRevision) {
    return { index, reason: `stale boardRevision (${a.boardRevision} != ${expectedBoardRevision})` };
  }
  if (typeof a.type !== "string" || !(BOARD_ACTION_TYPES as readonly string[]).includes(a.type)) {
    return { index, reason: "unknown action type" };
  }

  const inBounds = (p: { x: number; y: number }) =>
    p.x >= bounds.minX && p.x <= bounds.maxX && p.y >= bounds.minY && p.y <= bounds.maxY;
  const isAnchor = (v: unknown): v is Anchor =>
    typeof v === "object" && v !== null && typeof (v as Anchor).x === "number" && typeof (v as Anchor).y === "number";

  switch (a.type) {
    case "write_math": {
      if (typeof a.latex !== "string" || a.latex.length === 0 || a.latex.length > MAX_LATEX_LENGTH) {
        return { index, reason: "invalid latex" };
      }
      if (!isAnchor(a.anchor) || !inBounds(a.anchor)) return { index, reason: "invalid or out-of-bounds anchor" };
      return null;
    }
    case "write_text":
    case "show_hint": {
      const text = a.text;
      if (typeof text !== "string" || text.length === 0 || text.length > MAX_TEXT_LENGTH) {
        return { index, reason: "invalid text" };
      }
      if (!isAnchor(a.anchor) || !inBounds(a.anchor)) return { index, reason: "invalid or out-of-bounds anchor" };
      return null;
    }
    case "underline":
    case "circle":
    case "highlight": {
      if (typeof a.targetStepId !== "string" || a.targetStepId.length === 0) {
        return { index, reason: "missing targetStepId" };
      }
      return null;
    }
    case "draw_arrow": {
      if (!isAnchor(a.from) || !isAnchor(a.to) || !inBounds(a.from) || !inBounds(a.to)) {
        return { index, reason: "invalid or out-of-bounds anchor" };
      }
      return null;
    }
    case "erase_own_annotation": {
      if (typeof a.targetAnnotationId !== "string" || a.targetAnnotationId.length === 0) {
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
        !(domain.min < domain.max)
      ) {
        return { index, reason: "invalid domain" };
      }
      if (
        typeof a.width !== "number" ||
        typeof a.height !== "number" ||
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
