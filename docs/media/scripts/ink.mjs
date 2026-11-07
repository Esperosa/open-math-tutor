import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const root = resolve(here, '../../..');

const templates = JSON.parse(readFileSync(resolve(root, 'tools/handwriting/templates.json'), 'utf8'));
const heldout = JSON.parse(readFileSync(resolve(root, 'tools/handwriting/heldout.json'), 'utf8'));

const cursive = {
  m: [[[-11, -5], [-11, 9], [-11, -1], [-8, -4], [-6, -5], [-3, -5], [-1, -4], [0, -1], [0, 9], [0, -1], [3, -4], [5, -5], [8, -5], [10, -4], [11, -1], [11, 9]]],
  k: [[[-5, -9], [-5, 9]], [[6, -9], [-5, 1]], [[-5, 1], [6, 9]]],
  W: [[[0, 0], [4, 20], [10, 8], [16, 20], [20, 0]]],
  N: [[[0, 20], [0, 0], [20, 20], [20, 0]]],
  '/': [[[0, 20], [20, 0]]],
  t: [[[0, -10], [0, 8], [3, 10]], [[-5, -2], [5, -2]]],
  v: [[[-6, -6], [0, 8]], [[0, 8], [6, -6]]],
};

export function random(seed) {
  return () => {
    let t = seed += 0x6D2B79F5;
    t = Math.imul(t ^ t >>> 15, t | 1); t ^= t + Math.imul(t ^ t >>> 7, t | 61);
    return ((t ^ t >>> 14) >>> 0) / 4294967296;
  };
}

export function symbolElements(label, seed, source = 'hershey-simplex', height = 40, options = {}) {
  const rng = random(seed);
  const strokes = (options.cursive !== false && cursive[label]) ? cursive[label] : (() => {
    const available = [...templates, ...heldout].filter(t => t.label === label && t.source.startsWith(source));
    const template = available[Math.floor(rng() * available.length)] ?? templates.find(t => t.label === label);
    if (!template) {
      if (cursive[label]) return cursive[label];
      const upper = templates.find(t => t.label === label.toUpperCase());
      if (upper) return upper.strokes;
      throw new Error('missing template for ' + label);
    }
    return template.strokes;
  })();
  const flat = strokes.flat(), minX = Math.min(...flat.map(p => p[0])), minY = Math.min(...flat.map(p => p[1]));
  const span = Math.max(...flat.map(p => Math.max(p[0] - minX, p[1] - minY)), 8);
  const angle = (rng() - .5) * .26, shear = (rng() - .5) * .36, sx = .85 + rng() * .3, sy = .85 + rng() * .3;
  const width = span * (.05 + rng() * .055) * height / span;
  return strokes.map((stroke, i) => {
    const points = [];
    for (let j = 0; j < stroke.length; j++) {
      const a = stroke[j], b = stroke[Math.min(j + 1, stroke.length - 1)];
      const steps = Math.max(1, Math.floor(Math.hypot(b[0] - a[0], b[1] - a[1]) / (1 + rng() * 3)));
      for (let k = 0; k < steps; k++) {
        const t = k / steps, x = a[0] + (b[0] - a[0]) * t + (rng() - .5) * span * .025;
        const y = a[1] + (b[1] - a[1]) * t + (rng() - .5) * span * .025;
        points.push([(Math.cos(angle) * sx * x + (shear - Math.sin(angle)) * y) * height / span,
          (Math.sin(angle) * x + Math.cos(angle) * sy * y) * height / span]);
      }
    }
    return { id: `s${seed}-${i}`, type: 'freedraw', x: 0, y: 0, points, strokeWidth: width };
  });
}

export function rowElements(text, seed, height = 40, offset = [0, 0], options = {}) {
  const rng = random(seed), out = [];
  let cursor = 0, index = 0;
  for (const label of text) {
    if (label === ' ') { cursor += height * .35; index++; continue; }
    const elements = symbolElements(label, seed * 137 + index + 1, label === 'x' ? 'own' : 'hershey-simplex', height, options);
    const points = elements.flatMap(e => e.points);
    const x = Math.min(...points.map(p => p[0])), y = Math.min(...points.map(p => p[1]));
    const w = Math.max(...points.map(p => p[0])) - x, h = Math.max(...points.map(p => p[1])) - y;
    const operator = '+-=×÷:·*±<>≤≥≠'.includes(label), punctuation = '.,'.includes(label);
    const desiredH = label === '-' ? height * .02 : label === ',' ? height * .22 : punctuation || label === '·' ? height * .1 : label === '°' ? height * .22 : label === '/' ? height * .9 : operator ? (label === '=' ? .28 : .65) * height : height;
    const desiredW = label === '-' || label === '=' ? height * .65 : undefined;
    const sx = desiredW ? desiredW / Math.max(w, .01) : desiredH / Math.max(h, .01), sy = desiredH / Math.max(h, .01);
    const top = operator ? (height - desiredH) / 2 : label === ',' ? height * .78 : punctuation ? height * .9 : 0;
    for (const e of elements) {
      const p = e.points.map(point => {
        if (label === '.' || label === '·') return [(point[0] - x) * .1, top + (point[1] - y) * .1];
        const px = (point[0] - x) * sx, py = (point[1] - y) * sy + top;
        return [px + py * ((seed % 3 - 1) * .1), py + (rng() - .5) * height * .005];
      });
      out.push({ ...e, id: `${e.id}-${cursor}`, x: cursor + offset[0], y: offset[1], points: p, strokeWidth: height * (.055 + rng() * .015) });
    }
    cursor += (desiredW ?? w * sx) + height * .3;
    index++;
  }
  return out;
}

export function richRowElements(text, seed, height = 40, offset = [0, 0]) {
  const parts = [];
  for (let i = 0; i < text.length; i++) {
    if (text[i] === '^') {
      if (text[i + 1] === '{') {
        const end = text.indexOf('}', i + 2);
        if (end > i + 2) { parts.push({ text: text.slice(i + 2, end), sup: true }); i = end; continue; }
      }
      if (i + 1 < text.length) { parts.push({ text: text[i + 1], sup: true }); i++; continue; }
    }
    parts.push({ text: text[i] });
  }
  const out = [];
  let cursor = 0;
  for (const [index, part] of parts.entries()) {
    const partHeight = part.sup ? height * .55 : height;
    const partOffset = [offset[0] + cursor, offset[1] - (part.sup ? height * .42 : 0)];
    const elements = rowElements(part.text, seed * 131 + index + 1, partHeight, partOffset);
    out.push(...elements);
    const xs = elements.flatMap(e => e.points.map(p => e.x + p[0]));
    cursor += (xs.length ? Math.max(...xs) - Math.min(...xs) : 0) + height * (part.sup ? .12 : .3);
  }
  return out;
}

export async function drawElements(page, elements, input = 'pen', delay = 2) {
  const board = page.getByTestId('board');
  const view = await board.evaluate(el => ({
    x: Number(el.dataset.scrollX), y: Number(el.dataset.scrollY), zoom: Number(el.dataset.zoom),
  }));
  const canvas = page.locator('.excalidraw__canvas.interactive');
  const rect = await canvas.boundingBox();
  if (!rect) throw new Error('Canvas missing');
  const sx = (sceneX) => rect.x + (sceneX + view.x) * view.zoom;
  const sy = (sceneY) => rect.y + (sceneY + view.y) * view.zoom;
  const cdp = input === 'mouse' ? null : await page.context().newCDPSession(page);
  const down = async (x, y) => {
    if (!cdp) return page.mouse.down();
    if (input === 'pen') return cdp.send('Input.dispatchMouseEvent', { type: 'mousePressed', x, y, button: 'left', buttons: 1, clickCount: 1, pointerType: 'pen' });
    return cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x, y, id: 1, radiusX: 2, radiusY: 2, force: 1 }] });
  };
  const move = async (x, y) => {
    if (!cdp) return page.mouse.move(x, y, { steps: 1 });
    if (input === 'pen') return cdp.send('Input.dispatchMouseEvent', { type: 'mouseMoved', x, y, button: 'left', buttons: 1, pointerType: 'pen' });
    return cdp.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ x, y, id: 1, radiusX: 2, radiusY: 2, force: 1 }] });
  };
  const up = async (x, y) => {
    if (!cdp) return page.mouse.up();
    if (input === 'pen') return cdp.send('Input.dispatchMouseEvent', { type: 'mouseReleased', x, y, button: 'left', buttons: 0, clickCount: 1, pointerType: 'pen' });
    return cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
  };
  for (const element of elements) {
    const points = element.points;
    if (!points.length) continue;
    if (input !== 'touch') await move(sx(element.x + points[0][0]), sy(element.y + points[0][1]));
    await down(sx(element.x + points[0][0]), sy(element.y + points[0][1]));
    for (const point of points.slice(1)) {
      await move(sx(element.x + point[0]), sy(element.y + point[1]));
      if (delay) await page.waitForTimeout(delay);
    }
    await up(sx(element.x + points[points.length - 1][0]), sy(element.y + points[points.length - 1][1]));
  }
  await cdp?.detach();
}

export async function drawLine(page, text, seed, offset, input = 'pen', delay = 2) {
  return drawElements(page, rowElements(text, seed, 40, offset), input, delay);
}
