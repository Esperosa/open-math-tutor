import type {
  AnalyzeBoardRequest, AnalyzeBoardResponse, ContinueLessonRequest, ProviderId,
  ProviderDetectResult, ProviderAuthStatus, ProviderModelInfo, ProviderErrorCode,
} from '@openmathtutor/shared';
import { errorKeys } from './i18n';

export interface ProviderEntry {
  id: ProviderId;
  detect: ProviderDetectResult;
  authStatus: ProviderAuthStatus;
  models: ProviderModelInfo[];
}
export class BridgeError extends Error {
  constructor(public code: ProviderErrorCode | 'bridgeUnavailable' | 'invalidRequest') { super(code); }
}
// Pinned loopback contract; no provider endpoints, auth storage, tokens, or fallback here.
const BASE = 'http://127.0.0.1:4178';
async function json(path: string, signal: AbortSignal, body?: unknown): Promise<unknown> {
  let response: Response;
  try {
    response = await fetch(`${BASE}${path}`, {
      method: body === undefined ? 'GET' : 'POST', signal,
      credentials: 'omit', cache: 'no-store', redirect: 'error',
      headers: body === undefined ? {} : { 'Content-Type': 'application/json' },
      ...(body === undefined ? {} : { body: JSON.stringify(body) }),
    });
  } catch (error) {
    if (signal.aborted) throw error;
    throw new BridgeError('bridgeUnavailable');
  }
  if (response.status === 204) return undefined;
  let value: unknown;
  try { value = await response.json(); } catch { throw new BridgeError('invalid_response'); }
  if (!response.ok) {
    const code = (value as { error?: string })?.error;
    if (code === 'invalid_request') throw new BridgeError('invalidRequest');
    throw new BridgeError(code && Object.hasOwn(errorKeys, code) ? code as ProviderErrorCode : 'unknown');
  }
  return value;
}
function record(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}
export function parseResponse(value: unknown): AnalyzeBoardResponse {
  if (!record(value) || typeof value.requestId !== 'string' || !Number.isSafeInteger(value.boardRevision)
    || !Array.isArray(value.recognizedSteps) || value.recognizedSteps.length > 500
    || !value.recognizedSteps.every(s => record(s) && typeof s.stepId === 'string' && s.stepId.length < 200
      && typeof s.latexGuess === 'string' && s.latexGuess.length <= 2000 && s.boardRevision === value.boardRevision)
    || typeof value.confidence !== 'number' || !Number.isFinite(value.confidence) || value.confidence < 0 || value.confidence > 1
    || !(value.firstErrorStepId === null || typeof value.firstErrorStepId === 'string')
    || !['correct', 'incorrect', 'ambiguous', 'needs_domain_check'].includes(String(value.verifierStatus))
    || typeof value.pedagogicalResponse !== 'string' || value.pedagogicalResponse.length > 20000
    || typeof value.ttsText !== 'string' || value.ttsText.length > 20000
    || !Array.isArray(value.boardActions)
    || !(value.needsClarification === null || (record(value.needsClarification) && typeof value.needsClarification.reason === 'string'))) {
    throw new BridgeError('invalid_response');
  }
  // boardActions are still untrusted here: the shared validator is mandatory at state ingestion/rendering.
  return value as unknown as AnalyzeBoardResponse;
}
export const bridge = {
  async providers(signal: AbortSignal): Promise<ProviderEntry[]> {
    const value = await json('/providers', signal);
    if (!record(value) || !Array.isArray(value.providers) || !value.providers.every(p =>
      record(p) && ['codex', 'claude'].includes(String(p.id)) && record(p.detect) && typeof p.detect.installed === 'boolean'
      && record(p.authStatus) && p.authStatus.providerId === p.id && typeof p.authStatus.authenticated === 'boolean'
      && Array.isArray(p.models) && p.models.every(m => record(m) && typeof m.id === 'string'
        && typeof m.label === 'string' && typeof m.supportsImageInput === 'boolean'))) throw new BridgeError('invalid_response');
    return value.providers as ProviderEntry[];
  },
  async health(signal: AbortSignal): Promise<{ status: 'ok'; verifier: 'ok' | 'unreachable' }> {
    const value = await json('/health', signal);
    if (!record(value) || value.status !== 'ok' || !['ok', 'unreachable'].includes(String(value.verifier))) throw new BridgeError('invalid_response');
    return value as { status: 'ok'; verifier: 'ok' | 'unreachable' };
  },
  async analyze(id: ProviderId, request: AnalyzeBoardRequest, signal: AbortSignal) {
    return parseResponse(await json(`/providers/${id}/analyze-board`, signal, request));
  },
  async continue(id: ProviderId, request: ContinueLessonRequest, signal: AbortSignal) {
    return parseResponse(await json(`/providers/${id}/continue-lesson`, signal, request));
  },
  async cancel(id: ProviderId, requestId: string, signal: AbortSignal) {
    await json(`/providers/${id}/cancel`, signal, { requestId });
  },
};
