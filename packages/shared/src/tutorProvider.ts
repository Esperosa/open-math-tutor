import type { BoardAction } from "./boardActions.js";

export type ProviderId = "codex" | "claude";

export type ProviderErrorCode =
  | "cli_missing"
  | "not_authenticated"
  | "rate_limited"
  | "provider_unavailable"
  | "multimodal_unsupported"
  | "tos_restricted"
  | "cancelled"
  | "timeout"
  | "invalid_response"
  | "unknown";

export class ProviderError extends Error {
  constructor(readonly code: ProviderErrorCode, message: string, readonly cause?: unknown) {
    super(message);
    this.name = "ProviderError";
  }
}

export interface ProviderDetectResult {
  installed: boolean;
  version?: string;
  binaryPath?: string;
}

export interface ProviderAuthStatus {
  providerId: ProviderId;
  authenticated: boolean;
  /** Non-sensitive label only (e.g. plan name) — never a token or email scraped from credential storage. */
  accountLabel?: string;
  error?: ProviderErrorCode;
  detail?: string;
}

export interface ProviderModelInfo {
  id: string;
  label: string;
  supportsImageInput: boolean;
}

export type Locale = "cs" | "en";

export interface RecognizedStep {
  stepId: string;
  /** Best-effort LaTeX transcription of this board line, as read by the provider. */
  latexGuess: string;
  boardRevision: number;
}

export interface AnalyzeBoardRequest {
  requestId: string;
  boardRevision: number;
  /** A reasonably tight crop around the changed/active region — never the whole board unconditionally. */
  imageCrop: { dataUrl: string; width: number; height: number };
  task: { statementLatex?: string; statementText?: string; topic: string };
  stepHistory: RecognizedStep[];
  locale: Locale;
  model: string;
}

export type VerifierStatus = "correct" | "incorrect" | "ambiguous" | "needs_domain_check";

export interface AnalyzeBoardResponse {
  requestId: string;
  boardRevision: number;
  recognizedSteps: RecognizedStep[];
  confidence: number;
  firstErrorStepId: string | null;
  verifierStatus: VerifierStatus;
  pedagogicalResponse: string;
  ttsText: string;
  boardActions: BoardAction[];
  needsClarification: { reason: string } | null;
}

export interface ContinueLessonRequest {
  requestId: string;
  boardRevision: number;
  mode: "check" | "hint" | "next_step" | "explain_differently";
  task: { statementLatex?: string; statementText?: string; topic: string };
  stepHistory: RecognizedStep[];
  locale: Locale;
  model: string;
}

export type ProviderStreamEvent =
  | { type: "text_delta"; text: string }
  | { type: "status"; status: "thinking" | "writing_to_board" }
  | { type: "done"; response: AnalyzeBoardResponse }
  | { type: "error"; error: ProviderErrorCode; detail: string };

export interface TutorProvider {
  readonly id: ProviderId;
  detect(): Promise<ProviderDetectResult>;
  authStatus(): Promise<ProviderAuthStatus>;
  availableModels(): Promise<ProviderModelInfo[]>;
  analyzeBoard(req: AnalyzeBoardRequest, signal: AbortSignal): Promise<AnalyzeBoardResponse>;
  continueLesson(req: ContinueLessonRequest, signal: AbortSignal): Promise<AnalyzeBoardResponse>;
  cancel(requestId: string): Promise<void>;
  stream(
    req: AnalyzeBoardRequest,
    onEvent: (e: ProviderStreamEvent) => void,
    signal: AbortSignal,
  ): Promise<AnalyzeBoardResponse>;
}
