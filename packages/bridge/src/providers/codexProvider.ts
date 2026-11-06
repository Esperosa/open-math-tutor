import { ProviderError, type ProviderAuthStatus, type ProviderModelInfo,
  type AnalyzeBoardRequest, type ContinueLessonRequest } from '@openmathtutor/shared';
import { BaseProvider } from './base.js';
import { CodexRpc } from './codexRpc.js';
import { runCli } from './process.js';
import { classifyFailure } from './errors.js';
import { record, text } from '../validation.js';

export const CODEX_TOOL_RESTRICTION = 'Codex app-server has no verified documented all-tools-disabled control in CLI 0.164.0. Read-only sandbox, approvalPolicy and empty dynamicTools do not remove built-in filesystem tools. No tutoring turn was started. See packages/bridge/README.md.';

export class CodexProvider extends BaseProvider {
  readonly id = 'codex' as const;
  async authStatus(signal?: AbortSignal): Promise<ProviderAuthStatus> {
    try {
      const result = await runCli('codex', ['login', 'status'], this.options, signal);
      if (result.code === 0 && /logged in/i.test(result.stdout + result.stderr)) {
        return { providerId: this.id, authenticated: true, detail: CODEX_TOOL_RESTRICTION };
      }
      const error = classifyFailure(result.stdout + result.stderr);
      return { providerId: this.id, authenticated: false, error: error.code, detail: error.message };
    } catch (e) {
      const error = classifyFailure(e);
      return { providerId: this.id, authenticated: false, error: error.code, detail: error.message };
    }
  }
  async availableModels(): Promise<ProviderModelInfo[]> {
    if (!(await this.detect()).installed) return [];
    const rpc = await CodexRpc.connect(this.options);
    try {
      const response = await rpc.call('model/list', {});
      if (!record(response) || !Array.isArray(response.data)) throw new ProviderError('invalid_response', 'Invalid Codex model list.');
      return response.data.filter(m => record(m) && text(m.id, 128) && text(m.displayName, 200)).map(m => ({
        id: m.id as string, label: m.displayName as string,
        supportsImageInput: Array.isArray(m.inputModalities) && m.inputModalities.includes('image'),
      }));
    } finally { rpc.close(); }
  }
  protected async infer(_req: AnalyzeBoardRequest | ContinueLessonRequest, signal: AbortSignal): Promise<unknown> {
    const auth = await this.authStatus(signal);
    if (signal.aborted) throw new ProviderError('cancelled', 'Request cancelled.');
    if (!auth.authenticated) throw new ProviderError(auth.error ?? 'not_authenticated', auth.detail ?? 'Run codex login outside this app.');
    // Fail closed rather than claim sandbox=read-only or a prompt disables tools.
    // thread/start + turn/start/localImage must not be enabled until an official
    // zero-tool control exists and is verified for a specific installed version.
    throw new ProviderError('provider_unavailable', CODEX_TOOL_RESTRICTION);
  }
}
