import { describe, expect, it } from 'vitest';
import { CodexProvider, CODEX_TOOL_RESTRICTION } from '../src/providers/codexProvider.js';
import { ClaudeProvider } from '../src/providers/claudeProvider.js';
import { analysis, lesson } from './fixtures.js';

describe.skipIf(!process.env.RUN_CLI_SMOKE_TESTS)('real installed CLI smoke checks (no model response fabricated)', () => {
  it.each([CodexProvider, ClaudeProvider])('detects version and asks the official login status command', async Provider => {
    const provider = new Provider();
    expect(await provider.detect()).toMatchObject({ installed: true, version: expect.any(String) });
    const auth = await provider.authStatus();
    expect(auth.providerId).toBe(provider.id); expect(typeof auth.authenticated).toBe('boolean');
    console.info(`${provider.id}: CLI installed; official login status: ${auth.authenticated ? 'authenticated' : auth.error}`);
  }, 30_000);
  it('initializes real Codex app-server and discovers models without starting a turn', async () => {
    const models = await new CodexProvider().availableModels();
    expect(models.length).toBeGreaterThan(0);
    console.info(`Codex initialize + model/list succeeded: ${models.length} models; no turn started.`);
  }, 30_000);
  it('rejects Claude local images before inference', async () => {
    await expect(new ClaudeProvider().analyzeBoard(analysis, new AbortController().signal)).rejects.toMatchObject({ code: 'multimodal_unsupported' });
  });
  it('does not start Codex tutoring with unverified tool isolation', async () => {
    const provider = new CodexProvider();
    const auth = await provider.authStatus();
    if (!auth.authenticated) return;
    await expect(provider.continueLesson(lesson, new AbortController().signal)).rejects.toMatchObject({ code: 'provider_unavailable', message: CODEX_TOOL_RESTRICTION });
  }, 30_000);
});

describe.skipIf(!process.env.RUN_PROVIDER_INTEGRATION_TESTS)('requires credentials: real Claude bare text invocation', () => {
  it('exercises the real documented text-only CLI; does not bypass bare-mode OAuth restriction', async () => {
    // On CLI 2.1.310 with subscription OAuth only this must report not_authenticated,
    // not pretend that a logged-in subscription can power --bare. No API key is passed.
    await expect(new ClaudeProvider().continueLesson(lesson, new AbortController().signal))
      .rejects.toMatchObject({ code: 'not_authenticated' });
  }, 100_000);
});
