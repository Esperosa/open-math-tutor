import type { ChildProcessWithoutNullStreams } from 'node:child_process';
import { ProviderError } from '@openmathtutor/shared';
import { record } from '../validation.js';
import { classifyFailure } from './errors.js';
import { spawnCli, terminate, type CliOptions } from './process.js';

/** App-server stdio uses one JSON-RPC message per line (not Content-Length).
 * This client currently performs initialize/model discovery only. No thread or
 * turn is started while the installed protocol cannot enforce a zero-tool policy. */
export class CodexRpc {
  private nextId = 1;
  private buffer = '';
  private bytes = 0;
  private failure?: ProviderError;
  private pending = new Map<number, { resolve: (value: unknown) => void; reject: (error: unknown) => void; timer: ReturnType<typeof setTimeout> }>();
  private constructor(private child: ChildProcessWithoutNullStreams, private timeoutMs: number) {
    child.stdout.setEncoding('utf8');
    child.stdout.on('data', (chunk: string) => this.receive(chunk));
    child.stderr.on('data', () => { /* drain, never log potentially sensitive diagnostics */ });
    child.on('error', e => this.close(classifyFailure(e)));
    child.on('close', () => this.close(new ProviderError('provider_unavailable', 'Codex app-server closed.')));
  }
  static async connect(options: CliOptions = {}): Promise<CodexRpc> {
    const { child } = await spawnCli('codex', ['app-server'], options);
    const rpc = new CodexRpc(child, options.timeoutMs ?? 15_000);
    try {
      await rpc.call('initialize', { clientInfo: { name: 'openmathtutor', title: 'OpenMathTutor', version: '0.1.0' }, capabilities: { experimentalApi: false } });
      rpc.send({ method: 'initialized' }); return rpc;
    } catch (e) { rpc.close(); throw e; }
  }
  private send(message: unknown) { this.child.stdin.write(JSON.stringify(message) + '\n'); }
  call(method: string, params: unknown): Promise<unknown> {
    if (this.failure) return Promise.reject(this.failure);
    const id = this.nextId++;
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => this.close(new ProviderError('timeout', 'Codex app-server timed out.')), this.timeoutMs);
      this.pending.set(id, { resolve, reject, timer }); this.send({ id, method, params });
    });
  }
  private receive(chunk: string) {
    this.bytes += Buffer.byteLength(chunk);
    if (this.bytes > 2_000_000) { this.close(new ProviderError('invalid_response', 'Codex protocol output exceeded limit.')); return; }
    this.buffer += chunk;
    let index: number;
    while ((index = this.buffer.indexOf('\n')) >= 0) {
      const line = this.buffer.slice(0, index); this.buffer = this.buffer.slice(index + 1);
      if (!line.trim()) continue;
      let message: unknown;
      try { message = JSON.parse(line); } catch { this.close(new ProviderError('invalid_response', 'Malformed Codex protocol JSON.')); return; }
      if (!record(message)) { this.close(new ProviderError('invalid_response', 'Invalid Codex protocol message.')); return; }
      if ('method' in message && 'id' in message) {
        // Never service server-initiated tool/approval/credential requests.
        this.send({ id: message.id, error: { code: -32601, message: 'Client does not support tools or authentication.' } });
      } else if (typeof message.id === 'number') {
        const entry = this.pending.get(message.id);
        if (!entry) continue;
        this.pending.delete(message.id); clearTimeout(entry.timer);
        if ('error' in message) entry.reject(classifyFailure(JSON.stringify(message.error)));
        else entry.resolve(message.result);
      }
    }
  }
  close(error = new ProviderError('cancelled', 'Codex connection closed.')) {
    if (this.failure) return;
    this.failure = error;
    for (const entry of this.pending.values()) { clearTimeout(entry.timer); entry.reject(error); }
    this.pending.clear(); this.child.stdin.end(); terminate(this.child);
  }
}
