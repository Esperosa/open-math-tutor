import { spawn, type ChildProcessWithoutNullStreams } from 'node:child_process';
import { access, constants } from 'node:fs/promises';
import { delimiter, join, isAbsolute } from 'node:path';
import { createRequire } from 'node:module';
import { ProviderError } from '@openmathtutor/shared';
import { classifyFailure } from './errors.js';

export interface CliOptions { env?: NodeJS.ProcessEnv; timeoutMs?: number }
interface Command { file: string; prefix: string[]; binaryPath: string }
const MAX_OUTPUT = 1_000_000;

async function executable(file: string): Promise<boolean> {
  try { await access(file, process.platform === 'win32' ? constants.F_OK : constants.X_OK); return true; } catch { return false; }
}

/** PATH lookup never searches the current directory or executes a shell. Windows
 * npm's official Codex launcher is run as Node + its unmodified JS entry point,
 * avoiding cmd.exe argument interpolation (notably JSON and empty --tools). */
export async function resolveCli(id: 'codex' | 'claude', env: NodeJS.ProcessEnv): Promise<Command> {
  const pathValue = Object.entries(env).find(([k]) => k.toLowerCase() === 'path')?.[1] ?? '';
  for (const directory of pathValue.split(delimiter).filter(isAbsolute)) {
    const file = join(directory, process.platform === 'win32' ? `${id}.exe` : id);
    if (await executable(file)) return { file, prefix: [], binaryPath: file };
    if (process.platform === 'win32' && id === 'claude') {
      // Current official npm distribution points its .cmd shim at this native
      // executable. Invoke it directly rather than passing JSON through cmd.exe.
      const native = join(directory, 'node_modules', '@anthropic-ai', 'claude-code', 'bin', 'claude.exe');
      if (await executable(join(directory, 'claude.cmd')) && await executable(native)) return { file: native, prefix: [], binaryPath: native };
    }
    if (process.platform === 'win32' && id === 'codex') {
      const script = join(directory, 'node_modules', '@openai', 'codex', 'bin', 'codex.js');
      if (await executable(join(directory, 'codex.cmd')) && await executable(script)) {
        // Prefer the unmodified native executable shipped by the official npm
        // package. In Electron process.execPath is Electron, not a Node binary.
        const architecture = process.arch === 'arm64' ? 'arm64' : 'x64';
        const triple = process.arch === 'arm64' ? 'aarch64-pc-windows-msvc' : 'x86_64-pc-windows-msvc';
        try {
          const packageFile = createRequire(script).resolve(`@openai/codex-win32-${architecture}/package.json`);
          const native = join(packageFile, '..', 'vendor', triple, 'codex', 'codex.exe');
          if (await executable(native)) return { file: native, prefix: [], binaryPath: native };
        } catch { /* older npm distributions can still use their official JS launcher */ }
        return { file: process.execPath, prefix: [script], binaryPath: script };
      }
    }
  }
  throw new ProviderError('cli_missing', `Install the official ${id} CLI and add it to PATH.`);
}

/** Do not read or forward API keys/tokens from the bridge environment. Login is
 * owned exclusively by the unmodified CLI; no credential files are accessed. */
export function childEnvironment(env: NodeJS.ProcessEnv): NodeJS.ProcessEnv {
  return Object.fromEntries(Object.entries(env).filter(([key]) =>
    !/(?:API[_-]?KEY|TOKEN|SECRET|PASSWORD|CREDENTIAL)/i.test(key) &&
    !/^(?:NODE_OPTIONS|NODE_PATH|CLAUDECODE|CLAUDE_CODE_SIMPLE|ANTHROPIC_BASE_URL|OPENAI_BASE_URL|OPENAI_API_BASE|CODEX_HOME|CLAUDE_CONFIG_DIR|CLAUDE_CODE_USE_)/i.test(key)));
}

export function terminate(child: ChildProcessWithoutNullStreams): void {
  if (child.exitCode !== null || child.signalCode !== null) return;
  if (process.platform === 'win32' && child.pid) {
    const killer = spawn(join(process.env.SystemRoot ?? 'C:\\Windows', 'System32', 'taskkill.exe'),
      ['/PID', String(child.pid), '/T', '/F'], { windowsHide: true, stdio: 'ignore' });
    killer.on('error', () => child.kill());
  } else {
    try { if (child.pid) process.kill(-child.pid, 'SIGKILL'); } catch { child.kill('SIGKILL'); }
  }
}

export async function spawnCli(id: 'codex' | 'claude', args: string[], options: CliOptions = {}, cwd?: string) {
  const env = childEnvironment(options.env ?? process.env);
  const command = await resolveCli(id, env);
  if (command.prefix.length && process.versions.electron) env.ELECTRON_RUN_AS_NODE = '1';
  const child = spawn(command.file, [...command.prefix, ...args], {
    env, cwd, shell: false, windowsHide: true, detached: process.platform !== 'win32', stdio: 'pipe',
  });
  child.stdin.on('error', () => { /* process exit is handled by caller */ });
  return { child, binaryPath: command.binaryPath };
}

export async function runCli(id: 'codex' | 'claude', args: string[], options: CliOptions = {}, signal?: AbortSignal, input?: string, cwd?: string): Promise<{ code: number; stdout: string; stderr: string; binaryPath: string }> {
  if (signal?.aborted) throw new ProviderError('cancelled', 'Request cancelled.');
  const { child, binaryPath } = await spawnCli(id, args, options, cwd);
  return new Promise((resolve, reject) => {
    let stdout = '', stderr = '', settled = false;
    const finish = (error?: unknown, code?: number) => {
      if (settled) return;
      settled = true; clearTimeout(timer); signal?.removeEventListener('abort', abort);
      if (error) { terminate(child); reject(classifyFailure(error)); }
      else resolve({ code: code ?? 1, stdout, stderr, binaryPath });
    };
    const abort = () => finish(new ProviderError('cancelled', 'Request cancelled.'));
    const timer = setTimeout(() => finish(new ProviderError('timeout', 'Provider request timed out.')), options.timeoutMs ?? 30_000);
    signal?.addEventListener('abort', abort, { once: true });
    if (signal?.aborted) abort();
    for (const [stream, kind] of [[child.stdout, 'out'], [child.stderr, 'err']] as const) {
      stream.setEncoding('utf8');
      stream.on('data', (chunk: string) => {
        if (settled) return;
        if (kind === 'out') stdout += chunk; else stderr += chunk;
        if (stdout.length + stderr.length > MAX_OUTPUT) finish(new ProviderError('invalid_response', 'CLI output exceeded size limit.'));
      });
    }
    child.on('error', finish);
    child.on('close', code => finish(undefined, code ?? 1));
    child.stdin.end(input);
  });
}
