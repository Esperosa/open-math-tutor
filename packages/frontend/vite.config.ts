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
  resolve: { dedupe: ['react', 'react-dom'], alias: {
    '@openmathtutor/shared': fileURLToPath(new URL('../shared/src/index.ts', import.meta.url)),
    '@openmathtutor/content': fileURLToPath(new URL('../content/src/index.ts', import.meta.url)),
  } },
  // Plain Vite/esbuild deliberately avoids the inline React-refresh preamble under strict script-src.
  esbuild: { jsx: 'automatic' },
  // The Piper synthesiser worker imports a chunked dependency; ES output is the only format that allows it.
  worker: { format: 'es' },
  server: { port: 5173, strictPort: true },
  plugins: [
    {
      name: 'serve-excalidraw-fonts',
      configureServer(server) {
        server.middlewares.use(async (req, res, next) => {
          if (req.url && req.url.startsWith('/excalidraw-assets/fonts/')) {
            const { createRequire } = await import('node:module');
            const { dirname, resolve } = await import('node:path');
            const { createReadStream, existsSync } = await import('node:fs');
            const reqModule = createRequire(import.meta.url);
            const fontRoot = resolve(dirname(reqModule.resolve('@excalidraw/excalidraw')), 'fonts');
            const rel = req.url.slice('/excalidraw-assets/fonts/'.length).split('?')[0];
            const file = resolve(fontRoot, rel);
            if (existsSync(file)) {
              res.setHeader('Content-Type', file.endsWith('.woff2') ? 'font/woff2' : 'font/woff');
              createReadStream(file).pipe(res);
              return;
            }
          }
          next();
        });
      },
    },
    {
      name: 'local-offline-shell',
      apply: 'build',
      async closeBundle() {
        const { writeFile } = await import('node:fs/promises');
        const files = (await filesIn('dist')).filter(f => f !== '/sw.js');
        const version = `omt-${Date.now()}`;
        await writeFile('dist/sw.js', `const CACHE=${JSON.stringify(version)},FILES=${JSON.stringify(files)};
self.addEventListener('install',e=>e.waitUntil(caches.open(CACHE).then(c=>c.addAll(FILES))));
self.addEventListener('activate',e=>e.waitUntil(caches.keys().then(keys=>Promise.all(keys.filter(k=>k.startsWith('omt-')&&k!==CACHE).map(k=>caches.delete(k)))).then(()=>self.clients.claim())));
self.addEventListener('fetch',e=>{const u=new URL(e.request.url);if(e.request.method!=='GET'||u.origin!==self.location.origin)return;if(e.request.mode==='navigate'){e.respondWith(fetch(e.request).catch(()=>caches.match('/index.html')));return;}if(FILES.includes(u.pathname))e.respondWith(caches.open(CACHE).then(c=>c.match(u.pathname,{ignoreVary:true})).then(r=>r||fetch(e.request)));});
const RUNTIME='piper-runtime-v1',RUNTIME_HOSTS=['cdnjs.cloudflare.com','cdn.jsdelivr.net'];
self.addEventListener('fetch',e=>{const u=new URL(e.request.url);if(e.request.method!=='GET'||u.origin===self.location.origin||!RUNTIME_HOSTS.includes(u.hostname))return;e.respondWith((async()=>{const c=await caches.open(RUNTIME);const hit=await c.match(e.request,{ignoreVary:true});if(hit)return hit;const resp=await fetch(e.request);if(resp.ok)e.waitUntil(c.put(e.request,resp.clone()).catch(()=>{}));return resp;})().catch(()=>fetch(e.request)));});`);
      },
    },
  ],
  test: { environment: 'jsdom', include: ['src/**/*.test.{ts,tsx}'], setupFiles: ['./src/testSetup.ts'], maxWorkers: 2 },
});
