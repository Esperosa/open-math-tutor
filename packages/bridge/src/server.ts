import Fastify from 'fastify';
import { ProviderError, type TutorProvider, type ProviderId, type ProviderModelInfo } from '@openmathtutor/shared';
import { CodexProvider } from './providers/codexProvider.js';
import { ClaudeProvider } from './providers/claudeProvider.js';
import { classifyFailure } from './providers/errors.js';
import { record, text, validRequest, validateResponse } from './validation.js';
import { VerifierClient, validVerifyRequest } from './verifierClient.js';

export const ALLOWED_ORIGINS = ['http://localhost:5173', 'app://openmathtutor'] as const;
export interface BridgeOptions {
  providers?: Record<ProviderId, TutorProvider>;
  verifier?: VerifierClient;
}

export function createServer(options: BridgeOptions = {}) {
  const app = Fastify({ logger: false, bodyLimit: 6_100_000, requestTimeout: 120_000,
    connectionTimeout: 0, onProtoPoisoning: 'error', onConstructorPoisoning: 'error' });
  const providers = options.providers ?? { codex: new CodexProvider(), claude: new ClaudeProvider() };
  const verifier = options.verifier ?? new VerifierClient();
  let active = 0;
  app.addHook('onRequest', async (req, reply) => {
    reply.header('X-Content-Type-Options', 'nosniff').header('Cache-Control', 'no-store').header('Vary', 'Origin');
    // Host check prevents DNS rebinding even for clients forging an allowed Origin.
    if (!/^127\.0\.0\.1(?::\d{1,5})?$/.test(req.headers.host ?? '')) return reply.code(403).send({ error: 'forbidden_host' });
    const origin = req.headers.origin;
    if (typeof origin !== 'string' || !(ALLOWED_ORIGINS as readonly string[]).includes(origin)) {
      return reply.code(403).send({ error: 'forbidden_origin' });
    }
    reply.header('Access-Control-Allow-Origin', origin);
    if (req.method === 'OPTIONS') {
      if (req.headers['access-control-request-method'] && !['GET', 'POST'].includes(req.headers['access-control-request-method'] as string)) return reply.code(403).send({ error: 'forbidden_method' });
      if (req.headers['access-control-request-headers'] && !/^content-type$/i.test(req.headers['access-control-request-headers'] as string)) return reply.code(403).send({ error: 'forbidden_header' });
      return reply.header('Access-Control-Allow-Methods', 'GET, POST, OPTIONS').header('Access-Control-Allow-Headers', 'Content-Type').code(204).send();
    }
    if (req.method === 'POST' && !/^application\/json(?:\s*;.*)?$/i.test(req.headers['content-type'] ?? '')) {
      return reply.code(415).send({ error: 'unsupported_media_type' });
    }
  });
  app.options('/*', async (_req, reply) => reply.code(204).send());
  app.setErrorHandler((error, _req, reply) => {
    const status = record(error) ? error.statusCode : undefined;
    if (status === 413) return reply.code(413).send({ error: 'payload_too_large' });
    if (status === 400 || status === 415) return reply.code(status).send({ error: 'invalid_request' });
    const e = classifyFailure(error);
    return reply.code(502).send({ error: e.code, detail: e.message });
  });
  app.setNotFoundHandler((_req, reply) => reply.code(404).send({ error: 'not_found' }));
  app.get('/health', async () => ({ status: 'ok', verifier: await verifier.health() ? 'ok' : 'unreachable' }));
  app.get('/providers', async () => ({ providers: await Promise.all(Object.values(providers).map(async provider => {
    let detect;
    try { detect = await provider.detect(); }
    catch (e) {
      const error = classifyFailure(e);
      return { id: provider.id, detect: { installed: error.code !== 'cli_missing' },
        authStatus: { providerId: provider.id, authenticated: false, tutoringAvailable: false, error: error.code, detail: error.message }, models: [] };
    }
    const authStatus = await provider.authStatus();
    let models: ProviderModelInfo[];
    try { models = detect.installed ? await provider.availableModels() : []; }
    catch { models = []; } // discovery failure must not hide the other provider
    return { id: provider.id, detect, authStatus, models };
  })) }));

  for (const operation of ['analyze-board', 'continue-lesson', 'cancel'] as const) {
    app.post<{ Params: { id: string } }>(`/providers/:id/${operation}`, async (req, reply) => {
      const provider = Object.hasOwn(providers, req.params.id) ? providers[req.params.id as ProviderId] : undefined;
      if (!provider) return reply.code(404).send({ error: 'unknown_provider' });
      if (operation === 'cancel') {
        if (!record(req.body) || !text(req.body.requestId, 128)) return reply.code(400).send({ error: 'invalid_request' });
        await provider.cancel(req.body.requestId); return reply.code(204).send();
      }
      const body = req.body;
      if (!(operation === 'analyze-board' ? validRequest(body, true) : validRequest(body, false))) return reply.code(400).send({ error: 'invalid_request' });
      if (active >= 2) return reply.code(502).send({ error: 'provider_unavailable', detail: 'Bridge is busy. Retry after the current requests finish.' });
      active++;
      const controller = new AbortController();
      const disconnect = () => { if (!reply.raw.writableEnded) controller.abort(); };
      reply.raw.once('close', disconnect);
      try {
        if (operation === 'analyze-board' && validRequest(body, true)) return validateResponse(await provider.analyzeBoard(body, controller.signal), body);
        if (validRequest(body, false)) return validateResponse(await provider.continueLesson(body, controller.signal), body);
        throw new ProviderError('invalid_response', 'Invalid request.');
      } catch (error) {
        const e = classifyFailure(error); return reply.code(502).send({ error: e.code, detail: e.message });
      } finally { active--; reply.raw.off('close', disconnect); }
    });
  }
  app.post('/verify-step', { bodyLimit: 64_000 }, async (req, reply) => {
    if (!validVerifyRequest(req.body)) return reply.code(400).send({ error: 'invalid_request' });
    try {
      const result = await verifier.verifyStep(req.body);
      return reply.code(result.statusCode).send(result.body);
    } catch { return reply.code(502).send({ error: 'verifier_unavailable', detail: 'Start the local Python verifier service.' }); }
  });
  return app;
}
