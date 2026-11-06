import type { ExpectedAnswer } from '@openmathtutor/shared';
import { expectedAnswerFor, unitFromLine, parseMathStatement, validateBoardActions, type BoardAction, type AnalyzeBoardResponse, type RecognizedStep } from '@openmathtutor/shared';
import type { ExcalidrawElement } from '@excalidraw/excalidraw/element/types';
import type { BinaryFiles } from '@excalidraw/excalidraw/types';
import { unitAliasesFor } from './handwriting/units';
import { parseLine, recognizeBoardLines, type RecognizedLine, type RecognizedSymbol } from './handwriting';

export interface Box { x: number; y: number; width: number; height: number }
export interface Step extends RecognizedStep {
  box: Box; elementIds: string[];
  /** 'ink' means the line came from the local handwriting recognizer. */
  origin?: 'text' | 'ink';
  confidence?: number;
  uncertain?: boolean;
  parserCompatible?: boolean;
  crossOutUncertain?: boolean;
  symbols?: RecognizedSymbol[];
}
export interface Explanation {
  id: string; revision: number; text: string; ttsText: string;
  status: AnalyzeBoardResponse['verifierStatus']; firstErrorStepId: string | null; clarification: string | null;
}
export interface BoardState {
  id: string; revision: number; statement: string; topic: string;
  elements: readonly ExcalidrawElement[]; files: BinaryFiles;
  steps: Step[]; annotations: BoardAction[]; history: Explanation[];
  activeStepId: string | null;
  /** Lesson context: which skill this problem practises and the programmatically computed answer, if any. */
  skillId?: string;
  expected?: ExpectedAnswer;
  /** First judgement of the finished problem (used once for mastery). */
  outcome?: 'solved' | 'failed';
  /** Lines the coach has already reacted to, so a reload does not judge them again. */
  handled?: string[];
  /** Exact line keys explicitly submitted as final; edits invalidate the corresponding mark. */
  confirmedFinals?: string[];
  /** One-tap symbol corrections keyed by stroke signature (IDs plus versions). */
  inkEdits?: Record<string, string>;
}
export function newBoard(): BoardState {
  return { id: crypto.randomUUID(), revision: 0, statement: '', topic: '', elements: [], files: {},
    steps: [], annotations: [], history: [], activeStepId: null };
}
export function isStudent(e: ExcalidrawElement) { return !e.id.startsWith('omt-ai-') && !e.customData?.aiLayer; }
export function fingerprint(elements: readonly ExcalidrawElement[]): string {
  // Excalidraw version increments on content changes, not selection/zoom/hover.
  return JSON.stringify(elements.filter(isStudent).filter(e => !e.isDeleted).map(e => [e.id, e.version, e.versionNonce]));
}
function bounds(e: ExcalidrawElement): Box {
  const w = Math.abs(e.width), h = Math.abs(e.height), c = Math.abs(Math.cos(e.angle)), s = Math.abs(Math.sin(e.angle));
  const width = w * c + h * s, height = w * s + h * c;
  return { x: e.x + w / 2 - width / 2, y: e.y + h / 2 - height / 2, width: Math.max(1, width), height: Math.max(1, height) };
}
function union(a: Box, b: Box): Box {
  const x = Math.min(a.x, b.x), y = Math.min(a.y, b.y);
  return { x, y, width: Math.max(a.x + a.width, b.x + b.width) - x, height: Math.max(a.y + a.height, b.y + b.height) - y };
}
/** A simple geometric row heuristic. Existing element membership keeps step IDs stable across corrections. */
function rows(elements: readonly ExcalidrawElement[], previous: Step[], revision: number): Step[] {
  const groups: { box: Box; elements: ExcalidrawElement[] }[] = [];
  for (const element of elements.filter(e => !e.isDeleted).sort((a, b) => a.y - b.y || a.x - b.x)) {
    const box = bounds(element);
    const row = groups.find(g => Math.abs(g.box.y + g.box.height / 2 - box.y - box.height / 2) < Math.max(24, Math.min(64, Math.max(g.box.height, box.height) * 0.6)));
    if (row) { row.box = union(row.box, box); row.elements.push(element); }
    else groups.push({ box, elements: [element] });
  }
  const used = new Set<string>();
  return groups.map(g => {
    const old = previous.find(s => !used.has(s.stepId) && s.elementIds.some(id => g.elements.some(e => e.id === id)))
      ?? previous.find(s => !used.has(s.stepId) && Math.abs(s.box.y - g.box.y) < 24);
    const stepId = old?.stepId ?? crypto.randomUUID(); used.add(stepId);
    const typed = g.elements.filter(e => e.type === 'text').map(e => e.type === 'text' ? e.text : '').join(' ');
    const same = old && old.elementIds.every(id => g.elements.some(e => e.id === id)) && old.elementIds.length === g.elements.length;
    return { stepId, boardRevision: revision, latexGuess: typed || (same ? old.latexGuess : ''), box: g.box, elementIds: g.elements.map(e => e.id) };
  });
}
/** Stable key for one recognised symbol. Versions are part of the key so a
 * re-drawn stroke cannot silently inherit an old correction. */
export function inkSymbolKey(strokeIds: readonly string[], elements: readonly ExcalidrawElement[]): string {
  const byId = new Map(elements.map(e => [e.id, e]));
  return [...strokeIds].sort().map(id => {
    const e = byId.get(id);
    return `${id}@${e?.version ?? 0}:${e?.versionNonce ?? 0}`;
  }).join('|');
}

/** The same safe parser decides whether a composed line is a usable statement. */
function parserCompatible(text: string): boolean {
  try { parseMathStatement(text); return true; } catch {
    const unit = unitFromLine(text);
    if (!unit || !unitAliasesFor(unit).includes(unit)) return false;
    try { parseMathStatement(text.slice(0, -unit.length).trim()); return true; } catch { return false; }
  }
}

/** Apply one-tap symbol edits, then let the same spatial parser recompose the line. */
export function correctedInkLine(line: RecognizedLine, edits: Record<string, string>, elements: readonly ExcalidrawElement[], unitAliases: readonly string[] = []) {
  if (!line.symbols.some(symbol => edits[inkSymbolKey(symbol.strokeIds, elements)])) return line;
  const symbols = line.symbols.map(symbol => {
    const label = edits[inkSymbolKey(symbol.strokeIds, elements)];
    return label && correctionLabels(symbol).includes(label) ? { ...symbol, label, uncertain: false, confirmed: true } : symbol;
  });
  const parsed = parseLine(symbols, undefined, unitAliases);
  return { ...line, symbols, uncertain: !!parsed.uncertain || !!line.crossOutUncertain, text: parsed.text, confidence: parsed.confidence, parserCompatible: parserCompatible(parsed.text) };
}

/** Model top three plus explicit, common handwriting confusions. No probabilities are invented. */
export function correctionLabels(symbol: RecognizedSymbol): string[] {
  const labels = [symbol.label ?? symbol.candidates[0]?.label, ...symbol.candidates.map(c => c.label)].filter((s): s is string => !!s);
  for (const pair of [['1', '7'], ['4', '9'], ['x', '×'], [',', '.']]) if (pair.some(label => labels.includes(label))) labels.push(...pair);
  return [...new Set(labels)];
}
function uncertainInk(line: Pick<RecognizedLine, 'symbols' | 'parserCompatible' | 'confidence' | 'uncertain'>): boolean {
  return !!line.uncertain || !line.parserCompatible || line.confidence < .5 || line.symbols.some(symbol => symbol.uncertain);
}

export type InkRecognizer = (elements: readonly ExcalidrawElement[]) => RecognizedLine[];

export function commitStudent(state: BoardState, incoming: readonly ExcalidrawElement[], files = state.files,
  recognize: InkRecognizer = elements => recognizeBoardLines(elements, { unitAliases: unitAliasesFor(state.expected?.unit, state.statement) })): BoardState {
  const elements = incoming.filter(isStudent);
  if (fingerprint(elements) === fingerprint(state.elements) && files === state.files) return state;
  if (fingerprint(elements) === fingerprint(state.elements)) return { ...state, files };
  const revision = state.revision + 1;
  const changedIds = new Set(elements.filter(e => !state.elements.some(p => p.id === e.id && p.version === e.version && p.versionNonce === e.versionNonce)).map(e => e.id));
  // The local recognizer is authoritative for ink. A drawing/unsupported shape
  // falls back to the old geometric row grouping rather than disappearing.
  let recognized: RecognizedLine[] = [];
  try { recognized = recognize(elements); } catch { recognized = []; }
  const edits = state.inkEdits ?? {};
  const used = new Set<string>();
  const inkSteps: Step[] = recognized.flatMap(line => {
    const corrected = correctedInkLine(line, edits, elements, unitAliasesFor(state.expected?.unit, state.statement));
    if (!corrected.text.trim()) return [];
    const old = state.steps.find(s => s.origin === 'ink' && !used.has(s.stepId)
      && s.elementIds.some(id => line.strokeIds.includes(id)));
    const stepId = old?.stepId ?? line.id;
    used.add(stepId);
    return [{
      stepId, boardRevision: revision, latexGuess: corrected.text, box: { ...line.bbox }, elementIds: [...line.strokeIds],
      origin: 'ink' as const, confidence: corrected.confidence, uncertain: uncertainInk(corrected),
      crossOutUncertain: corrected.crossOutUncertain, parserCompatible: corrected.parserCompatible, symbols: corrected.symbols,
    }];
  });
  const covered = new Set(recognized.flatMap(line => line.strokeIds));
  const rest = elements.filter(e => e.type !== 'freedraw' || (!e.points?.length && !covered.has(e.id)));
  const textSteps = rows(rest, state.steps.filter(s => s.origin !== 'ink'), revision).map(s => ({ ...s,
    latexGuess: s.elementIds.some(id => changedIds.has(id)) && !elements.some(e => s.elementIds.includes(e.id) && e.type === 'text') ? '' : s.latexGuess,
  }));
  const steps = [...textSteps, ...inkSteps].sort((a, b) => a.box.y - b.box.y || a.box.x - b.box.x);
  const activeStepId = steps.find(s => s.elementIds.some(id => changedIds.has(id)))?.stepId ?? steps.at(-1)?.stepId ?? null;
  const currentKeys = new Set(recognized.flatMap(line => line.symbols.map(symbol => inkSymbolKey(symbol.strokeIds, elements))));
  const inkEdits = Object.fromEntries(Object.entries(edits).filter(([key]) => currentKeys.has(key)));
  // Outdated annotations are deliberately removed when the student changes the mathematical surface.
  return { ...state, elements: structuredClone(elements), files, steps, revision, activeStepId, annotations: [],
    ...(Object.keys(inkEdits).length ? { inkEdits } : { inkEdits: undefined }) };
}
/** One-tap correction of a single recognised symbol; recomposes only its line. */
export function correctInk(state: BoardState, key: string, label: string): BoardState {
  if (state.inkEdits?.[key] === label) return state;
  const target = state.steps.find(step => step.symbols?.some(symbol => inkSymbolKey(symbol.strokeIds, state.elements) === key && correctionLabels(symbol).includes(label)));
  if (!target?.symbols) return state;
  const revision = state.revision + 1, edits = { ...state.inkEdits, [key]: label };
  const symbols = target.symbols.map(symbol => inkSymbolKey(symbol.strokeIds, state.elements) === key ? { ...symbol, label, uncertain: false, confirmed: true } : symbol);
  const parsed = parseLine(symbols, undefined, unitAliasesFor(state.expected?.unit, state.statement)), compatible = parserCompatible(parsed.text);
  // A chip must not turn a readable row into unsupported syntax.
  if (target.parserCompatible && !compatible) return state;
  const corrected = { ...target, symbols, boardRevision: revision, latexGuess: parsed.text, confidence: parsed.confidence,
    uncertain: uncertainInk({ symbols, parserCompatible: compatible, confidence: parsed.confidence, uncertain: parsed.uncertain || target.crossOutUncertain }), parserCompatible: compatible };
  const steps = state.steps.map(step => step === target ? corrected : { ...step, boardRevision: revision });
  return { ...state, revision, steps, inkEdits: edits, annotations: [] };
}

export function editTask(state: BoardState, field: 'statement' | 'topic', value: string): BoardState {
  if (state[field] === value) return state;
  const revision = state.revision + 1;
  return { ...state, [field]: value, revision, annotations: [], steps: state.steps.map(s => ({ ...s, boardRevision: revision })),
    ...(field === 'statement' ? { expected: expectedAnswerFor(value), outcome: undefined, handled: [], confirmedFinals: [], skillId: undefined } : {}) };
}
export function boardBounds(state: BoardState) {
  const box = state.steps.reduce<Box>((b, s) => union(b, s.box), { x: 0, y: 0, width: 1000, height: 700 });
  return { minX: box.x - 160, minY: box.y - 160, maxX: box.x + box.width + 600, maxY: box.y + box.height + 400 };
}
export function renderableActions(state: BoardState): BoardAction[] {
  // Revalidate even persisted actions at the last boundary before rendering.
  // Twelve is a per-response limit, not a lifetime-layer limit. Retain up to 64 validated annotations.
  return state.annotations.slice(-64).flatMap(a => validateBoardActions([a], state.revision, boardBounds(state)).valid);
}
function rebase(actions: BoardAction[], revision: number) { return actions.map(a => ({ ...a, boardRevision: revision })); }
export function removeAnnotation(state: BoardState, id: string): BoardState {
  if (!state.annotations.some(a => a.id === id)) return state;
  const revision = state.revision + 1;
  return { ...state, revision, annotations: rebase(state.annotations.filter(a => a.id !== id), revision),
    steps: state.steps.map(s => ({ ...s, boardRevision: revision })) };
}
export function applyResponse(state: BoardState, response: AnalyzeBoardResponse, requestId: string, locale: 'cs' | 'en' = 'cs', intent: 'check' | 'ask' = 'check') {
  if (response.boardRevision !== state.revision || response.requestId !== requestId) return { state, stale: true, rejected: false, response };
  if (state.steps.some(step => step.uncertain)) {
    const text = locale === 'cs' ? 'Zkontroluj, jestli jsem to přečetl správně. Nejasný znak oprav klepnutím; při přeškrtnutí použij gumu.' : 'Check whether I read that correctly. Correct the unclear symbol; use the eraser for crossed-out ink.';
    const explanationOnly = intent === 'ask' && response.boardActions.length === 0 && response.firstErrorStepId === null && response.verifierStatus === 'ambiguous';
    response = { ...response, recognizedSteps: state.steps, boardActions: [], firstErrorStepId: null, verifierStatus: 'ambiguous', confidence: 0,
      ...(!explanationOnly ? { pedagogicalResponse: text, ttsText: text, needsClarification: { reason: text } } : {}) };
  }
  const result = validateBoardActions(response.boardActions, state.revision, boardBounds(state));
  // The local recognizer (and explicit student corrections) own ink text; the
  // provider may only restate typed lines.
  const steps = state.steps.map(s => ({ ...s,
    latexGuess: s.origin === 'ink' ? s.latexGuess : response.recognizedSteps.find(r => r.stepId === s.stepId)?.latexGuess ?? s.latexGuess }));
  const known = new Set(steps.flatMap(s => [s.stepId, ...s.latexGuess.split(/\n+/).filter(p => p.trim()).map((_, i) => `${s.stepId}#${i}`)]));
  let rejected = result.errors.length > 0;
  let annotations = renderableActions(state);
  for (const a of result.valid) {
    if ('targetStepId' in a && (!known.has(a.targetStepId) || (response.firstErrorStepId !== null && a.targetStepId !== response.firstErrorStepId))) { rejected = true; continue; }
    if (a.type === 'erase_own_annotation') {
      annotations = annotations.filter(n => n.id !== a.targetAnnotationId);
    } else {
      const anchors = 'placement' in a && a.placement ? [a.placement] : 'anchor' in a && a.anchor ? [a.anchor] : a.type === 'draw_arrow' ? [a.from, a.to] : [];
      if (anchors.some(p => p.relativeToStepId && (!known.has(p.relativeToStepId)
        || (response.firstErrorStepId !== null && p.relativeToStepId !== response.firstErrorStepId)))) { rejected = true; continue; }
      annotations = [...annotations.filter(n => n.id !== a.id), a];
    }
  }
  // An AI batch is one committed board change, not a student stroke: bump once, do not auto-analyze it.
  // Only already-validated annotations are rebased. Never rebase an incoming stale response.
  const revision = state.revision + (JSON.stringify(annotations) !== JSON.stringify(state.annotations) ? 1 : 0);
  const next: BoardState = { ...state, steps: steps.map(s => ({ ...s, boardRevision: revision })), revision,
    annotations: rebase(annotations.slice(-64), revision), history: [...state.history, {
      id: response.requestId, revision: response.boardRevision, text: response.pedagogicalResponse, ttsText: response.ttsText,
      status: response.verifierStatus, firstErrorStepId: response.firstErrorStepId, clarification: response.needsClarification?.reason ?? null,
    }] };
  return { state: next, response, stale: result.errors.some(e => e.reason.startsWith('stale boardRevision')), rejected };
}
export function stableMathCandidate(state: BoardState): boolean {
  const step = state.steps.find(s => s.stepId === state.activeStepId);
  if (!step) return false;
  // Typed lines need a relation and both operands. Handwriting needs multiple stable marks and useful width.
  return step.latexGuess ? /.+(?:=|<|>|≤|≥).+/.test(step.latexGuess) : step.elementIds.length >= 2 && step.box.width >= 40;
}
