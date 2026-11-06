import { predict } from '@diffusionstudio/vits-web';

/**
 * Piper synthesis runs here so ONNX/WASM inference never blocks the UI thread.
 * The page drives it with { id, text, voiceId } and gets { id, ok, wav | error } back;
 * cancelling a sentence means terminating this worker.
 */
interface SynthRequest { id: number; text: string; voiceId: string }
interface SynthResponse { id: number; ok: boolean; wav?: Blob; error?: string }

const scope = self as unknown as {
  addEventListener(type: 'message', listener: (event: MessageEvent<SynthRequest>) => void): void;
  postMessage(message: SynthResponse): void;
};

scope.addEventListener('message', event => {
  const { id, text, voiceId } = event.data;
  const voice = voiceId as Parameters<typeof predict>[0]['voiceId'];
  void predict({ text, voiceId: voice })
    .then(wav => scope.postMessage({ id, ok: true, wav }))
    .catch((error: unknown) => scope.postMessage({
      id, ok: false,
      error: error instanceof Error ? `${error.name}: ${error.message}` : String(error),
    }));
});
