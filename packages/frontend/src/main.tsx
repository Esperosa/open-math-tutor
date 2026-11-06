import { createRoot } from 'react-dom/client';
import '@excalidraw/excalidraw/index.css';
import 'katex/dist/katex.min.css';
import './styles.css';

// All Excalidraw fonts are served locally, not fetched from its public CDN.
Object.assign(window, { EXCALIDRAW_ASSET_PATH: '/excalidraw-assets/' });
const { App } = await import('./App');
createRoot(document.getElementById('root')!).render(<App />);
if (import.meta.env.PROD && 'serviceWorker' in navigator) {
  void navigator.serviceWorker.register('/sw.js').catch(() => { /* Offline shell is an optional enhancement. */ });
}
