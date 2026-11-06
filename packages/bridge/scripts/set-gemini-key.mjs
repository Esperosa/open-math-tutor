// Stores your own Google AI Studio API key for the local bridge (never sent anywhere except to Google).
// Usage: npm run set-gemini-key -w packages/bridge
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { createInterface } from 'node:readline';

const dir = join(process.env.APPDATA || process.env.HOME || '.', 'OpenMathTutor');
const file = join(dir, 'provider-keys.json');

function ask(prompt) {
  return new Promise(resolve => {
    const rl = createInterface({ input: process.stdin, output: process.stdout, terminal: true });
    const write = rl._writeToOutput;
    rl._writeToOutput = s => { if (s.includes(prompt)) write.call(rl, s); }; // hide what is typed
    rl.question(prompt, answer => { rl.close(); process.stdout.write('\n'); resolve(answer.trim()); });
  });
}

const key = await ask('Vlož svůj Google AI Studio API klíč a stiskni Enter (nezobrazí se): ');
if (!key) { console.error('Nic nezadáno.'); process.exit(1); }
const check = await fetch('https://generativelanguage.googleapis.com/v1beta/models', { headers: { 'x-goog-api-key': key } }).catch(() => null);
if (!check || !check.ok) { console.error(`Google klíč nepřijal (${check ? check.status : 'bez spojení'}). Nic se neuložilo.`); process.exit(1); }
let current = {};
try { current = JSON.parse(await readFile(file, 'utf8')); } catch { /* new file */ }
current.google = { apiKey: key };
await mkdir(dir, { recursive: true });
await writeFile(file, JSON.stringify(current, null, 2), { mode: 0o600 });
console.log(`Hotovo: klíč je uložen lokálně v ${file}. Restartuj bridge, Gemini se objeví v Nastavení.`);
