import { afterEach, expect, it, vi } from 'vitest';
import { bridge, BridgeError, parseResponse } from './api';
afterEach(() => vi.unstubAllGlobals());
it('threads abort through the pinned manual and cancel endpoints', async () => {
  const response = { requestId: 'r', boardRevision: 1, recognizedSteps: [], confidence: 1, firstErrorStepId: null,
    verifierStatus: 'correct', pedagogicalResponse: 'OK', ttsText: 'OK', boardActions: [], needsClarification: null };
  const fetchMock = vi.fn().mockResolvedValueOnce(new Response(JSON.stringify(response))).mockResolvedValueOnce(new Response(null, { status: 204 }));
  vi.stubGlobal('fetch', fetchMock); const signal = new AbortController().signal;
  const request = { requestId: 'r', boardRevision: 1, mode: 'hint' as const, task: { topic: 'a' }, stepHistory: [], locale: 'cs' as const, model: 'm' };
  await bridge.continue('codex', request, signal); await bridge.cancel('codex', 'r', signal);
  expect(fetchMock).toHaveBeenNthCalledWith(1, 'http://127.0.0.1:4178/providers/codex/continue-lesson', expect.objectContaining({ signal, body: JSON.stringify(request) }));
  expect(fetchMock).toHaveBeenNthCalledWith(2, 'http://127.0.0.1:4178/providers/codex/cancel', expect.objectContaining({ signal, body: '{"requestId":"r"}' }));
});
it('fails closed on unavailability, exact provider errors, and invalid envelopes', async () => {
  vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new TypeError('network')));
  await expect(bridge.providers(new AbortController().signal)).rejects.toEqual(new BridgeError('bridgeUnavailable'));
  vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response('{"error":"rate_limited","detail":"private"}', { status: 502 })));
  await expect(bridge.providers(new AbortController().signal)).rejects.toEqual(new BridgeError('rate_limited'));
  expect(() => parseResponse({ boardActions: [{ type: 'script' }] })).toThrow('invalid_response');
});
