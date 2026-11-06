import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { ProviderError, type ProviderAuthStatus, type ProviderDetectResult, type ProviderModelInfo,
  type AnalyzeBoardRequest, type ContinueLessonRequest } from '@openmathtutor/shared';
import { BaseProvider } from './base.js';
import { classifyFailure } from './errors.js';
import { RESPONSE_SCHEMA, SYSTEM_PROMPT, userPrompt } from './prompt.js';

const GEMINI_API_BASE = 'https://generativelanguage.googleapis.com/v1beta';
const GEMINI_FLASH_MODEL = 'gemini-2.0-flash';
const KEY_ENV_VARS = ['GEMINI_API_KEY', 'GOOGLE_API_KEY'];
const AUTH_CACHE_TTL_MS = 30_000;
const LIST_CACHE_TTL_MS = 30_000;
const LIGHT_TIMEOUT_MS = 10_000;

export const GEMINI_KEY_DETAIL = 'Google tutoring uses the end user own API key from Google AI Studio (free tier). No Google account OAuth token is used, stored or forwarded by this app.';

interface GeminiModelInfo { name: string; displayName?: string; supportedGenerationMethods?: string[] }

function providerKeysFilePath(): string {
  const base = process.env.APPDATA || process.env.TEMP || process.env.TMP || process.cwd();
  return join(base, 'OpenMathTutor', 'provider-keys.json');
}

async function readProviderKey(providerId: string): Promise<string | undefined> {
  try {
    const raw = await readFile(providerKeysFilePath(), 'utf8');
    const parsed: unknown = JSON.parse(raw);
    if (typeof parsed !== 'object' || parsed === null) return undefined;
    const entry = (parsed as Record<string, unknown>)[providerId];
    const key = typeof entry === 'object' && entry !== null ? (entry as Record<string, unknown>).apiKey : undefined;
    return typeof key === 'string' && key.trim().length > 0 ? key.trim() : undefined;
  } catch { return undefined; }
}

export class GeminiProvider extends BaseProvider {
  readonly id = 'google' as const;
  private authCache: { key: string; expiresAt: number; status: ProviderAuthStatus } | null = null;
  private listCache: { expiresAt: number; models: GeminiModelInfo[] } | null = null;

  async detect(_signal?: AbortSignal): Promise<ProviderDetectResult> { return { installed: true }; }

  async authStatus(signal?: AbortSignal): Promise<ProviderAuthStatus> {
    const apiKey = await this.resolveApiKey();
    const now = Date.now();
    if (apiKey === undefined) {
      const status: ProviderAuthStatus = { providerId: this.id, authenticated: false, tutoringAvailable: false, keyPresent: false,
        error: 'not_authenticated', detail: 'No Google API key is set. Create one in Google AI Studio (free tier) and set GEMINI_API_KEY or GOOGLE_API_KEY locally or in the local provider-keys file.' };
      this.authCache = { key: '', expiresAt: now + AUTH_CACHE_TTL_MS, status };
      return status;
    }
    if (this.authCache && this.authCache.key === apiKey && now < this.authCache.expiresAt) return this.authCache.status;
    try {
      const models = await this.listGeminiModels(apiKey, signal);
      const status: ProviderAuthStatus = { providerId: this.id, authenticated: true, tutoringAvailable: models.length > 0, keyPresent: true, detail: GEMINI_KEY_DETAIL };
      this.authCache = { key: apiKey, expiresAt: now + AUTH_CACHE_TTL_MS, status };
      return status;
    } catch (error) {
      const e = classifyFailure(error);
      const status: ProviderAuthStatus = { providerId: this.id, authenticated: false, tutoringAvailable: false, keyPresent: true, error: e.code, detail: e.message };
      this.authCache = { key: apiKey, expiresAt: now + AUTH_CACHE_TTL_MS, status };
      return status;
    }
  }

  async availableModels(): Promise<ProviderModelInfo[]> {
    const apiKey = await this.resolveApiKey();
    if (apiKey === undefined) return [];
    if (this.listCache) {
      const cached = this.listCache;
      if (Date.now() < cached.expiresAt) {
        const flash = this.pickFlash(cached.models);
        if (flash) return [{ id: flash.id, label: flash.label, supportsImageInput: true }];
      }
    }
    const models = await this.listGeminiModels(apiKey, AbortSignal.timeout(LIGHT_TIMEOUT_MS));
    const flash = this.pickFlash(models);
    if (!flash) return [];
    return [{ id: flash.id, label: flash.label, supportsImageInput: true }];
  }

  protected async infer(req: AnalyzeBoardRequest | ContinueLessonRequest, signal: AbortSignal): Promise<unknown> {
    if (signal.aborted) throw new ProviderError('cancelled', 'Request cancelled.');
    const apiKey = await this.resolveApiKey();
    if (apiKey === undefined) throw new ProviderError('not_authenticated', 'No Google API key is set. Create one in Google AI Studio and set GEMINI_API_KEY or GOOGLE_API_KEY locally or in the local provider-keys file.');
    const model = req.model && req.model.trim().length > 0 ? req.model.trim() : GEMINI_FLASH_MODEL;
    const controller = new AbortController();
    const onAbort = () => controller.abort();
    signal.addEventListener('abort', onAbort, { once: true });
    let timedOut = false;
    const timer = setTimeout(() => { timedOut = true; controller.abort(); }, this.options.timeoutMs ?? 90_000);
    try {
      const requestBody: Record<string, unknown> = {
        contents: [{ role: 'user', parts: [{ text: userPrompt(req) }] }],
        systemInstruction: { parts: [{ text: SYSTEM_PROMPT }] },
        generationConfig: { responseMimeType: 'application/json', responseSchema: RESPONSE_SCHEMA },
      };
      if ('imageCrop' in req) {
        const crop = req.imageCrop;
        const base64 = crop.dataUrl.slice(crop.dataUrl.indexOf(',') + 1);
        const mimeType = crop.dataUrl.slice(5, crop.dataUrl.indexOf(';')) || 'image/png';
        requestBody.contents = [{ role: 'user', parts: [{ text: userPrompt(req) }, { inlineData: { mimeType, data: base64 } }] }];
      }
      const response = await this.geminiFetch(`/models/${encodeURIComponent(model)}:generateContent`, apiKey, { method: 'POST', body: requestBody }, controller.signal);
      const json: unknown = await response.json();
      const candidate = (json as { candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }> } | undefined)?.candidates?.[0];
      const text = candidate?.content?.parts?.find(p => typeof p.text === 'string')?.text;
      if (typeof text !== 'string' || text.trim().length === 0) throw new ProviderError('invalid_response', 'The Google provider returned an empty response.');
      let parsed: unknown;
      try { parsed = JSON.parse(text); } catch { throw new ProviderError('invalid_response', 'The Google provider returned malformed JSON.'); }
      return parsed;
    } catch (error) {
      if (timedOut) throw new ProviderError('timeout', 'The Google provider request timed out.');
      if (signal.aborted) throw new ProviderError('cancelled', 'Request cancelled.');
      throw error;
    } finally {
      clearTimeout(timer);
      signal.removeEventListener('abort', onAbort);
    }
  }

  private async resolveApiKey(): Promise<string | undefined> {
    const env = this.options.env ?? process.env;
    for (const name of KEY_ENV_VARS) {
      const value = env?.[name];
      if (typeof value === 'string' && value.trim().length > 0) return value.trim();
    }
    return readProviderKey('google');
  }

  private async listGeminiModels(apiKey: string, signal?: AbortSignal): Promise<GeminiModelInfo[]> {
    if (this.listCache) {
      const cached = this.listCache;
      if (Date.now() < cached.expiresAt) return cached.models;
    }
    const response = await this.geminiFetch('/models', apiKey, { method: 'GET' }, signal ?? AbortSignal.timeout(LIGHT_TIMEOUT_MS));
    const json: unknown = await response.json();
    const models: unknown = (json as { models?: unknown } | undefined)?.models;
    const result: GeminiModelInfo[] = [];
    if (Array.isArray(models)) {
      for (const m of models) {
        if (typeof m !== 'object' || m === null) continue;
        const entry = m as Record<string, unknown>;
        const name = entry.name;
        if (typeof name !== 'string') continue;
        const displayName = typeof entry.displayName === 'string' ? entry.displayName : undefined;
        const supportedGenerationMethods = Array.isArray(entry.supportedGenerationMethods)
          ? entry.supportedGenerationMethods.filter((method): method is string => typeof method === 'string')
          : undefined;
        result.push({ name, displayName, supportedGenerationMethods });
      }
    }
    this.listCache = { expiresAt: Date.now() + LIST_CACHE_TTL_MS, models: result };
    return result;
  }

  private async geminiFetch(path: string, apiKey: string, init: { method?: string; body?: unknown }, signal: AbortSignal): Promise<Response> {
    const controller = new AbortController();
    const onAbort = () => controller.abort();
    if (signal.aborted) controller.abort();
    else signal.addEventListener('abort', onAbort, { once: true });
    const timer = setTimeout(() => controller.abort(), this.options.timeoutMs ?? 90_000);
    try {
      const response = await fetch(`${GEMINI_API_BASE}${path}`, {
        method: init.method ?? 'GET',
        headers: { 'Content-Type': 'application/json', 'x-goog-api-key': apiKey },
        ...(init.body === undefined ? {} : { body: JSON.stringify(init.body) }),
        signal: controller.signal,
      });
      if (response.ok) return response;
      if (response.status === 401 || response.status === 403) throw new ProviderError('not_authenticated', 'The Google API key was rejected. Create a new key in Google AI Studio and set it locally.');
      if (response.status === 429) throw new ProviderError('rate_limited', 'The Google provider usage limit was reached. Try again later.');
      throw new ProviderError('provider_unavailable', `The Google Gemini service returned status ${response.status}.`);
    } finally {
      clearTimeout(timer);
      if (signal.aborted) controller.abort();
      else signal.removeEventListener('abort', onAbort);
    }
  }

  private pickFlash(models: GeminiModelInfo[]): { id: string; label: string } | null {
    const usable = models.filter(m => Array.isArray(m.supportedGenerationMethods) && m.supportedGenerationMethods.includes('generateContent'));
    const flash = usable.find(m => m.name === `models/${GEMINI_FLASH_MODEL}`) ?? usable.find(m => /flash/i.test(m.name)) ?? usable[0];
    if (!flash) return null;
    const id = flash.name.replace(/^models\//, '');
    return { id, label: flash.displayName ?? id };
  }
}
