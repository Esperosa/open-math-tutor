import { describe, expect, it } from 'vitest';
import { CodexProvider, CODEX_TOOL_RESTRICTION } from '../src/providers/codexProvider.js';
import { ClaudeProvider } from '../src/providers/claudeProvider.js';
import { GeminiProvider } from '../src/providers/geminiProvider.js';
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

describe.skipIf(!process.env.RUN_PROVIDER_INTEGRATION_TESTS)('requires credentials: real Claude non-bare text invocation', () => {
  it('continues a text lesson using the official CLI login with tools disabled', async () => {
    const provider = new ClaudeProvider();
    expect(await provider.authStatus()).toMatchObject({ authenticated: true });
    const result = await provider.continueLesson(lesson, new AbortController().signal);
    expect(result).toMatchObject({
      requestId: lesson.requestId, boardRevision: lesson.boardRevision,
      pedagogicalResponse: expect.any(String),
    });
    console.info('Claude continueLesson succeeded: real CLI login and validated structured_output; no image input.');
  }, 100_000);
});

describe.skipIf(!process.env.GEMINI_API_KEY)('real Google Gemini API smoke checks (opt-in via GEMINI_API_KEY)', () => {
  it('verifies the bring-your-own key with a light models.list call and exposes the flash model', async () => {
    const provider = new GeminiProvider({ env: { GEMINI_API_KEY: process.env.GEMINI_API_KEY } });
    const auth = await provider.authStatus();
    expect(auth.providerId).toBe('google');
    expect(auth.authenticated).toBe(true);
    expect(auth.tutoringAvailable).toBe(true);
    const models = await provider.availableModels();
    expect(models.length).toBeGreaterThan(0);
    expect(models[0]?.supportsImageInput).toBe(true);
    console.info(`Gemini models.list succeeded with the user API key; tutoring model: ${models[0]?.id}`);
  }, 60_000);
});
