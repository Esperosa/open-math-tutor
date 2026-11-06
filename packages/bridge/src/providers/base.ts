import { ProviderError, type TutorProvider, type ProviderId, type ProviderDetectResult,
  type ProviderAuthStatus, type ProviderModelInfo, type AnalyzeBoardRequest,
  type ContinueLessonRequest, type AnalyzeBoardResponse, type ProviderStreamEvent } from '@openmathtutor/shared';
import { classifyFailure } from './errors.js';
import { runCli, type CliOptions } from './process.js';
import { validRequest, validateResponse } from '../validation.js';

export abstract class BaseProvider implements TutorProvider {
  abstract readonly id: ProviderId;
  protected readonly active = new Map<string, AbortController>();
  constructor(protected readonly options: CliOptions = {}) {}
  abstract detect(signal?: AbortSignal): Promise<ProviderDetectResult>;
  abstract authStatus(signal?: AbortSignal): Promise<ProviderAuthStatus>;
  abstract availableModels(): Promise<ProviderModelInfo[]>;
  protected abstract infer(req: AnalyzeBoardRequest | ContinueLessonRequest, signal: AbortSignal): Promise<unknown>;

  private async request(req: AnalyzeBoardRequest | ContinueLessonRequest, image: boolean, signal: AbortSignal): Promise<AnalyzeBoardResponse> {
    if (!(image ? validRequest(req, true) : validRequest(req, false))) throw new ProviderError('invalid_response', 'Invalid tutor request.');
    if (signal.aborted) throw new ProviderError('cancelled', 'Request cancelled.');
    if (this.active.has(req.requestId)) throw new ProviderError('provider_unavailable', 'This requestId is already running.');
    const controller = new AbortController();
    const abort = () => controller.abort();
    signal.addEventListener('abort', abort, { once: true });
    this.active.set(req.requestId, controller);
    try { return validateResponse(await this.infer(req, controller.signal), req); }
    catch (error) { throw classifyFailure(error); }
    finally { signal.removeEventListener('abort', abort); this.active.delete(req.requestId); }
  }
  analyzeBoard(req: AnalyzeBoardRequest, signal: AbortSignal) { return this.request(req, true, signal); }
  continueLesson(req: ContinueLessonRequest, signal: AbortSignal) { return this.request(req, false, signal); }
  async cancel(requestId: string): Promise<void> { this.active.get(requestId)?.abort(); }
  async stream(req: AnalyzeBoardRequest, onEvent: (event: ProviderStreamEvent) => void, signal: AbortSignal) {
    onEvent({ type: 'status', status: 'thinking' });
    try {
      const response = await this.analyzeBoard(req, signal);
      onEvent({ type: 'done', response }); return response;
    } catch (error) {
      const e = classifyFailure(error);
      onEvent({ type: 'error', error: e.code, detail: e.message }); throw e;
    }
  }
}

/** CLI transport detection stays separate from built-in REST providers. */
export abstract class CliProvider extends BaseProvider {
  abstract readonly id: 'codex' | 'claude';
  async detect(signal?: AbortSignal): Promise<ProviderDetectResult> {
    try {
      const result = await runCli(this.id, ['--version'], this.options, signal);
      if (result.code !== 0) throw classifyFailure(result.stderr + result.stdout);
      const version = result.stdout.trim().match(/\d+\.\d+\.\d+(?:[-+][\w.-]+)?/)?.[0];
      return { installed: true, ...(version ? { version } : {}), binaryPath: result.binaryPath };
    } catch (error) {
      if (classifyFailure(error).code === 'cli_missing') return { installed: false };
      throw classifyFailure(error);
    }
  }
}
