import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  cancelPiperSpeech, classifyPiperError, downloadPiperVoice, isAbortError,
  onPiperSpeaking, PiperError, speakPiper, storedPiperVoices, warmPiperRuntime,
} from './piperTts';

const vits = vi.hoisted(() => ({ stored: vi.fn<(ids: string[]) => Promise<string[]>>() }));
vi.mock('@diffusionstudio/vits-web', () => ({
  HF_BASE: 'https://hf.example/main',
  ONNX_BASE: 'https://ort.example/1.18.0/',
  WASM_BASE: 'https://wasm.example/piper_phonemize',
  PATH_MAP: { 'cs_CZ-jirka-medium': 'cs/cs_CZ/jirka-medium/cs_CZ-jirka-medium.onnx' },
  stored: vits.stored,
}));

const MODEL_URL = 'https://hf.example/main/cs/cs_CZ/jirka-medium/cs_CZ-jirka-medium.onnx';
const realNavigator = navigator;

interface FileEntry { name: string; chunks: Uint8Array[] }
function stubOpfs() {
  const written: FileEntry[] = [];
  const root = {
    async getDirectoryHandle() {
      return {
        async getFileHandle(name: string) {
          return {
            async createWritable() {
              const entry: FileEntry = { name, chunks: [] };
              written.push(entry);
              return {
                async write(chunk: Uint8Array) { entry.chunks.push(chunk); },
                async close() {},
                async abort() {},
              };
            },
          };
        },
      };
    },
  };
  vi.stubGlobal('navigator', { ...navigator, storage: { getDirectory: async () => root } });
  return written;
}

function okResponse(bytes: Uint8Array<ArrayBuffer>) {
  return {
    ok: true, status: 200,
    body: {
      getReader() {
        let sent = false;
        return { async read() {
          if (sent) return { done: true, value: undefined };
          sent = true;
          return { done: false, value: bytes };
        } };
      },
    },
    async blob() { return new Blob([bytes]); },
  };
}

afterEach(() => {
  vi.unstubAllGlobals();
  vits.stored.mockReset();
});

describe('downloading a voice', () => {
  it('stores the model and its config in the browser cache and reports bytes', async () => {
    const written = stubOpfs();
    const fetchMock = vi.fn<(url: string) => Promise<ReturnType<typeof okResponse>>>(async () => okResponse(new Uint8Array([1, 2, 3])));
    vi.stubGlobal('fetch', fetchMock);
    const progress: Array<{ loaded: number; total: number }> = [];

    await downloadPiperVoice('cs_CZ-jirka-medium', {
      expectedBytes: 1000,
      onProgress: (loaded, total) => progress.push({ loaded, total }),
    });

    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(fetchMock.mock.calls[0][0]).toBe(MODEL_URL);
    expect(fetchMock.mock.calls[1][0]).toBe(`${MODEL_URL}.json`);
    expect(written.map(entry => entry.name)).toEqual(['cs_CZ-jirka-medium.onnx', 'cs_CZ-jirka-medium.onnx.json']);
    expect(progress.at(-1)).toEqual({ loaded: 6, total: 1000 });
    expect(progress.map(p => p.loaded)).toEqual([3, 6]);
  });

  it('falls back to the whole body when the stream is unavailable', async () => {
    stubOpfs();
    vi.stubGlobal('fetch', vi.fn(async () => ({ ok: true, status: 200, body: null, async blob() { return new Blob([new Uint8Array([9])]); } })));
    await downloadPiperVoice('cs_CZ-jirka-medium');
  });

  it('refuses a voice the package does not know', async () => {
    stubOpfs();
    await expect(downloadPiperVoice('nope')).rejects.toThrowError(/unknown voice/);
  });

  it('reports an unreachable model as an offline problem, not a crash', async () => {
    stubOpfs();
    vi.stubGlobal('fetch', vi.fn(async () => { throw new TypeError('Failed to fetch'); }));
    const failure = await downloadPiperVoice('cs_CZ-jirka-medium').catch((error: unknown) => error);
    expect(failure).toBeInstanceOf(PiperError);
    expect((failure as PiperError).kind).toBe('offline');
  });

  it('treats a missing model as offline and a broken cache as unknown', async () => {
    stubOpfs();
    vi.stubGlobal('fetch', vi.fn(async () => ({ ok: false, status: 404, body: null })));
    const notFound = await downloadPiperVoice('cs_CZ-jirka-medium').catch((error: unknown) => error);
    expect((notFound as PiperError).kind).toBe('offline');

    vi.stubGlobal('navigator', realNavigator);
    vi.stubGlobal('fetch', vi.fn(async () => okResponse(new Uint8Array([1]))));
    const noCache = await downloadPiperVoice('cs_CZ-jirka-medium').catch((error: unknown) => error);
    expect(noCache).toBeInstanceOf(PiperError);
    expect((noCache as PiperError).kind).toBe('unknown');
  });

  it('stops immediately when the user cancels', async () => {
    stubOpfs();
    const controller = new AbortController();
    vi.stubGlobal('fetch', vi.fn((_url: string, init?: RequestInit) => new Promise((_resolve, reject) => {
      init?.signal?.addEventListener('abort', () => reject(new DOMException('canceled', 'AbortError')));
    })));
    const pending = downloadPiperVoice('cs_CZ-jirka-medium', { signal: controller.signal });
    const settled = pending.then(() => 'resolved', (error: unknown) => error);
    controller.abort();
    const result = await settled;
    expect(result).not.toBe('resolved');
    expect(isAbortError(result)).toBe(true);
  });
});

describe('error triage', () => {
  it('separates offline, memory and unknown failures', () => {
    expect(classifyPiperError(new TypeError('Failed to fetch'))).toBe('offline');
    expect(classifyPiperError(new Error('net::ERR_CONNECTION_RESET'))).toBe('offline');
    expect(classifyPiperError(new RangeError('Array buffer allocation failed'))).toBe('memory');
    expect(classifyPiperError(new PiperError('memory'))).toBe('memory');
    expect(classifyPiperError(new Error('something else'))).toBe('unknown');
    expect(classifyPiperError('plain string')).toBe('unknown');
  });

  it('recognises cancellation by name', () => {
    expect(isAbortError(new DOMException('canceled', 'AbortError'))).toBe(true);
    expect(isAbortError(new Error('canceled'))).toBe(false);
    expect(isAbortError(null)).toBe(false);
  });
});

describe('stored models', () => {
  it('lists the cached voices', async () => {
    vits.stored.mockResolvedValueOnce(['cs_CZ-jirka-medium']);
    await expect(storedPiperVoices()).resolves.toEqual(['cs_CZ-jirka-medium']);
  });

  it('stays silent when the cache cannot be read', async () => {
    vits.stored.mockRejectedValueOnce(new Error('no cache'));
    await expect(storedPiperVoices()).resolves.toEqual([]);
  });
});

describe('runtime warm-up', () => {
  it('asks for every CDN piece the synthesiser needs', async () => {
    const fetchMock = vi.fn<(url: string) => Promise<{ ok: boolean }>>(async () => ({ ok: true }));
    vi.stubGlobal('fetch', fetchMock);
    warmPiperRuntime();
    await Promise.resolve();
    expect(fetchMock).toHaveBeenCalledTimes(3);
    const urls = fetchMock.mock.calls.map(call => call[0]);
    expect(urls).toContain('https://ort.example/1.18.0/ort-wasm-simd.wasm');
    expect(urls).toContain('https://wasm.example/piper_phonemize.wasm');
    expect(urls).toContain('https://wasm.example/piper_phonemize.data');
  });

  it('never throws when the network is gone', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => { throw new TypeError('Failed to fetch'); }));
    expect(() => warmPiperRuntime()).not.toThrow();
    await Promise.resolve();
  });
});

// --- synthesis and playback --------------------------------------------------
interface FakeRequest { id: number; text: string; voiceId: string }
class FakeWorker {
  static instances: FakeWorker[] = [];
  private message: Array<(event: { data: unknown }) => void> = [];
  reply: ((request: FakeRequest) => void) | null = null;
  constructor() { FakeWorker.instances.push(this); }
  addEventListener(type: string, handler: (event: { data: unknown }) => void) {
    if (type === 'message') this.message.push(handler);
  }
  removeEventListener(type: string, handler: (event: { data: unknown }) => void) {
    if (type === 'message') this.message = this.message.filter(entry => entry !== handler);
  }
  postMessage(request: FakeRequest) { queueMicrotask(() => this.reply?.(request)); }
  terminate() {}
  emit(data: unknown) { for (const handler of [...this.message]) handler({ data }); }
}

class FakeBufferSource {
  buffer: unknown = null;
  onended: (() => void) | null = null;
  connect() {}
  start() { queueMicrotask(() => this.onended?.()); }
  stop() {}
}
class FakeAudioContext {
  state = 'running';
  destination = {};
  async resume() { this.state = 'running'; }
  async decodeAudioData() { return {}; }
  createBufferSource() { return new FakeBufferSource(); }
}

beforeEach(() => {
  FakeWorker.instances = [];
  (window as unknown as { AudioContext: unknown }).AudioContext = FakeAudioContext;
  vi.stubGlobal('Worker', FakeWorker);
});

describe('speaking', () => {
  it('flips the speaking flag around an offline utterance', async () => {
    const seen: boolean[] = [];
    const off = onPiperSpeaking(speaking => seen.push(speaking));
    const pending = speakPiper('Ahoj', 'cs_CZ-jirka-medium');
    expect(seen).toEqual([false, true]);
    FakeWorker.instances[0].reply = request => FakeWorker.instances[0].emit({ id: request.id, ok: true, wav: new Blob(['wav']) });
    await pending;
    expect(seen.at(-1)).toBe(false);
    off();
  });

  it('surfaces a synthesis failure as a classified Piper error', async () => {
    const pending = speakPiper('Ahoj', 'cs_CZ-jirka-medium');
    FakeWorker.instances[0].reply = request => FakeWorker.instances[0].emit({ id: request.id, ok: false, error: 'RangeError: out of memory' });
    const failure = await pending.catch((error: unknown) => error);
    expect(failure).toBeInstanceOf(PiperError);
    expect((failure as PiperError).kind).toBe('memory');
  });

  it('cancels a sentence that is still being synthesised', async () => {
    const seen: boolean[] = [];
    const off = onPiperSpeaking(speaking => seen.push(speaking));
    const pending = speakPiper('Ahoj', 'cs_CZ-jirka-medium');
    cancelPiperSpeech();
    await expect(pending).resolves.toBeUndefined();
    expect(seen.at(-1)).toBe(false);
    off();
  });

  it('is safe to cancel when nothing is playing', () => {
    expect(() => cancelPiperSpeech()).not.toThrow();
  });
});
