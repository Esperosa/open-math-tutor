import { afterEach, describe, expect, it } from 'vitest';
import { ProviderError, type TutorProvider, type ProviderErrorCode } from '@openmathtutor/shared';
import { createServer } from '../src/server.js';
import { lesson, analysis, response } from './fixtures.js';

// Routing-only test double. It returns a fixed contract object, NOT simulated
// model inference; provider integration is separately opt-in.
function routingProvider(error?: ProviderErrorCode): TutorProvider {
  const result = async () => { if (error) throw new ProviderError(error, 'Safe error detail.'); return response; };
  return { id: 'codex', detect: async () => ({ installed: false }),
    authStatus: async () => ({ providerId: 'codex', authenticated: false, error: 'cli_missing' }),
    availableModels: async () => [], analyzeBoard: result, continueLesson: result,
    cancel: async () => {}, stream: result };
}
const headers = { host: '127.0.0.1:4178', origin: 'http://localhost:5173' };
const apps: ReturnType<typeof createServer>[] = [];
function server(error?: ProviderErrorCode) {
  const app = createServer({ providers: { codex: routingProvider(error), claude: { ...routingProvider(error), id: 'claude' } } });
  apps.push(app); return app;
}
afterEach(async () => { await Promise.all(apps.splice(0).map(app => app.close())); });

describe('pinned HTTP contract (routing only)', () => {
  it('reports every provider independently', async () => {
    const result = await server().inject({ url: '/providers', headers });
    expect(result.statusCode).toBe(200); expect(result.json().providers.map((p: { id: string }) => p.id)).toEqual(['codex', 'claude']);
  });
  it.each(['/providers/codex/analyze-board', '/providers/claude/continue-lesson'])('returns a validated response from %s', async url => {
    const result = await server().inject({ method: 'POST', url, headers, payload: url.endsWith('analyze-board') ? analysis : lesson });
    expect(result.statusCode).toBe(200); expect(result.json()).toEqual(response);
  });
  it.each(['cli_missing', 'not_authenticated', 'rate_limited', 'provider_unavailable', 'multimodal_unsupported', 'tos_restricted', 'cancelled', 'timeout', 'invalid_response', 'unknown'] as const)
    ('preserves exact 502 error code: %s', async code => {
      const result = await server(code).inject({ method: 'POST', url: '/providers/codex/continue-lesson', headers, payload: lesson });
      expect(result.statusCode).toBe(502); expect(result.json()).toEqual({ error: code, detail: 'Safe error detail.' });
    });
  it.each(['analyze-board', 'continue-lesson', 'cancel'])('rejects unknown provider for %s', async operation => {
    const result = await server().inject({ method: 'POST', url: `/providers/other/${operation}`, headers, payload: {} });
    expect(result.statusCode).toBe(404); expect(result.json()).toEqual({ error: 'unknown_provider' });
  });
  it('cancel is idempotent with an empty 204', async () => {
    const app = server();
    for (let i = 0; i < 2; i++) {
      const r = await app.inject({ method: 'POST', url: '/providers/codex/cancel', headers, payload: { requestId: 'unknown' } });
      expect(r.statusCode).toBe(204); expect(r.body).toBe('');
    }
  });
  it.each(['analyze-board', 'continue-lesson', 'cancel'])('rejects malformed %s requests', async operation => {
    const r = await server().inject({ method: 'POST', url: `/providers/codex/${operation}`, headers, payload: {} });
    expect(r.statusCode).toBe(400); expect(r.json()).toEqual({ error: 'invalid_request' });
  });
  it.each([undefined, 'null', 'https://attacker.invalid', 'http://localhost:5173.attacker.invalid'])('rejects disallowed/missing origin %s', async origin => {
    const r = await server().inject({ url: '/providers', headers: { host: headers.host, ...(origin ? { origin } : {}) } });
    expect(r.statusCode).toBe(403); expect(r.json()).toEqual({ error: 'forbidden_origin' });
  });
  it('accepts the packaged custom-scheme origin but rejects rebinding hosts', async () => {
    const app = server();
    expect((await app.inject({ url: '/providers', headers: { ...headers, origin: 'app://openmathtutor' } })).statusCode).toBe(200);
    expect((await app.inject({ url: '/providers', headers: { ...headers, host: 'attacker.invalid' } })).statusCode).toBe(403);
  });
  it('handles CORS preflight and rejects non-JSON cross-site simple POSTs', async () => {
    const app = server();
    const r = await app.inject({ method: 'OPTIONS', url: '/verify-step', headers: { ...headers, 'access-control-request-method': 'POST', 'access-control-request-headers': 'content-type' } });
    expect(r.statusCode).toBe(204); expect(r.headers['access-control-allow-origin']).toBe(headers.origin);
    expect((await app.inject({ method: 'POST', url: '/verify-step', headers: { ...headers, 'content-type': 'text/plain' }, payload: '{}' })).statusCode).toBe(415);
  });
  it('rejects malformed JSON without exposing parser output', async () => {
    const r = await server().inject({ method: 'POST', url: '/verify-step', headers: { ...headers, 'content-type': 'application/json' }, payload: '{not-json' });
    expect(r.statusCode).toBe(400); expect(r.json()).toEqual({ error: 'invalid_request' });
  });
  it('applies the smaller verifier body limit and rejects executable/raw math input', async () => {
    const app = server();
    const large = await app.inject({ method: 'POST', url: '/verify-step', headers, payload: { content: 'x'.repeat(65_000) } });
    expect(large.statusCode).toBe(413); expect(large.json()).toEqual({ error: 'payload_too_large' });
    const raw = await app.inject({ method: 'POST', url: '/verify-step', headers, payload: { topic: 'arithmetic', task_statement: null, previous_step: null, current_step: '__import__("os")' } });
    expect(raw.statusCode).toBe(400); expect(raw.json()).toEqual({ error: 'invalid_request' });
  });
  it('actually listens on loopback and enforces origin on a real HTTP request', async () => {
    const app = server();
    await app.listen({ port: 0, host: '127.0.0.1' });
    const address = app.server.address();
    expect(typeof address).toBe('object');
    if (!address || typeof address === 'string') throw new Error('No listening address.');
    expect(address.address).toBe('127.0.0.1');
    const good = await fetch(`http://127.0.0.1:${address.port}/providers`, { headers: { Origin: headers.origin } });
    expect(good.status).toBe(200);
    const bad = await fetch(`http://127.0.0.1:${address.port}/providers`);
    expect(bad.status).toBe(403);
  });
  it('does not disconnect an otherwise valid provider call at ten seconds', async () => {
    const provider = routingProvider();
    provider.continueLesson = async () => {
      await new Promise(resolve => setTimeout(resolve, 10_200)); return response;
    };
    const app = createServer({ providers: { codex: provider, claude: { ...provider, id: 'claude' } } });
    apps.push(app);
    await app.listen({ port: 0, host: '127.0.0.1' });
    const address = app.server.address();
    if (!address || typeof address === 'string') throw new Error('No listening address.');
    const result = await fetch(`http://127.0.0.1:${address.port}/providers/codex/continue-lesson`, {
      method: 'POST', headers: { Origin: headers.origin, 'Content-Type': 'application/json' }, body: JSON.stringify(lesson),
    });
    expect(result.status).toBe(200); expect(await result.json()).toEqual(response);
  }, 15_000);
});
