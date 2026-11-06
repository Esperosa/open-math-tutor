import { readdir, stat } from 'node:fs/promises';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { ClaudeProvider, CLAUDE_IMAGE_RESTRICTION } from '../src/providers/claudeProvider.js';
import * as cli from '../src/providers/process.js';
import { RESPONSE_SCHEMA, SYSTEM_PROMPT, userPrompt } from '../src/providers/prompt.js';
import { analysis, lesson, response } from './fixtures.js';

afterEach(() => vi.restoreAllMocks());

describe('Claude invocation contract (mocked CLI, NOT real inference)', () => {
  it.each(['check', 'hint', 'next_step', 'explain_differently'] as const)(
    'preserves subscription auth and tool isolation for %s', async mode => {
      const request = { ...lesson, mode };
      let isolatedCwd: string | undefined;
      const run = vi.spyOn(cli, 'runCli').mockImplementation(async (_id, args, _options, _signal, _input, cwd) => {
        if (args[0] === '--version') return { code: 0, stdout: '2.1.310', stderr: '', binaryPath: 'claude' };
        isolatedCwd = cwd;
        expect(cwd).toBeDefined();
        expect(await readdir(cwd!)).toEqual([]);
        return { code: 0, stdout: JSON.stringify({ structured_output: response }), stderr: '', binaryPath: 'claude' };
      });

      expect(await new ClaudeProvider().continueLesson(request, new AbortController().signal)).toEqual(response);
      const invocation = run.mock.calls.find(([, args]) => args[0] === '-p');
      expect(invocation).toBeDefined();
      const args = invocation![1];
      expect(args).not.toContain('--bare');
      expect(args).toContain('--restricted');
      expect(args.slice(args.indexOf('--tools'), args.indexOf('--tools') + 2)).toEqual(['--tools', '']);
      expect(args).toEqual([
        '-p', '--restricted', '--tools', '', '--disallowedTools', 'mcp__*',
        '--strict-mcp-config', '--mcp-config', '{"mcpServers":{}}',
        '--disable-slash-commands', '--no-session-persistence',
        '--output-format', 'json', '--json-schema', JSON.stringify(RESPONSE_SCHEMA),
        '--system-prompt', SYSTEM_PROMPT, '--model', request.model,
      ]);
      expect(invocation![0]).toBe('claude');
      expect(invocation![2]).toEqual({ timeoutMs: 90_000 });
      expect(invocation![4]).toBe(userPrompt(request));
      await expect(stat(isolatedCwd!)).rejects.toMatchObject({ code: 'ENOENT' });
    },
  );

  it('reports the official logged-in status without the obsolete bare-mode blocker', async () => {
    const run = vi.spyOn(cli, 'runCli').mockResolvedValue({
      code: 0, stdout: '{"loggedIn":true}', stderr: '', binaryPath: 'claude',
    });
    const auth = await new ClaudeProvider().authStatus();
    expect(auth).toMatchObject({ providerId: 'claude', authenticated: true, tutoringAvailable: true });
    expect(auth.detail).toContain('omits --bare');
    expect(run.mock.calls[0]![1]).toEqual(['auth', 'status']);
  });

  it('still rejects local images before starting inference with the unchanged restriction', async () => {
    const run = vi.spyOn(cli, 'runCli').mockResolvedValue({
      code: 0, stdout: '2.1.310', stderr: '', binaryPath: 'claude',
    });
    await expect(new ClaudeProvider().analyzeBoard(analysis, new AbortController().signal))
      .rejects.toMatchObject({ code: 'multimodal_unsupported', message: CLAUDE_IMAGE_RESTRICTION });
    expect(run.mock.calls.map(([, args]) => args)).toEqual([['--version']]);
  });
});
