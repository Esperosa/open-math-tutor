import { createServer } from './server.js';
import { VerifierClient } from './verifierClient.js';

export function port(value: string | undefined, fallback: number): number {
  if (value === undefined) return fallback;
  if (!/^\d+$/.test(value) || Number(value) < 1 || Number(value) > 65535) throw new Error('Invalid local service port.');
  return Number(value);
}

// Pairing is not implemented: explicit opt-in alone is insufficient. Never bind
// publicly even when ALLOW_LAN=true; fail visibly rather than expose the service.
if (process.env.OMT_BRIDGE_ALLOW_LAN && process.env.OMT_BRIDGE_ALLOW_LAN !== 'false') {
  throw new Error('LAN pairing is not implemented. OMT_BRIDGE_ALLOW_LAN must be false.');
}
if (process.env.OMT_DEFAULT_PROVIDER && !['codex', 'claude'].includes(process.env.OMT_DEFAULT_PROVIDER)) {
  throw new Error('OMT_DEFAULT_PROVIDER must be codex or claude.');
}
const app = createServer({ verifier: new VerifierClient(`http://127.0.0.1:${port(process.env.OMT_VERIFIER_PORT, 4179)}`) });
try {
  await app.listen({ host: '127.0.0.1', port: port(process.env.OMT_BRIDGE_PORT, 4178) });
  // Fixed health marker only: no provider output, credentials, or user content.
  process.stdout.write('OpenMathTutor bridge ready\n');
} catch { process.stderr.write('Unable to start local bridge. Check the configured port.\n'); process.exitCode = 1; }
for (const signal of ['SIGINT', 'SIGTERM'] as const) {
  process.once(signal, () => { void app.close().then(() => process.exit(0)); });
}
