import { createServer as httpServer, type Server } from 'node:http';
import { afterEach, describe, expect, it } from 'vitest';
import { parseMathStatement } from '@openmathtutor/shared';
import { VerifierClient, validVerifyRequest } from '../src/verifierClient.js';
import { createServer } from '../src/server.js';

const input = { topic: 'arithmetic' as const, task_statement: null, previous_step: null, current_step: parseMathStatement('1+1') };
const verdict = { status: 'equivalent', reason: 'same_value', detail: 'Equal.', counterexample: null };
const servers: Server[] = [];
afterEach(async () => { await Promise.all(servers.splice(0).map(s => new Promise<void>(resolve => s.close(() => resolve())))); });
async function upstream(status: number, body: unknown) {
  let received: unknown;
  const server = httpServer(async (req, res) => {
    if (req.url === '/health') { res.setHeader('content-type', 'application/json'); res.end('{"status":"ok"}'); return; }
    let data = ''; for await (const chunk of req) data += chunk;
    received = JSON.parse(data);
    res.writeHead(status, { 'content-type': 'application/json' }); res.end(JSON.stringify(body));
  });
  servers.push(server);
  await new Promise<void>(resolve => server.listen(0, '127.0.0.1', resolve));
  const address = server.address();
  if (!address || typeof address === 'string') throw new Error('No server address.');
  return { client: new VerifierClient(`http://127.0.0.1:${address.port}`, 1000), received: () => received };
}

describe('verifier contract validation and transport (no math inference mocked)', () => {
  it('accepts AST and rejects raw strings, unknown kinds, too many nodes/symbols', () => {
    expect(validVerifyRequest(input)).toBe(true);
    expect(validVerifyRequest({ ...input, topic: ['arithmetic'] })).toBe(false);
    expect(validVerifyRequest({ ...input, current_step: { form: 'relation', value: { op: ['eq'], lhs: { kind: 'num', value: 1 }, rhs: { kind: 'num', value: 1 } } } })).toBe(false);
    for (const current_step of ['__import__("os")', { form: 'expression', value: { kind: 'exec', value: 'x' } }, { form: 'expression', value: { kind: 'symbol', name: 'import' } }]) {
      expect(validVerifyRequest({ ...input, current_step })).toBe(false);
    }
    let value: unknown = { kind: 'num', value: 1 };
    for (let i = 0; i < 201; i++) value = { kind: 'neg', operand: value };
    expect(validVerifyRequest({ ...input, current_step: { form: 'expression', value } })).toBe(false);
  });
  it('forwards request, status and verdict unchanged', async () => {
    const mock = await upstream(200, verdict);
    const app = createServer({ verifier: mock.client });
    try {
      const result = await app.inject({ method: 'POST', url: '/verify-step', headers: { host: '127.0.0.1:4178', origin: 'http://localhost:5173' }, payload: input });
      expect(result.statusCode).toBe(200); expect(result.json()).toEqual(verdict); expect(mock.received()).toEqual(input);
      expect((await app.inject({ url: '/health', headers: { host: '127.0.0.1:4178', origin: 'http://localhost:5173' } })).json()).toEqual({ status: 'ok', verifier: 'ok' });
    } finally { await app.close(); }
  });
  it('preserves verifier rejection status and body', async () => {
    const body = { detail: 'Invalid statement' };
    const mock = await upstream(422, body);
    expect(await mock.client.verifyStep(input)).toEqual({ statusCode: 422, body });
  });
  it('rejects a malformed upstream verdict instead of trusting it', async () => {
    const mock = await upstream(200, { status: 'correct', reason: 'bad', detail: '' });
    await expect(mock.client.verifyStep(input)).rejects.toThrow('invalid response');
  });
  it('rejects arrays impersonating verifier enum strings', async () => {
    const mock = await upstream(200, { ...verdict, status: ['equivalent'] });
    await expect(mock.client.verifyStep(input)).rejects.toThrow('invalid response');
  });
  it('rejects non-loopback verifier URLs', () => {
    for (const url of ['http://attacker.invalid', 'http://127.0.0.1@attacker.invalid', 'http://127.0.0.1/path']) expect(() => new VerifierClient(url)).toThrow('loopback');
  });
  it('reports unreachable verifier health and a structured proxy failure', async () => {
    const mock = await upstream(200, verdict);
    const server = servers.pop()!; await new Promise<void>(resolve => server.close(() => resolve()));
    const app = createServer({ verifier: mock.client });
    try {
      const headers = { host: '127.0.0.1:4178', origin: 'http://localhost:5173' };
      expect((await app.inject({ url: '/health', headers })).json()).toEqual({ status: 'ok', verifier: 'unreachable' });
      const r = await app.inject({ method: 'POST', url: '/verify-step', headers, payload: input });
      expect(r.statusCode).toBe(502); expect(r.json().error).toBe('verifier_unavailable');
    } finally { await app.close(); }
  });
});

describe('real local Python verifier integration', () => {
  it('calls /verify-step if the independent service is running', async context => {
    const client = new VerifierClient();
    if (!await client.health()) {
      console.info('SKIP: Python verifier not reachable at http://127.0.0.1:4179; start it to run this integration test.');
      context.skip(); return;
    }
    const result = await client.verifyStep({ ...input, previous_step: parseMathStatement('2') });
    expect(result.statusCode).toBe(200); expect(result.body).toMatchObject({ status: 'equivalent' });
  });
});
