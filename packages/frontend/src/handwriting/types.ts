/** A deliberately structural input: no Excalidraw runtime import is needed. */
export interface BoardElement {
  readonly id: string;
  readonly type: string;
  readonly x: number;
  readonly y: number;
  readonly points?: readonly (readonly number[])[];
  readonly width?: number;
  readonly height?: number;
  readonly angle?: number;
  readonly strokeWidth?: number;
  readonly isDeleted?: boolean;
  /** Optional import metadata. Excalidraw itself has no creation timestamp. */
  readonly createdAt?: number;
  /** For external imports only; native Excalidraw resize already updates points. */
  readonly scale?: readonly [number, number];
}

export type Point = readonly [number, number];
export interface BBox { x: number; y: number; width: number; height: number }
export interface Stroke {
  id: string;
  points: Point[];
  width: number;
  order: number;
  createdAt?: number;
  bbox: BBox;
}
export interface StrokeSymbol { strokes: Stroke[]; bbox: BBox }
export interface StrokeLine { symbols: StrokeSymbol[]; bbox: BBox }
export interface Candidate { label: string; probability: number }
export interface RecognizedSymbol {
  bbox: BBox;
  candidates: Candidate[];
  strokeIds: string[];
  strokeOrder: number[];
  uncertain: boolean;
  /** Explicit student confirmation, independent of the neural score. */
  confirmed?: boolean;
  /** Context-selected reading; candidates remain the raw, probability-sorted neural top three. */
  label?: string;
}
export interface Alternative { text: string; confidence: number }
export interface RecognizedLine {
  id: string;
  strokeIds: string[];
  text: string;
  confidence: number;
  alternatives: Alternative[];
  bbox: BBox;
  symbols: RecognizedSymbol[];
  parserCompatible: boolean;
  ignoredStrokeIds: string[];
  crossOutUncertain?: boolean;
  /** Ambiguous layout or context-only unit spelling must be confirmed. */
  uncertain?: boolean;
}
export interface RecognitionOptions {
  unitAliases?: readonly string[];
  /** Native Excalidraw elements are in scene coordinates. Viewport never alters them. */
  inputSpace?: 'scene' | 'screen';
  viewport?: { zoom: number; scrollX: number; scrollY: number; offsetLeft?: number; offsetTop?: number };
  confidenceThreshold?: number;
  marginThreshold?: number;
}
