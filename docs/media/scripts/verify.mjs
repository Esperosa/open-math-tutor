/** Verify delivery without starting a browser or running e2e tests.
 * node docs/media/scripts/verify.mjs
 * Optional ffmpeg/ffprobe paths: FFMPEG and FFPROBE environment variables.
 */
import { readdir, readFile, writeFile } from 'node:fs/promises';
import { dirname, join, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const ffmpeg = process.env.FFMPEG || 'ffmpeg', ffprobe = process.env.FFPROBE || 'ffprobe';
const files = [];
async function walk(dir) {
  for (const e of await readdir(dir, { withFileTypes: true })) {
    const path = join(dir, e.name);
    if (e.isDirectory()) await walk(path);
    else if (e.name !== 'verification.json') files.push(path);
  }
}
await walk(root);
const entries = [];
for (const path of files.sort()) {
  const name = relative(root, path).replaceAll('\\', '/');
  const bytes = await readFile(path);
  if (bytes.length > 8_000_000) throw new Error(`${name}: exceeds 8 MB`);
  const entry = { file: name, bytes: bytes.length, sha256: createHash('sha256').update(bytes).digest('hex') };
  if (/\.(mp4|webm)$/.test(name)) {
    const info = JSON.parse(execFileSync(ffprobe, ['-v', 'error', '-show_streams', '-show_format', '-of', 'json', path], { encoding: 'utf8', windowsHide: true }));
    const v = info.streams.find(s => s.codec_type === 'video');
    const duration = Number(info.format.duration);
    if (!v || v.width !== 1280 || v.height !== 720 || duration < 8 || duration > 25) throw new Error(`${name}: invalid resolution/duration`);
    if (info.streams.some(s => s.codec_type === 'audio')) throw new Error(`${name}: unexpected audio`);
    if (name.endsWith('.mp4') && (v.codec_name !== 'h264' || v.pix_fmt !== 'yuv420p')) throw new Error(`${name}: invalid web codec`);
    if (name.endsWith('.webm') && v.codec_name !== 'vp9') throw new Error(`${name}: invalid WebM codec`);
    execFileSync(ffmpeg, ['-v', 'error', '-xerror', '-i', path, '-f', 'null', '-'], { windowsHide: true });
    entry.media = { width: v.width, height: v.height, durationSeconds: duration, codec: v.codec_name, audio: false, decoded: true };
  }
  if (name.endsWith('.png')) {
    if (bytes.subarray(0, 8).toString('hex') !== '89504e470d0a1a0a') throw new Error(`${name}: invalid PNG`);
    entry.image = { width: bytes.readUInt32BE(16), height: bytes.readUInt32BE(20) };
    if (!name.startsWith('exports/')) {
      const expected = name.includes('phone') ? [390, 844] : [1280, 720];
      if (entry.image.width !== expected[0] || entry.image.height !== expected[1]) throw new Error(`${name}: wrong screenshot dimensions`);
    }
  }
  if (name.startsWith('exports/') && /\.(html|md)$/.test(name)) {
    if (/(?:[A-Z]:[\\/]|\\Users\\|\/Users\/|\/home\/|[\w.+-]+@[\w.-]+\.[a-z]{2,}|sk-ant-|sk-proj-|Bearer\s)/i.test(bytes.toString('utf8'))) throw new Error(`${name}: privacy check failed`);
  }
  entries.push(entry);
}
const mp4s = entries.filter(e => e.file.endsWith('.mp4'));
const screenshots = entries.filter(e => e.file.endsWith('.png') && !e.file.startsWith('exports/'));
if (mp4s.length < 5 || mp4s.length > 7) throw new Error('Expected 5–7 MP4 clips');
if (screenshots.length < 8 || screenshots.length > 10) throw new Error('Expected 8–10 screenshots');
for (const mp4 of mp4s) if (!entries.some(e => e.file === mp4.file.replace('.mp4', '.webm'))) throw new Error(`${mp4.file}: WebM missing`);
const capture = JSON.parse(await readFile(join(root, 'capture-report.json'), 'utf8'));
for (const id of ['01', '02', '04', '05', '06']) if (capture.runs[id]?.outcome !== 'ok') throw new Error(`Required scenario ${id} is incomplete`);
const result = { mp4Count: mp4s.length, screenshotCount: screenshots.length, maximumFileBytes: Math.max(...entries.map(e => e.bytes)), files: entries };
await writeFile(join(root, 'verification.json'), JSON.stringify(result, null, 2) + '\n');
for (const e of entries) console.log(`${e.file}\t${e.bytes} B${e.media ? `\t${e.media.durationSeconds}s ${e.media.codec} 1280x720 silent` : ''}`);
console.log(`PASS: ${mp4s.length} MP4 + WebM pairs, ${screenshots.length} screenshots; full video decode, no audio, size and export privacy checks.`);
