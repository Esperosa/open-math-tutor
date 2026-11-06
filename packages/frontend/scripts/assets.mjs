import { cp, mkdir } from 'node:fs/promises';
import { createRequire } from 'node:module';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const require = createRequire(import.meta.url);
const root = dirname(require.resolve('@excalidraw/excalidraw'));
const targetDir = fileURLToPath(new URL('../public/excalidraw-assets', import.meta.url));
await mkdir(targetDir, { recursive: true });
await cp(resolve(root, 'fonts'), resolve(targetDir, 'fonts'), { recursive: true });
