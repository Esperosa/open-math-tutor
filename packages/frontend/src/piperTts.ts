import { HF_BASE, ONNX_BASE, PATH_MAP, stored, WASM_BASE } from '@diffusionstudio/vits-web';

export type PiperErrorKind = 'offline' | 'memory' | 'unknown';

export class PiperError extends Error {
  constructor(readonly kind: PiperErrorKind, message: string = kind) { super(message); this.name = 'PiperError'; }
}

export function isAbortError(error: unknown): boolean {
  return typeof error === 'object' && error !== null && (error as { name?: string }).name === 'AbortError';
}

/** Offline, out of memory and everything else are told apart so the message can name a real cause. */
export function classifyPiperError(error: unknown): PiperErrorKind {
  if (error instanceof PiperError) return error.kind;
  const name = typeof error === 'object' && error !== null ? String((error as { name?: string }).name ?? '') : '';
  const message = typeof error === 'object' && error !== null ? String((error as { message?: string }).message ?? error) : String(error);
  if (name === 'RangeError' || /out of memory|allocation failed|Array buffer|wasm memory|invalid memory|not enough memory/i.test(message)) return 'memory';
  if (name === 'TypeError' || /fetch|network|Failed to load|load failed|ERR_INTERNET|ERR_NETWORK|ERR_CONNECTION|offline/i.test(message)) return 'offline';
  return 'unknown';
}

function abortError(): Error {
  return typeof DOMException !== 'undefined' ? new DOMException('canceled', 'AbortError') : Object.assign(new Error('canceled'), { name: 'AbortError' });
}

// --- Speaking state shared with the hook ------------------------------------
type SpeakingListener = (speaking: boolean) => void;
const speakingListeners = new Set<SpeakingListener>();
function notifySpeaking(speaking: boolean) { for (const listener of [...speakingListeners]) listener(speaking); }
/** Subscribe to the mouth-animation flag; returns the unsubscribe function. */
export function onPiperSpeaking(listener: SpeakingListener): () => void {
  speakingListeners.add(listener);
  return () => { speakingListeners.delete(listener); };
}

// --- Model download ----------------------------------------------------------
export interface DownloadOptions {
  signal?: AbortSignal;
  /** Model + config size from the catalog, used as the denominator of the progress bar. */
  expectedBytes?: number;
  onProgress?: (loaded: number, total: number) => void;
}

async function writeUrlToOpfs(url: string, signal: AbortSignal | undefined, onChunk: (bytes: number) => void): Promise<void> {
  let response: Response;
  try {
    response = await fetch(url, { signal });
  } catch (error) {
    if (isAbortError(error)) throw error;
    throw new PiperError('offline', String(error));
  }
  if (!response.ok) throw new PiperError(response.status >= 500 ? 'unknown' : 'offline', `HTTP ${response.status}`);
  const name = url.split('/').pop() ?? '';
  if (!name || !navigator.storage?.getDirectory) throw new PiperError('unknown', 'no origin private file system');
  const root = await navigator.storage.getDirectory();
  const directory = await root.getDirectoryHandle('piper', { create: true });
  const handle = await directory.getFileHandle(name, { create: true });
  // createWritable() commits only on close(), so an aborted download never leaves a half model behind.
  const writable = await handle.createWritable();
  try {
    const reader = response.body?.getReader();
    if (!reader) {
      const blob = await response.blob();
      await writable.write(blob);
      onChunk(blob.size);
    } else {
      for (;;) {
        const { done, value } = await reader.read();
        if (done) break;
        if (value && value.byteLength) { await writable.write(value); onChunk(value.byteLength); }
      }
    }
    await writable.close();
  } catch (error) {
    await writable.abort().catch(() => {});
    if (isAbortError(error)) throw error;
    throw new PiperError(classifyPiperError(error), String(error));
  }
}

/**
 * Downloads one voice (model + config) into the browser's origin private file system,
 * exactly where @diffusionstudio/vits-web's predict() looks for it, and reports bytes
 * as they arrive. The package's own download() cannot be cancelled, so this mirrors it
 * with an AbortSignal.
 */
export async function downloadPiperVoice(id: string, options: DownloadOptions = {}): Promise<void> {
  const relative = (PATH_MAP as Record<string, string>)[id];
  if (!relative) throw new PiperError('unknown', `unknown voice ${id}`);
  const modelUrl = `${HF_BASE}/${relative}`;
  const total = options.expectedBytes ?? 0;
  let loaded = 0;
  const report = () => options.onProgress?.(loaded, total);
  await writeUrlToOpfs(modelUrl, options.signal, bytes => { loaded += bytes; report(); });
  await writeUrlToOpfs(`${modelUrl}.json`, options.signal, bytes => { loaded += bytes; report(); });
}

/** Voice ids whose model already sits in the cache and therefore speaks offline. */
export async function storedPiperVoices(): Promise<string[]> {
  try { return await stored(); } catch { return []; }
}

/** ONNX and phonemizer runtimes the package pulls from a CDN on first synthesis. */
const RUNTIME_URLS = [`${ONNX_BASE}ort-wasm-simd.wasm`, `${WASM_BASE}.wasm`, `${WASM_BASE}.data`];

/**
 * Fetches the synthesis runtimes right after a model download so the service worker
 * can cache them; without this the first *offline* speech would have nothing to run on.
 * Failures are harmless — synthesis simply reports its own error later.
 */
export function warmPiperRuntime(): void {
  for (const url of RUNTIME_URLS) void fetch(url).catch(() => {});
}

// --- Synthesis in a worker ---------------------------------------------------
interface SynthRequest { id: number; text: string; voiceId: string }
interface SynthResponse { id: number; ok: boolean; wav?: Blob; error?: string }
interface Session { id: number; abort: AbortController; reject: (error: unknown) => void }

let worker: Worker | null = null;
let session: Session | null = null;
let sequence = 0;

function ensureWorker(): Worker {
  worker ??= new Worker(new URL('./piperWorker.ts', import.meta.url), { type: 'module' });
  return worker;
}

function synth(text: string, voiceId: string, active: Session): Promise<Blob> {
  return new Promise<Blob>((resolve, reject) => {
    active.reject = reject;
    const instance = ensureWorker();
    const finish = () => {
      instance.removeEventListener('message', onMessage);
      instance.removeEventListener('error', onError);
      active.abort.signal.removeEventListener('abort', onAbort);
    };
    const onMessage = (event: MessageEvent<SynthResponse>) => {
      const data = event.data;
      if (!data || data.id !== active.id) return;
      finish();
      if (data.ok && data.wav) resolve(data.wav);
      else reject(new PiperError(classifyPiperError(data.error), data.error ?? 'synthesis failed'));
    };
    const onError = (event: ErrorEvent) => { finish(); reject(new PiperError(classifyPiperError(event.message), event.message)); };
    const onAbort = () => { finish(); reject(abortError()); };
    instance.addEventListener('message', onMessage);
    instance.addEventListener('error', onError);
    active.abort.signal.addEventListener('abort', onAbort);
    instance.postMessage({ id: active.id, text, voiceId } satisfies SynthRequest);
  });
}

// --- Playback through Web Audio ---------------------------------------------
let audioContext: AudioContext | null = null;
let source: AudioBufferSourceNode | null = null;

function context(): AudioContext | null {
  if (audioContext) return audioContext;
  const Ctor = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
  if (!Ctor) return null;
  try { audioContext = new Ctor(); } catch { return null; }
  return audioContext;
}

/**
 * Creates the AudioContext on the first click anywhere. Chrome and Firefox keep a
 * context created without a gesture suspended, which would silently mute later
 * automatic tutor speech.
 */
export function warmAudioContext(): void {
  const ctx = context();
  if (ctx && ctx.state !== 'running') void ctx.resume().catch(() => {});
}

async function play(blob: Blob, active: Session): Promise<void> {
  const ctx = context();
  if (!ctx) throw new PiperError('unknown', 'no AudioContext');
  if (ctx.state !== 'running') { try { await ctx.resume(); } catch { /* reported below */ } }
  if (ctx.state !== 'running') throw new PiperError('unknown', 'AudioContext suspended');
  const buffer = await ctx.decodeAudioData(await blob.arrayBuffer());
  if (session !== active) return;
  await new Promise<void>((resolve, reject) => {
    const node = ctx.createBufferSource();
    node.buffer = buffer;
    node.connect(ctx.destination);
    source = node;
    node.onended = () => { if (source === node) source = null; resolve(); };
    try { node.start(); } catch (error) { source = null; reject(new PiperError(classifyPiperError(error), String(error))); }
  });
}

function stopSource(): void {
  const node = source;
  source = null;
  if (!node) return;
  node.onended = null;
  try { node.stop(); } catch { /* already stopped */ }
}

/** Stops synthesis and playback wherever it came from; safe to call at any time. */
export function cancelPiperSpeech(): void {
  const active = session;
  session = null;
  stopSource();
  if (active) { active.abort.abort(); active.reject(abortError()); }
  if (worker) { worker.terminate(); worker = null; }
  notifySpeaking(false);
}

/**
 * Synthesises text with a downloaded Piper voice and plays it back. The heavy work
 * (ONNX + WASM) runs in a worker, so the UI stays responsive; `speaking` flips for
 * the mascot's mouth exactly like speechSynthesis does. Rejects with a PiperError
 * unless the call was cancelled.
 */
export async function speakPiper(text: string, voiceId: string): Promise<void> {
  cancelPiperSpeech();
  const active: Session = { abort: new AbortController(), reject: () => {}, id: ++sequence };
  session = active;
  notifySpeaking(true);
  try {
    const wav = await synth(text, voiceId, active);
    if (session !== active) return;
    await play(wav, active);
    if (session === active) { session = null; notifySpeaking(false); }
  } catch (error) {
    if (session === active) { session = null; notifySpeaking(false); }
    if (isAbortError(error)) return;
    throw error;
  }
}
