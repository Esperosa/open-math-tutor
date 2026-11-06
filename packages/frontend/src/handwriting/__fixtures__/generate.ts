import heldout from '../../../../../tools/handwriting/heldout.json';
import templates from '../../../../../tools/handwriting/templates.json';
import type { BoardElement, Point } from '../types';

export function random(seed: number): () => number {
  return () => {
    let t = seed += 0x6D2B79F5;
    t = Math.imul(t ^ t >>> 15, t | 1); t ^= t + Math.imul(t ^ t >>> 7, t | 61);
    return ((t ^ t >>> 14) >>> 0) / 4294967296;
  };
}
export const fixtureLabels = [...new Set(templates.map(t => t.label))];
/** Glyph families never seen in training (see tools/handwriting/prepare_templates.py). */
export const heldoutSources = ['heldout-complex', 'heldout-triplex'] as const;
export const variantTemplates = templates.filter(t => t.source.startsWith('variant:'));

/** Independently implemented TS augmenter; seeds and RNG differ from Python training. */
export function symbolElements(label: string, seed: number, source = 'hershey-simplex', height = 40): BoardElement[] {
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
    return { id: `s${seed}-${i}`, type: 'freedraw', x: 0, y: 0, points, strokeWidth: width };
  });
}

export function rowElements(text: string, seed: number, height = 40, offset: Point = [0, 0], overrides: Record<number, string> = {}): BoardElement[] {
  const rng = random(seed), out: BoardElement[] = [];
  let cursor = 0;
  const exponentIndex = text.indexOf('^');
  let index = 0;
  for (const original of text.replace('^', '')) {
    const label = original;
    const small = exponentIndex >= 0 && index >= exponentIndex;
    const scale = small ? .58 : 1;
    const elements = symbolElements(label, seed * 137 + index + 1, overrides[index] ?? (label === 'x' ? 'own' : 'hershey-simplex'), height * scale);
    const points = elements.flatMap(e => e.points!.map(p => p));
    const x = Math.min(...points.map(p => p[0])), y = Math.min(...points.map(p => p[1]));
    const w = Math.max(...points.map(p => p[0])) - x, h = Math.max(...points.map(p => p[1])) - y;
    const operator = '+-=×÷:·*±<>≤≥≠'.includes(label), punctuation = '.,'.includes(label);
    const desiredH = label === '-' ? height * .02 : punctuation || label === '·' ? height * .1 : label === '°' ? height * .22 : operator ? (label === '=' ? .28 : .65) * height : height * scale;
    const desiredW = label === '-' || label === '=' ? height * .65 : undefined;
    const sx = desiredW ? desiredW / Math.max(w, .01) : desiredH / Math.max(h, .01), sy = desiredH / Math.max(h, .01);
    const top = small ? -height * .12 : operator ? (height - desiredH) / 2 : punctuation ? height * .9 : 0;
    for (const e of elements) {
      const p: Point[] = e.points!.map(p => {
        if (label === '.' || label === '·') return [(p[0] - x) * .1, top + (p[1] - y) * .1];
        const px = (p[0] - x) * sx, py = (p[1] - y) * sy + top;
        return [px + py * ((seed % 3 - 1) * .1), py + (rng() - .5) * height * .005];
      });
      out.push({ ...e, x: cursor + offset[0], y: offset[1], points: p, strokeWidth: height * (.055 + rng() * .015) });
    }
    cursor += (desiredW ?? w * sx) + height * .3;
    index++;
  }
  return out;
}

export function fractionElements(seed: number, height = 40, offset: Point = [0, 0]): BoardElement[] {
  const a = rowElements('1', seed, height * .65, [offset[0] + height * .18, offset[1]]);
  const b = rowElements('2', seed + 1, height * .65, [offset[0] + height * .1, offset[1] + height * 1.2]);
  return [...a, { id: `bar${seed}`, type: 'freedraw', x: offset[0], y: offset[1] + height * .9,
    points: [[0, 0], [height, 0]], strokeWidth: height * .05 }, ...b];
}
