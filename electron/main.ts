import { app, BrowserWindow, ipcMain, net, protocol, session, utilityProcess, type UtilityProcess } from 'electron';
import { resolve, relative, extname, isAbsolute } from 'node:path';
import { pathToFileURL } from 'node:url';
import { spawn } from 'node:child_process';

protocol.registerSchemesAsPrivileged([{ scheme: 'app', privileges: {
  standard: true, secure: true, supportFetchAPI: true, corsEnabled: true,
} }]);

const root = resolve(__dirname, '../..');
const devUrl = process.env.OMT_FRONTEND_DEV_URL;
if (devUrl && devUrl !== 'http://localhost:5173') throw new Error('Only the fixed local frontend dev origin is allowed.');
const frontendUrl = devUrl ?? 'app://openmathtutor/index.html';
const rendererOrigin = devUrl ?? 'app://openmathtutor';
const port = process.env.OMT_BRIDGE_PORT ?? '4178';
if (!/^\d+$/.test(port) || Number(port) < 1 || Number(port) > 65535) throw new Error('Invalid bridge port.');
const bridgeUrl = `http://127.0.0.1:${Number(port)}`;
let bridge: UtilityProcess | undefined;
let window: BrowserWindow | undefined;
let quitting = false;

async function startBridge(): Promise<void> {
  await new Promise<void>((resolveReady, reject) => {
    bridge = utilityProcess.fork(resolve(root, 'packages/bridge/dist/index.js'), [], {
      serviceName: 'OpenMathTutor local bridge', stdio: 'pipe',
      env: { ...process.env, OMT_BRIDGE_PORT: port, OMT_BRIDGE_ALLOW_LAN: 'false' },
    });
    let output = '', ready = false;
    const timer = setTimeout(() => reject(new Error('Bridge startup timed out.')), 20_000);
    bridge.stdout?.on('data', (chunk: Buffer) => {
      output = (output + chunk.toString()).slice(-1000);
      if (!ready && output.includes('OpenMathTutor bridge ready\n')) {
        ready = true; clearTimeout(timer); resolveReady();
      }
    });
    bridge.stderr?.on('data', () => { /* drain without logging subprocess data */ });
    bridge.on('exit', () => {
      clearTimeout(timer);
      if (!ready) reject(new Error('Bridge could not start (check build and port).'));
      if (ready && !quitting) app.quit();
    });
  });
  const response = await net.fetch(`${bridgeUrl}/health`, { headers: { Origin: rendererOrigin } });
  if (!response.ok) throw new Error('Bridge health check failed.');
}

function stopBridge(): void {
  if (process.platform === 'win32' && bridge?.pid) {
    // Kill the owned process tree, including npm-launched provider subprocesses.
    const child = spawn(resolve(process.env.SystemRoot ?? 'C:\\Windows', 'System32/taskkill.exe'),
      ['/PID', String(bridge.pid), '/T', '/F'], { windowsHide: true, stdio: 'ignore' });
    child.on('error', () => bridge?.kill());
  } else bridge?.kill();
}

async function createWindow(): Promise<void> {
  const frontendDir = resolve(root, 'packages/frontend/dist');
  protocol.handle('app', request => {
    const url = new URL(request.url);
    if (url.host !== 'openmathtutor') return new Response('Forbidden', { status: 403 });
    let path: string;
    try { path = resolve(frontendDir, '.' + decodeURIComponent(url.pathname)); }
    catch { return new Response('Invalid path', { status: 400 }); }
    const rel = relative(frontendDir, path);
    if (rel.startsWith('..') || isAbsolute(rel) || !['.html', '.js', '.css', '.png', '.svg', '.webp', '.ico', '.woff', '.woff2', '.ttf', '.json'].includes(extname(path))) {
      return new Response('Not found', { status: 404 });
    }
    return net.fetch(pathToFileURL(path).toString());
  });
  session.defaultSession.setPermissionRequestHandler((_contents, _permission, callback) => callback(false));
  session.defaultSession.setPermissionCheckHandler(() => false);
  session.defaultSession.on('will-download', event => event.preventDefault());
  const csp = [
    "default-src 'self'", `script-src 'self'${devUrl ? " 'unsafe-inline'" : ''}`,
    "style-src 'self' 'unsafe-inline'", "img-src 'self' data: blob:", "font-src 'self' data:",
    `connect-src 'self' ${bridgeUrl}${devUrl ? ' http://localhost:5173 ws://localhost:5173' : ''}`,
    "worker-src 'self' blob:", "object-src 'none'", "base-uri 'none'", "form-action 'none'", "frame-src 'none'", "frame-ancestors 'none'",
  ].join('; ');
  session.defaultSession.webRequest.onHeadersReceived((details, callback) => {
    const headers = { ...details.responseHeaders };
    for (const key of Object.keys(headers)) if (key.toLowerCase() === 'content-security-policy') delete headers[key];
    callback({ responseHeaders: { ...headers, 'Content-Security-Policy': [csp] } });
  });
  window = new BrowserWindow({ width: 1280, height: 900, webPreferences: {
    preload: resolve(__dirname, 'preload.js'), contextIsolation: true,
    nodeIntegration: false, sandbox: true, webSecurity: true,
    allowRunningInsecureContent: false, webviewTag: false,
  } });
  window.webContents.setWindowOpenHandler(() => ({ action: 'deny' }));
  window.webContents.on('will-navigate', event => event.preventDefault());
  window.webContents.on('will-attach-webview', event => event.preventDefault());
  ipcMain.handle('omt:bridge-url', event => {
    const frame = event.senderFrame;
    if (!window || event.sender !== window.webContents || !frame || frame !== window.webContents.mainFrame ||
        !(frame.url === frontendUrl || (devUrl && new URL(frame.url).origin === devUrl))) throw new Error('Untrusted IPC sender.');
    return bridgeUrl;
  });
  await window.loadURL(frontendUrl);
}

app.whenReady().then(async () => { await startBridge(); await createWindow(); }).catch(() => {
  process.stderr.write('OpenMathTutor desktop could not start. Build bridge/frontend and check local ports.\n'); app.quit();
});
app.on('window-all-closed', () => app.quit());
app.on('before-quit', () => { quitting = true; stopBridge(); });
