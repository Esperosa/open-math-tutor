import { createRoot } from 'react-dom/client';
import '@excalidraw/excalidraw/index.css';
import 'katex/dist/katex.min.css';
import './styles.css';
import { ErrorBoundary } from './ErrorBoundary';

// All Excalidraw fonts are served locally, not fetched from its public CDN.
Object.assign(window, { EXCALIDRAW_ASSET_PATH: '/excalidraw-assets/' });

if (typeof window !== 'undefined') {
  const OrigFontFace = window.FontFace;
  if (OrigFontFace) {
    window.FontFace = class FontFace extends OrigFontFace {
      constructor(family: string, source: string | ArrayBuffer | ArrayBufferView, descriptors?: FontFaceDescriptors) {
        if (typeof source === 'string' && source.includes('https://esm.sh/')) {
          source = source.replaceAll(/https:\/\/esm\.sh\/[^"'\s)]*\/dist\/prod\//g, '/excalidraw-assets/');
        }
        super(family, source as string, descriptors);
      }
    } as typeof OrigFontFace;
  }
  const origFetch = window.fetch;
  if (origFetch) {
    window.fetch = function (input: RequestInfo | URL, init?: RequestInit) {
      if (typeof input === 'string' && input.includes('https://esm.sh/')) {
        input = input.replace(/https:\/\/esm\.sh\/[^"'\s]*\/dist\/prod\//, '/excalidraw-assets/');
      } else if (input instanceof URL && input.href.includes('https://esm.sh/')) {
        input = new URL(input.href.replace(/https:\/\/esm\.sh\/[^"'\s]*\/dist\/prod\//, '/excalidraw-assets/'));
      }
      return origFetch.call(this, input, init);
    };
  }
}

const { App } = await import('./App');
createRoot(document.getElementById('root')!).render(<ErrorBoundary><App /></ErrorBoundary>);
if (import.meta.env.PROD && 'serviceWorker' in navigator) {
  void navigator.serviceWorker.register('/sw.js').catch(() => { /* Offline shell is an optional enhancement. */ });
}
