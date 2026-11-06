import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { ProviderError, type ProviderAuthStatus, type ProviderModelInfo,
  type AnalyzeBoardRequest, type ContinueLessonRequest } from '@openmathtutor/shared';
import { BaseProvider } from './base.js';
import { runCli } from './process.js';
import { classifyFailure } from './errors.js';
import { RESPONSE_SCHEMA, SYSTEM_PROMPT, userPrompt } from './prompt.js';
import { record } from '../validation.js';

export const CLAUDE_IMAGE_RESTRICTION = 'No documented non-experimental local-image flag was verified for claude -p --bare --tools "" (CLI 2.1.310). --file downloads provider-hosted file IDs; it is not a local-image upload flag. OCR is not attempted.';
// --bare skips subscription OAuth/keychain; --tools "" independently disables built-in tools.
// https://code.claude.com/docs/en/headless#start-faster-with-bare-mode
// https://code.claude.com/docs/en/cli-reference (--tools, --restricted, --disallowedTools)
export const CLAUDE_AUTH_DETAIL = 'Text tutoring omits --bare to preserve the official CLI subscription login. --tools "" disables built-in tools; --restricted excludes user/project settings, and strict empty MCP config plus --disallowedTools "mcp__*" disable MCP tools. The app does not supply API keys or extract tokens.';

export class ClaudeProvider extends BaseProvider {
  readonly id = 'claude' as const;
  async authStatus(signal?: AbortSignal): Promise<ProviderAuthStatus> {
    try {
      const result = await runCli('claude', ['auth', 'status'], this.options, signal);
      let status: unknown;
      try { status = JSON.parse(result.stdout); } catch { throw classifyFailure(result.stdout + result.stderr || 'invalid JSON status'); }
      if (!record(status) || typeof status.loggedIn !== 'boolean') throw new ProviderError('invalid_response', 'Invalid Claude auth status.');
      if (result.code === 0 && status.loggedIn) return { providerId: this.id, authenticated: true, tutoringAvailable: true, detail: CLAUDE_AUTH_DETAIL };
      if (result.code === 1 && !status.loggedIn) return { providerId: this.id, authenticated: false, tutoringAvailable: false, error: 'not_authenticated', detail: 'Run claude auth login outside this app.' };
      throw classifyFailure(result.stderr + result.stdout);
    } catch (e) {
      const error = classifyFailure(e);
      return { providerId: this.id, authenticated: false, tutoringAvailable: false, error: error.code, detail: error.message };
    }
  }
  async availableModels(): Promise<ProviderModelInfo[]> {
    if (!(await this.detect()).installed) return [];
    // Official stable CLI model aliases; permissions/availability depend on plan.
    return ['sonnet', 'opus', 'haiku'].map(id => ({ id, label: id, supportsImageInput: false }));
  }
  protected async infer(req: AnalyzeBoardRequest | ContinueLessonRequest, signal: AbortSignal): Promise<unknown> {
    if (!(await this.detect(signal)).installed) throw new ProviderError('cli_missing', 'Install the official claude CLI and add it to PATH.');
    if (signal.aborted) throw new ProviderError('cancelled', 'Request cancelled.');
    if ('imageCrop' in req) throw new ProviderError('multimodal_unsupported', CLAUDE_IMAGE_RESTRICTION);
    // Empty isolated cwd avoids project files; restricted settings, disabled skills
    // and strict empty MCP config isolate customizations without disabling OAuth.
    const cwd = await mkdtemp(join(tmpdir(), 'omt-claude-'));
    try {
      const result = await runCli('claude', ['-p', '--restricted', '--tools', '', '--disallowedTools', 'mcp__*',
        '--strict-mcp-config', '--mcp-config', '{"mcpServers":{}}',
        '--disable-slash-commands', '--no-session-persistence',
        '--output-format', 'json', '--json-schema', JSON.stringify(RESPONSE_SCHEMA),
        '--system-prompt', SYSTEM_PROMPT, '--model', req.model],
      { ...this.options, timeoutMs: this.options.timeoutMs ?? 90_000 }, signal, userPrompt(req), cwd);
      if (result.code !== 0) throw classifyFailure(result.stdout + result.stderr);
      let envelope: unknown;
      try { envelope = JSON.parse(result.stdout); } catch { throw new ProviderError('invalid_response', 'Claude returned malformed JSON.'); }
      if (!record(envelope)) throw new ProviderError('invalid_response', 'Claude returned invalid output envelope.');
      if (envelope.is_error === true) throw classifyFailure(JSON.stringify(envelope));
      if (!('structured_output' in envelope)) throw new ProviderError('invalid_response', 'Claude returned no structured_output.');
      return envelope.structured_output;
    } finally { await rm(cwd, { recursive: true, force: true }); }
  }
}
