import { defineConfig } from 'vitest/config';
import { fileURLToPath } from 'node:url';
import { readdir } from 'node:fs/promises';
import { join } from 'node:path';

// Cache the build's own static files only. Never intercept/cache bridge requests or board data.
async function filesIn(dir: string, prefix = ''): Promise<string[]> {
  const entries = await readdir(dir, { withFileTypes: true });
  return (await Promise.all(entries.map(e => e.isDirectory()
    ? filesIn(join(dir, e.name), `${prefix}${e.name}/`)
    : [`/${prefix}${e.name}`]))).flat();
}
export default defineConfig({
  resolve: { dedupe: ['react', 'react-dom'], alias: { '@openmathtutor/shared': fileURLToPath(new URL('../shared/src/index.ts', import.meta.url)) } },
  // Plain Vite/esbuild deliberately avoids the inline React-refresh preamble under strict script-src.
  esbuild: { jsx: 'automatic' },
  server: { port: 5173, strictPort: true },
  plugins: [{
    name: 'local-offline-shell',
    apply: 'build',
    async closeBundle() {
      const { writeFile } = await import('node:fs/promises');
      const files = (await filesIn('dist')).filter(f => f !== '/sw.js');
      const version = `omt-${Date.now()}`;
      await writeFile('dist/sw.js', `const CACHE=${JSON.stringify(version)},FILES=${JSON.stringify(files)};
self.addEventListener('install',e=>e.waitUntil(caches.open(CACHE).then(c=>c.addAll(FILES))));
self.addEventListener('activate',e=>e.waitUntil(caches.keys().then(keys=>Promise.all(keys.filter(k=>k.startsWith('omt-')&&k!==CACHE).map(k=>caches.delete(k))))));
self.addEventListener('fetch',e=>{const u=new URL(e.request.url);if(e.request.method!=='GET'||u.origin!==self.location.origin)return;if(e.request.mode==='navigate'){e.respondWith(fetch(e.request).catch(()=>caches.match('/index.html')));return;}if(FILES.includes(u.pathname))e.respondWith(caches.open(CACHE).then(c=>c.match(u.pathname,{ignoreVary:true})).then(r=>r||fetch(e.request)));});`);
    },
  }],
  test: { environment: 'jsdom', include: ['src/**/*.test.{ts,tsx}'], setupFiles: ['./src/testSetup.ts'], maxWorkers: 2 },
});
