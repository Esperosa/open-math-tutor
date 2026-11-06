import { readFileSync } from 'node:fs';

type Point = [number, number];
interface Template { label: string; source: string; strokes: Point[][] }
export interface FixtureStroke { id: string; type: 'freedraw'; x: number; y: number; points: Point[]; strokeWidth: number }

const templates = JSON.parse(readFileSync(new URL('../../../tools/handwriting/templates.json', import.meta.url), 'utf8')) as Template[];
const heldout = JSON.parse(readFileSync(new URL('../../../tools/handwriting/heldout.json', import.meta.url), 'utf8')) as Template[];

export function random(seed: number): () => number {
  return () => {
    let t = seed += 0x6D2B79F5;
    t = Math.imul(t ^ t >>> 15, t | 1); t ^= t + Math.imul(t ^ t >>> 7, t | 61);
    return ((t ^ t >>> 14) >>> 0) / 4294967296;
  };
}

export function symbolElements(label: string, seed: number, source = 'hershey-simplex', height = 40): FixtureStroke[] {
  const rng = random(seed);
  const available = [...templates, ...heldout].filter(t => t.label === label && t.source.startsWith(source));
  const template = available[Math.floor(rng() * available.length)] ?? templates.find(t => t.label === label)!;
  const flat = template.strokes.flat(), minX = Math.min(...flat.map(p => p[0])), minY = Math.min(...flat.map(p => p[1]));
  const span = Math.max(...flat.map(p => Math.max(p[0] - minX, p[1] - minY)), 8);
  const angle = (rng() - .5) * .26, shear = (rng() - .5) * .36, sx = .85 + rng() * .3, sy = .85 + rng() * .3;
  const width = span * (.05 + rng() * .055) * height / span;
  return template.strokes.map((stroke, i) => {
    const points: Point[] = [];
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
    return { id: `s${seed}-${i}`, type: 'freedraw' as const, x: 0, y: 0, points, strokeWidth: width };
  });
}

export function rowElements(text: string, seed: number, height = 40, offset: Point = [0, 0]): FixtureStroke[] {
  const rng = random(seed), out: FixtureStroke[] = [];
  let cursor = 0, index = 0;
  for (const label of text) {
    const elements = symbolElements(label, seed * 137 + index + 1, label === 'x' ? 'own' : 'hershey-simplex', height);
    const points = elements.flatMap(e => e.points);
    const x = Math.min(...points.map(p => p[0])), y = Math.min(...points.map(p => p[1]));
    const w = Math.max(...points.map(p => p[0])) - x, h = Math.max(...points.map(p => p[1])) - y;
    const operator = '+-=×÷:·*±<>≤≥≠'.includes(label), punctuation = '.,'.includes(label);
    const desiredH = label === '-' ? height * .02 : punctuation || label === '·' ? height * .1 : label === '°' ? height * .22 : operator ? (label === '=' ? .28 : .65) * height : height;
    const desiredW = label === '-' || label === '=' ? height * .65 : undefined;
    const sx = desiredW ? desiredW / Math.max(w, .01) : desiredH / Math.max(h, .01), sy = desiredH / Math.max(h, .01);
    const top = operator ? (height - desiredH) / 2 : punctuation ? height * .9 : 0;
    for (const e of elements) {
      const p: Point[] = e.points.map(point => {
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

/** Exact geometry variants: a point, a short diagonal and a comma hook. */
export function decimalElements(shape: 'dot' | 'slash' | 'hook', offset: Point = [420, 260]): FixtureStroke[] {
  const points: Point[] = shape === 'dot' ? [[0, 0], [.1, .1]] : shape === 'slash' ? [[0, 0], [-3, 8]] : [[0, 0], [2, 3], [-2, 7]];
  return rowElements('2,5+1,5=4', 7, 60, offset).map(e => {
    const ys = e.points.map(p => p[1]);
    return Math.max(...ys) - Math.min(...ys) < 10 && Math.min(...ys) > 50
      ? { ...e, points: points.map(p => [p[0], p[1] + 56] as Point) } : e;
  });
}
export function standingFractionElements(offset: Point = [420, 260]): FixtureStroke[] {
  const fraction = (n: string, d: string, x: number, seed: number): FixtureStroke[] => [
    ...rowElements(n, seed, 35, [x + 10 + offset[0], offset[1]]),
    { id: `bar-${x}`, type: 'freedraw', x: x + offset[0], y: 45 + offset[1], points: [[0, 0], [50, 0]], strokeWidth: 2 },
    ...rowElements(d, seed + 1, 35, [x + 10 + offset[0], 58 + offset[1]]),
  ];
  return [...fraction('1', '2', 0, 13), ...rowElements('+', 11, 40, [65 + offset[0], 25 + offset[1]]),
    ...fraction('1', '3', 115, 17), ...rowElements('=', 19, 40, [185 + offset[0], 25 + offset[1]]), ...fraction('5', '6', 235, 23)];
}
export function noisyElements(): FixtureStroke[] {
  const rng = random(123);
  return rowElements('4=4', 13, 70, [420, 260]).map(e => ({ ...e,
    points: e.points.map(p => [p[0] + (rng() - .5) * 15, p[1] + (rng() - .5) * 15]) }));
}
