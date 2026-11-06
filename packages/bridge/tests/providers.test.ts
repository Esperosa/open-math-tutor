import { mkdtemp, mkdir, writeFile, chmod, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { CodexProvider } from '../src/providers/codexProvider.js';
import { ClaudeProvider } from '../src/providers/claudeProvider.js';
import { classifyFailure } from '../src/providers/errors.js';
import { childEnvironment, runCli, resolveCli } from '../src/providers/process.js';
import { lesson } from './fixtures.js';

describe('environment simulations, NOT inference tests', () => {
  it.each([CodexProvider, ClaudeProvider])('reports a genuinely absent CLI', async Provider => {
    const provider = new Provider({ env: { PATH: join(tmpdir(), 'omt-no-such-binary-directory') } });
    expect(await provider.detect()).toEqual({ installed: false });
    expect(await provider.authStatus()).toMatchObject({ authenticated: false, error: 'cli_missing' });
    await expect(provider.continueLesson(lesson, new AbortController().signal)).rejects.toMatchObject({ code: 'cli_missing' });
  });
  it('classifies a real subprocess exiting not authenticated (fake CLI environment only)', async () => {
    const dir = await mkdtemp(join(tmpdir(), 'omt-status-fixture-'));
    const source = 'if(process.argv.includes("status")){console.error("Not logged in");process.exit(1)}console.log("codex-cli 0.164.0")';
    try {
      if (process.platform === 'win32') {
        await mkdir(join(dir, 'node_modules/@openai/codex/bin'), { recursive: true });
        await writeFile(join(dir, 'codex.cmd'), '@echo off');
        await writeFile(join(dir, 'node_modules/@openai/codex/bin/codex.js'), source);
      } else {
        await writeFile(join(dir, 'codex'), `#!${process.execPath}\n${source}`); await chmod(join(dir, 'codex'), 0o755);
      }
      const provider = new CodexProvider({ env: { PATH: dir }, timeoutMs: 3000 });
      expect(await provider.detect()).toMatchObject({ installed: true, version: '0.164.0' });
      expect(await provider.authStatus()).toMatchObject({ authenticated: false, error: 'not_authenticated' });
      await expect(provider.continueLesson(lesson, new AbortController().signal)).rejects.toMatchObject({ code: 'not_authenticated' });
    } finally { await rm(dir, { recursive: true, force: true }); }
  });
  it('reports tutoringAvailable: false for a logged-in Codex — authenticated is not the same as usable (fake CLI environment only)', async () => {
    const dir = await mkdtemp(join(tmpdir(), 'omt-status-fixture-'));
    const source = 'if(process.argv.includes("status")){console.log("Logged in using ChatGPT");process.exit(0)}console.log("codex-cli 0.164.0")';
    try {
      if (process.platform === 'win32') {
        await mkdir(join(dir, 'node_modules/@openai/codex/bin'), { recursive: true });
        await writeFile(join(dir, 'codex.cmd'), '@echo off');
        await writeFile(join(dir, 'node_modules/@openai/codex/bin/codex.js'), source);
      } else {
        await writeFile(join(dir, 'codex'), `#!${process.execPath}\n${source}`); await chmod(join(dir, 'codex'), 0o755);
      }
      const provider = new CodexProvider({ env: { PATH: dir }, timeoutMs: 3000 });
      const auth = await provider.authStatus();
      expect(auth).toMatchObject({ authenticated: true, tutoringAvailable: false });
      // The UI's auto-select and warning banner both key off tutoringAvailable,
      // not authenticated — this is the fact that must stay true for that to work.
      await expect(provider.continueLesson(lesson, new AbortController().signal)).rejects.toMatchObject({ code: 'provider_unavailable' });
    } finally { await rm(dir, { recursive: true, force: true }); }
  });
  it.each([
    ['Not logged in', 'not_authenticated'], ['Please sign in', 'not_authenticated'],
    ['Missing ANTHROPIC_API_KEY or apiKeyHelper', 'not_authenticated'], ['401 Unauthorized', 'not_authenticated'],
    ['429 rate limit reached', 'rate_limited'], ['quota exhausted', 'rate_limited'],
    ['ETIMEDOUT', 'timeout'], ['503 service unavailable', 'provider_unavailable'],
    ['Malformed JSON', 'invalid_response'], ['terms of service restriction', 'tos_restricted'],
  ])('classifies %s without leaking the original message', (raw, code) => {
    const error = classifyFailure(raw + '; diagnostic: private@example.invalid; secret=private');
    expect(error.code).toBe(code); expect(error.message).not.toContain('private'); expect(error.cause).toBeUndefined();
  });
  it('removes credential-bearing environment variables rather than forwarding them', () => {
    expect(childEnvironment({ PATH: '/bin', OPENAI_API_KEY: 'private', ANTHROPIC_AUTH_TOKEN: 'private', NODE_OPTIONS: '--require x', OMT_DEFAULT_PROVIDER: 'codex' }))
      .toEqual({ PATH: '/bin', OMT_DEFAULT_PROVIDER: 'codex' });
  });
  it.skipIf(process.platform !== 'win32')('resolves the native executable behind the official Claude npm shim without a shell', async () => {
    const dir = await mkdtemp(join(tmpdir(), 'omt-claude-launcher-fixture-'));
    try {
      const native = join(dir, 'node_modules/@anthropic-ai/claude-code/bin/claude.exe');
      await mkdir(join(native, '..'), { recursive: true });
      await writeFile(join(dir, 'claude.cmd'), '@echo off'); await writeFile(native, 'resolution-only fixture');
      expect(await resolveCli('claude', { PATH: dir })).toEqual({ file: native, prefix: [], binaryPath: native });
    } finally { await rm(dir, { recursive: true, force: true }); }
  });
  it('honors an already-cancelled request before launching a CLI', async () => {
    const controller = new AbortController(); controller.abort();
    await expect(runCli('codex', ['--version'], {}, controller.signal)).rejects.toMatchObject({ code: 'cancelled' });
  });
});
