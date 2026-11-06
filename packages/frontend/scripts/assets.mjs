import { cp, mkdir } from 'node:fs/promises';
import { createRequire } from 'node:module';
import { dirname, resolve } from 'node:path';
const require = createRequire(import.meta.url);
const root = dirname(require.resolve('@excalidraw/excalidraw'));
await mkdir('public/excalidraw-assets', { recursive: true });
await cp(resolve(root, 'fonts'), 'public/excalidraw-assets/fonts', { recursive: true });
