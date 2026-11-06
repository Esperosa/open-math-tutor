import { afterEach, describe, expect, it, vi } from 'vitest';
import { ProviderError } from '@openmathtutor/shared';
import { GeminiProvider, GEMINI_KEY_DETAIL } from '../src/providers/geminiProvider.js';
import { RESPONSE_SCHEMA } from '../src/providers/prompt.js';
import { analysis, lesson, response } from './fixtures.js';

const GEMINI_BASE = 'https://generativelanguage.googleapis.com/v1beta';
const GEMINI_FLASH = 'gemini-2.0-flash';

function generateContentResponse() {
  return new Response(JSON.stringify({ candidates: [{ content: { parts: [{ text: JSON.stringify(response) }] } }] }), { status: 200 });
}
function modelsResponse(models: unknown[] = [{ name: `models/${GEMINI_FLASH}`, displayName: 'Gemini 2.0 Flash', supportedGenerationMethods: ['generateContent'] }]) {
  return new Response(JSON.stringify({ models }), { status: 200 });
}

describe('Gemini invocation contract (mocked REST, NOT real inference)', () => {
  afterEach(() => { vi.unstubAllGlobals(); vi.restoreAllMocks(); });

  it('reports no key and never calls the API when none is configured', async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);
    const provider = new GeminiProvider({ env: {} });
    const auth = await provider.authStatus();
    expect(auth).toMatchObject({ providerId: 'google', authenticated: false, tutoringAvailable: false, keyPresent: false, error: 'not_authenticated' });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('authenticates via a light models.list call when the key works', async () => {
    const fetchMock = vi.fn(async (_url: string, init?: RequestInit) => new Response(JSON.stringify({ models: [{ name: `models/${GEMINI_FLASH}`, displayName: 'Gemini 2.0 Flash', supportedGenerationMethods: ['generateContent'] }] }), { status: 200 }));
    vi.stubGlobal('fetch', fetchMock);
    const provider = new GeminiProvider({ env: { GEMINI_API_KEY: 'test-key' } });
    const auth = await provider.authStatus();
    expect(auth).toMatchObject({ providerId: 'google', authenticated: true, tutoringAvailable: true, keyPresent: true });
    expect(auth.error).toBeUndefined();
    expect(auth.detail).toContain('Google AI Studio');
    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, init] = fetchMock.mock.calls[0]!;
    expect(String(url)).toBe(`${GEMINI_BASE}/models`);
    expect(init?.method).toBe('GET');
    expect((init?.headers as Record<string, string>)['x-goog-api-key']).toBe('test-key');
  });

  it('maps a rejected Google API key to not_authenticated without leaking the key or the response body', async () => {
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    const fetchMock = vi.fn(async () => new Response(JSON.stringify({ error: { message: 'API key invalid' } }), { status: 401 }));
    vi.stubGlobal('fetch', fetchMock);
    const provider = new GeminiProvider({ env: { GEMINI_API_KEY: 'test-key' } });
    const auth = await provider.authStatus();
    expect(auth).toMatchObject({ providerId: 'google', authenticated: false, tutoringAvailable: false, keyPresent: true, error: 'not_authenticated' });
    expect(auth.detail).not.toContain('test-key');
    const failure = await provider.continueLesson({ ...lesson, model: GEMINI_FLASH }, new AbortController().signal).then(() => null, (e: unknown) => e);
    expect(failure).toBeInstanceOf(ProviderError);
    expect((failure as ProviderError).code).toBe('not_authenticated');
    expect((failure as ProviderError).message).not.toContain('test-key');
    expect(errorSpy).not.toHaveBeenCalled();
  });

  it('maps a Google usage limit to rate_limited', async () => {
    const fetchMock = vi.fn(async () => new Response(JSON.stringify({ error: { message: 'quota exceeded' } }), { status: 429 }));
    vi.stubGlobal('fetch', fetchMock);
    const provider = new GeminiProvider({ env: { GEMINI_API_KEY: 'test-key' } });
    const auth = await provider.authStatus();
    expect(auth).toMatchObject({ providerId: 'google', authenticated: false, tutoringAvailable: false, keyPresent: true, error: 'rate_limited' });
  });

  it('returns the recommended flash model with image input support from the live model list', async () => {
    const fetchMock = vi.fn(async () => modelsResponse());
    vi.stubGlobal('fetch', fetchMock);
    const provider = new GeminiProvider({ env: { GEMINI_API_KEY: 'test-key' } });
    await expect(provider.authStatus());
    await expect(provider.availableModels()).resolves.toEqual([{ id: GEMINI_FLASH, label: 'Gemini 2.0 Flash', supportsImageInput: true }]);
    expect(fetchMock).toHaveBeenCalledTimes(2);
    const [url] = fetchMock.mock.calls[1]!;
    expect(String(url)).toBe(`${GEMINI_BASE}/models`);
  });

  it('returns no models when the API key is missing', async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);
    const provider = new GeminiProvider({ env: {} });
    await expect(provider.availableModels()).resolves.toEqual([]);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('analyzeBoard sends the crop as Gemini inlineData and returns the validated structured response', async () => {
    const fetchMock = vi.fn(async () => generateContentResponse());
    vi.stubGlobal('fetch', fetchMock);
    const provider = new GeminiProvider({ env: { GEMINI_API_KEY: 'test-key' } });
    const result = await provider.analyzeBoard({ ...analysis, model: GEMINI_FLASH }, new AbortController().signal);
    expect(result).toEqual(response);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, init] = fetchMock.mock.calls[0]!;
    expect(String(url)).toBe(`${GEMINI_BASE}/models/${GEMINI_FLASH}:generateContent`);
    expect(init?.method).toBe('POST');
    const body = JSON.parse(String(init?.body)) as Record<string, unknown>;
    expect(body.systemInstruction).toEqual({ parts: [{ text: expect.any(String) }] });
    expect(body.generationConfig).toEqual({ responseMimeType: 'application/json', responseSchema: RESPONSE_SCHEMA });
    const contents = body.contents as Array<{ role: string; parts: Array<Record<string, unknown>> }>;
    expect(contents[0]?.role).toBe('user');
    expect(contents[0]?.parts).toHaveLength(2);
    expect(contents[0]?.parts[1]).toEqual({ inlineData: { mimeType: 'image/png', data: 'aGVsbG8=' } });
  });

  it('continueLesson sends text only and returns the validated structured response', async () => {
    const fetchMock = vi.fn(async () => generateContentResponse());
    vi.stubGlobal('fetch', fetchMock);
    const provider = new GeminiProvider({ env: { GEMINI_API_KEY: 'test-key' } });
    const result = await provider.continueLesson({ ...lesson, model: GEMINI_FLASH }, new AbortController().signal);
    expect(result).toEqual(response);
    const [url, init] = fetchMock.mock.calls[0]!;
    expect(String(url)).toBe(`${GEMINI_BASE}/models/${GEMINI_FLASH}:generateContent`);
    const body = JSON.parse(String(init?.body)) as Record<string, unknown>;
    const contents = body.contents as Array<{ role: string; parts: Array<Record<string, unknown>> }>;
    expect(contents[0]?.parts).toHaveLength(1);
    expect(contents[0]?.parts[0]).toHaveProperty('text');
    expect(contents[0]?.parts[0]).not.toHaveProperty('inlineData');
  });

  it('maps malformed JSON from the provider to invalid_response', async () => {
    const fetchMock = vi.fn(async () => new Response(JSON.stringify({ candidates: [{ content: { parts: [{ text: 'not json' }] } }] }), { status: 200 }));
    vi.stubGlobal('fetch', fetchMock);
    const provider = new GeminiProvider({ env: { GEMINI_API_KEY: 'test-key' } });
    await expect(provider.continueLesson({ ...lesson, model: GEMINI_FLASH }, new AbortController().signal))
      .rejects.toMatchObject({ code: 'invalid_response' });
  });

  it('maps an inference timeout to the shared timeout error code', async () => {
    const fetchMock = vi.fn((_url: string, init?: RequestInit) => new Promise<Response>((_resolve, reject) => {
      init?.signal?.addEventListener('abort', () => reject(new Error('aborted')));
    }));
    vi.stubGlobal('fetch', fetchMock);
    const provider = new GeminiProvider({ env: { GEMINI_API_KEY: 'test-key' }, timeoutMs: 50 });
    const controller = new AbortController();
    await expect(provider.continueLesson({ ...lesson, model: GEMINI_FLASH }, controller.signal)).rejects.toMatchObject({ code: 'timeout' });
  });

  it('maps a cancelled provider call to the shared cancelled error code', async () => {
    const fetchMock = vi.fn((_url: string, init?: RequestInit) => new Promise<Response>((_resolve, reject) => {
      const onAbort = () => reject(new Error('aborted'));
      if (init?.signal?.aborted) { reject(new Error('aborted')); return; }
      init?.signal?.addEventListener('abort', onAbort);
    }));
    vi.stubGlobal('fetch', fetchMock);
    const provider = new GeminiProvider({ env: { GEMINI_API_KEY: 'test-key' }, timeoutMs: 30_000 });
    const controller = new AbortController();
    const pending = provider.continueLesson({ ...lesson, model: GEMINI_FLASH }, controller.signal);
    await new Promise(resolve => setTimeout(resolve, 20));
    controller.abort();
    await expect(pending).rejects.toMatchObject({ code: 'cancelled' });
  });
});
