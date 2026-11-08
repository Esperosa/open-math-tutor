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
  optimizeDeps: {
    esbuildOptions: {
      plugins: [
        {
          name: 'excalidraw-local-fonts',
          setup(build) {
            build.onLoad({ filter: /@excalidraw[\\/]excalidraw.*\.js$/ }, async (args) => {
              const fs = await import('node:fs/promises');
              let contents = await fs.readFile(args.path, 'utf8');
              const bt = String.fromCharCode(96);
              while (contents.includes('https://esm.sh')) {
                const start = contents.indexOf('https://esm.sh');
                const end = contents.indexOf(bt + ');', start);
                if (end === -1) break;
                if (contents[start - 1] === bt) {
                  contents = contents.slice(0, start - 1) + '"/excalidraw-assets/"' + contents.slice(end + 1);
                } else break;
              }
              contents = contents.replaceAll(/https:\/\/esm\.sh\/[^"'\s)]*\/dist\/prod\//g, '/excalidraw-assets/');
              return { contents, loader: 'js' };
            });
          },
        },
      ],
    },
  },
  plugins: [
    {
      name: 'excalidraw-local-fonts',
      enforce: 'pre',
      transform(code, id) {
        if (id.includes('@excalidraw') && code.includes('https://esm.sh')) {
          const bt = String.fromCharCode(96);
          let contents = code;
          while (contents.includes('https://esm.sh')) {
            const start = contents.indexOf('https://esm.sh');
            const end = contents.indexOf(bt + ');', start);
            if (end === -1) break;
            if (contents[start - 1] === bt) {
              contents = contents.slice(0, start - 1) + '"/excalidraw-assets/"' + contents.slice(end + 1);
            } else break;
          }
          return contents.replaceAll(/https:\/\/esm\.sh\/[^"'\s)]*\/dist\/prod\//g, '/excalidraw-assets/');
        }
      },
    },
    {
      name: 'serve-excalidraw-fonts',
      configureServer(server) {
        server.middlewares.use(async (req, res, next) => {
          if (req.url && req.url.startsWith('/excalidraw-assets/')) {
            const { createRequire } = await import('node:module');
            const { dirname, resolve } = await import('node:path');
            const { createReadStream, existsSync } = await import('node:fs');
            const reqModule = createRequire(import.meta.url);
            const fontRoot = resolve(dirname(reqModule.resolve('@excalidraw/excalidraw')), 'fonts');
            let rel = req.url.slice('/excalidraw-assets/'.length).split('?')[0];
            if (rel.startsWith('fonts/')) rel = rel.slice('fonts/'.length);
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
