import { cp, mkdir, readFile, writeFile, readdir, rm } from 'node:fs/promises';
import { createRequire } from 'node:module';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const require = createRequire(import.meta.url);
const excalidrawEntry = require.resolve('@excalidraw/excalidraw');
const prodDir = dirname(excalidrawEntry);
const pkgRoot = resolve(prodDir, '..', '..');
const fontRoot = resolve(prodDir, 'fonts');
const targetDir = fileURLToPath(new URL('../public/excalidraw-assets', import.meta.url));
await mkdir(targetDir, { recursive: true });
await cp(fontRoot, resolve(targetDir, 'fonts'), { recursive: true });
await cp(fontRoot, targetDir, { recursive: true });

async function patchDir(dir) {
  const entries = await readdir(dir, { withFileTypes: true });
  for (const entry of entries) {
    const full = resolve(dir, entry.name);
    if (entry.isDirectory()) {
      await patchDir(full);
    } else if (entry.name.endsWith('.js')) {
      let code = await readFile(full, 'utf8');
      if (code.includes('https://esm.sh')) {
        const bt = String.fromCharCode(96);
        let changed = false;
        while (code.includes('https://esm.sh')) {
          const start = code.indexOf('https://esm.sh');
          const end = code.indexOf(bt + ');', start);
          if (end === -1) break;
          if (code[start - 1] === bt) {
            code = code.slice(0, start - 1) + '"/excalidraw-assets/"' + code.slice(end + 1);
            changed = true;
          } else {
            break;
          }
        }
        if (code.includes('urls.push(new URL(assetUrl, _ExcalidrawFontFace.ASSETS_FALLBACK_URL));')) {
          code = code.replace(
            'urls.push(new URL(assetUrl, _ExcalidrawFontFace.ASSETS_FALLBACK_URL));',
            'urls.push(new URL(assetUrl, this.normalizeBaseUrl(_ExcalidrawFontFace.ASSETS_FALLBACK_URL)));'
          );
          changed = true;
        }
        if (code.includes('r.push(new URL(n,jn.ASSETS_FALLBACK_URL))')) {
          code = code.replace(
            'r.push(new URL(n,jn.ASSETS_FALLBACK_URL))',
            'r.push(new URL(n,this.normalizeBaseUrl(jn.ASSETS_FALLBACK_URL)))'
          );
          changed = true;
        }
        if (changed) {
          await writeFile(full, code, 'utf8');
        }
      }
    }
  }
}
try { await patchDir(resolve(pkgRoot, 'dist')); } catch {}

try {
  const viteCache = resolve(fileURLToPath(new URL('..', import.meta.url)), 'node_modules', '.vite');
  await rm(viteCache, { recursive: true, force: true });
} catch {}
