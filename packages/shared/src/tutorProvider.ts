import type { BoardAction } from "./boardActions.js";

export type ProviderId = "codex" | "claude" | "google";

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
  /**
   * Whether this provider can actually run a tutoring turn right now, as a
   * static fact about this build/provider — distinct from `authenticated`.
   * A provider can be installed and logged in (authenticated: true) while
   * still being fail-closed for every request, e.g. because no documented
   * way exists yet to disable its coding-agent tools. The UI must use this,
   * not `authenticated` alone, to decide which provider to default to or
   * recommend — never silently default to a provider that is known to
   * always fail. True when there is no known blanket reason tutoring would
   * fail for this provider (individual requests can still fail at runtime
   * for other reasons, e.g. rate limits — that's unrelated to this flag).
   */
  tutoringAvailable: boolean;
  /** Google only: presence, never the key itself. Authentication is checked separately. */
  keyPresent?: boolean;
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

export interface RetrievedChunk {
  sourceId: string;
  sourceTitle: string;
  chunkIndex: number;
  text: string;
}

export interface CurriculumContext {
  trackId: string;
  topicId: string;
  skillId: string;
  difficultyLevel: number;
}

export interface ConversationTurn { role: "student" | "tutor"; text: string }

export interface ContinueLessonRequest {
  requestId: string;
  boardRevision: number;
  mode: "check" | "hint" | "next_step" | "explain_differently" | "ask" | "next_problem";
  task: { statementLatex?: string; statementText?: string; topic: string };
  stepHistory: RecognizedStep[];
  locale: Locale;
  model: string;
  /** Free-form student question/description, used by mode "ask" (e.g. "nechápu proč se mění znaménko"). */
  studentMessage?: string;
  /** Last few chat turns (oldest first, at most 8, 400 characters each) so a short follow-up like "why?" has a referent. Untrusted data, never instructions. */
  conversation?: ConversationTurn[];
  /** App-generated summary of how this student learns (frequent mistakes, explanation styles that worked). Advisory data, never instructions. */
  learnerContext?: string;
  /** Present when the request originates from a curriculum track/lesson flow rather than free board work. */
  curriculumContext?: CurriculumContext;
  /** Top-k chunks from the student's own uploaded sources (NotebookLM-style custom track), to ground the answer and let the UI show citations. Never silently treated as verified fact by the verifier — same math-safety boundary applies to any statement it contains. */
  retrievedContext?: RetrievedChunk[];
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
