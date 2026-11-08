import type { Point } from '../../../packages/frontend/src/handwriting/types';

export interface RealisticStrokeElement {
  id: string;
  type: 'freedraw';
  x: number;
  y: number;
  points: Point[];
  strokeWidth: number;
}

export interface RealisticGeneratorOptions {
  height?: number; // 15 to 150 px
  slantAngle?: number; // radians (-0.35 to +0.35, approx +-20 deg)
  mouseStep?: number; // sampling spacing in px (3 to 40 px)
  tremor?: number; // 0.0 to 1.0 jitter / shakiness
  styleEqual?: 'parallel' | 'slanted-nonparallel';
  stylePlus?: 'single' | 'two-stroke';
  style1?: 'flag' | 'straight';
  style7?: 'plain' | 'crossbar';
  style5?: 'single' | 'two-stroke';
  touchingNeighbors?: boolean;
}

/** Seeded pseudo-random generator (LCG) for reproducible tests */
function pseudoRng(seed: number) {
  let s = (seed ^ 0x9e3779b9) >>> 0;
  return () => {
    s = (Math.imul(s, 1664525) + 1013904223) >>> 0;
    return ((s ^ (s >>> 14)) >>> 0) / 4294967296;
  };
}

/** Human-like jitter, tremor, and uneven mouse sampling along stroke segments. */
function humanizeStroke(
  points: readonly Point[],
  rng: () => number,
  mouseStep: number,
  tremor: number,
  scale: number,
  angle: number
): Point[] {
  if (points.length < 2) return points.map(p => [...p]);

  const cos = Math.cos(angle);
  const sin = Math.sin(angle);

  // 1. Resample with variable mouse speed (3 to 40 px steps)
  const sampled: Point[] = [points[0]];
  for (let i = 1; i < points.length; i++) {
    const a = points[i - 1];
    const b = points[i];
    const segLen = Math.hypot(b[0] - a[0], b[1] - a[1]);
    const step = Math.max(2.0, mouseStep * (0.6 + rng() * 0.8));
    const subSteps = Math.max(1, Math.floor(segLen / step));
    for (let s = 1; s < subSteps; s++) {
      const t = s / subSteps;
      sampled.push([a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t]);
    }
    sampled.push(b);
  }

  // 2. Add physical tremor and slant
  const out: Point[] = [];
  const span = Math.max(scale, 10);
  const phase = rng() * Math.PI * 2;
  for (let i = 0; i < sampled.length; i++) {
    const [origX, origY] = sampled[i];
    // Wave tremor + high-frequency noise
    const wave = Math.sin((origY / span) * 6 + phase) * span * 0.025 * tremor;
    const noiseX = (rng() - 0.5) * span * 0.03 * tremor;
    const noiseY = (rng() - 0.5) * span * 0.03 * tremor;
    const x = origX + wave + noiseX;
    const y = origY + noiseY;

    // Apply rotation around center
    const rotX = cos * x - sin * y;
    const rotY = sin * x + cos * y;
    out.push([rotX, rotY]);
  }
  return out;
}

/**
 * Generates raw stroke coordinates for individual mathematical glyphs with authentic
 * human variations (2-stroke 5, crossbar 7, hooked 1, non-parallel equals, 1- or 2-stroke plus).
 */
export function generateSymbolStrokes(
  char: string,
  seed: number,
  height: number,
  opts: RealisticGeneratorOptions = {}
): Point[][] {
  const rng = pseudoRng(seed);
  const w = height * (char === '1' ? 0.35 : char === '=' ? 0.65 : char === '+' ? 0.7 : 0.6);
  const h = height;

  switch (char) {
    case '5': {
      // 5: Either single continuous stroke, or 2 strokes (stem+loop, then top bar)
      const twoStroke = opts.style5 === 'two-stroke' || (opts.style5 === undefined && rng() > 0.4);
      if (twoStroke) {
        // Stroke 1: down-stem and bottom loop
        const s1: Point[] = [
          [w * 0.2, h * 0.15],
          [w * 0.15, h * 0.5],
          [w * 0.45, h * 0.42],
          [w * 0.85, h * 0.55],
          [w * 0.9, h * 0.78],
          [w * 0.6, h * 0.98],
          [w * 0.2, h * 0.95],
          [w * 0.05, h * 0.85],
        ];
        // Stroke 2: top horizontal bar (drawn after, or slightly offset)
        const barY = h * (0.08 + rng() * 0.06);
        const s2: Point[] = [
          [w * 0.15, barY],
          [w * 0.5, barY - h * 0.02 * (rng() - 0.5)],
          [w * 0.88 + w * 0.1 * (rng() - 0.5), barY + h * 0.02 * (rng() - 0.5)],
        ];
        return rng() > 0.5 ? [s1, s2] : [s2, s1];
      } else {
        // Single continuous 5
        return [[
          [w * 0.85, h * 0.1],
          [w * 0.2, h * 0.12],
          [w * 0.18, h * 0.48],
          [w * 0.5, h * 0.42],
          [w * 0.88, h * 0.56],
          [w * 0.88, h * 0.8],
          [w * 0.55, h * 0.98],
          [w * 0.15, h * 0.9],
        ]];
      }
    }

    case '1': {
      const withFlag = opts.style1 === 'flag' || (opts.style1 === undefined && rng() > 0.5);
      if (withFlag) {
        return [[
          [w * 0.1, h * 0.35],
          [w * 0.45, h * 0.08],
          [w * 0.5, h * 0.98],
        ]];
      } else {
        return [[
          [w * 0.5, h * 0.08],
          [w * 0.5, h * 0.98],
        ]];
      }
    }

    case '7': {
      const withCrossbar = opts.style7 === 'crossbar' || (opts.style7 === undefined && rng() > 0.4);
      const s1: Point[] = [
        [w * 0.1, h * 0.1],
        [w * 0.88, h * 0.1],
        [w * 0.35, h * 0.98],
      ];
      if (withCrossbar) {
        const crossY = h * 0.52;
        const s2: Point[] = [
          [w * 0.25, crossY],
          [w * 0.72, crossY + h * 0.02 * (rng() - 0.5)],
        ];
        return [s1, s2];
      }
      return [s1];
    }

    case '+': {
      const twoStroke = opts.stylePlus !== 'single';
      if (twoStroke) {
        const sVert: Point[] = [
          [w * 0.5, h * 0.15],
          [w * 0.5, h * 0.85],
        ];
        const sHoriz: Point[] = [
          [w * 0.15, h * 0.5],
          [w * 0.85, h * 0.5],
        ];
        return rng() > 0.5 ? [sVert, sHoriz] : [sHoriz, sVert];
      } else {
        // 1-stroke continuous plus
        return [[
          [w * 0.5, h * 0.15],
          [w * 0.5, h * 0.85],
          [w * 0.5, h * 0.5],
          [w * 0.15, h * 0.5],
          [w * 0.85, h * 0.5],
        ]];
      }
    }

    case '=': {
      // Non-parallel equals: lines with differing slants and slight length disparity
      const slant1 = (rng() - 0.5) * 0.18;
      const slant2 = (rng() - 0.5) * 0.18;
      const y1 = h * 0.38;
      const y2 = h * 0.62;
      const s1: Point[] = [
        [w * 0.1, y1 - w * 0.4 * slant1],
        [w * 0.9, y1 + w * 0.4 * slant1],
      ];
      const s2: Point[] = [
        [w * 0.12, y2 - w * 0.4 * slant2],
        [w * 0.88, y2 + w * 0.4 * slant2],
      ];
      return [s1, s2];
    }

    case '2': {
      return [[
        [w * 0.15, h * 0.25],
        [w * 0.5, h * 0.08],
        [w * 0.85, h * 0.25],
        [w * 0.8, h * 0.5],
        [w * 0.15, h * 0.92],
        [w * 0.88, h * 0.92],
      ]];
    }

    case '6': {
      return [[
        [w * 0.75, h * 0.15],
        [w * 0.2, h * 0.55],
        [w * 0.2, h * 0.85],
        [w * 0.5, h * 0.98],
        [w * 0.85, h * 0.8],
        [w * 0.7, h * 0.55],
        [w * 0.2, h * 0.6],
      ]];
    }

    case '9': {
      return [[
        [w * 0.8, h * 0.45],
        [w * 0.5, h * 0.1],
        [w * 0.18, h * 0.25],
        [w * 0.3, h * 0.55],
        [w * 0.82, h * 0.5],
        [w * 0.82, h * 0.95],
        [w * 0.35, h * 0.98],
      ]];
    }

    case '3': {
      return [[
        [w * 0.18, h * 0.15],
        [w * 0.8, h * 0.12],
        [w * 0.45, h * 0.48],
        [w * 0.85, h * 0.65],
        [w * 0.65, h * 0.95],
        [w * 0.15, h * 0.85],
      ]];
    }

    case '4': {
      return [
        [
          [w * 0.75, h * 0.1],
          [w * 0.15, h * 0.65],
          [w * 0.92, h * 0.65],
        ],
        [
          [w * 0.75, h * 0.3],
          [w * 0.75, h * 0.95],
        ],
      ];
    }

    case '8': {
      return [[
        [w * 0.5, h * 0.5],
        [w * 0.2, h * 0.28],
        [w * 0.5, h * 0.1],
        [w * 0.8, h * 0.28],
        [w * 0.5, h * 0.5],
        [w * 0.15, h * 0.75],
        [w * 0.5, h * 0.98],
        [w * 0.85, h * 0.75],
        [w * 0.5, h * 0.5],
      ]];
    }

    case '0': {
      return [[
        [w * 0.5, h * 0.1],
        [w * 0.18, h * 0.35],
        [w * 0.18, h * 0.75],
        [w * 0.5, h * 0.98],
        [w * 0.82, h * 0.75],
        [w * 0.82, h * 0.35],
        [w * 0.5, h * 0.1],
      ]];
    }

    case 'x': {
      return [
        [[w * 0.15, h * 0.25], [w * 0.85, h * 0.85]],
        [[w * 0.85, h * 0.25], [w * 0.15, h * 0.85]],
      ];
    }

    case '·': {
      const cy = h * 0.5;
      return [[[w * 0.45, cy], [w * 0.55, cy + 1], [w * 0.45, cy + 1]]];
    }

    case ',': {
      return [[[w * 0.4, h * 0.78], [w * 0.5, h * 0.82], [w * 0.35, h * 0.98]]];
    }

    default:
      return [[[w * 0.2, h * 0.2], [w * 0.8, h * 0.8]]];
  }
}

/**
 * Generate a complete handwritten math row as an array of BoardElements
 * passing through the exact same pipeline as the application.
 */
export function generateRealisticRow(
  text: string,
  seed: number,
  options: RealisticGeneratorOptions = {}
): RealisticStrokeElement[] {
  const rng = pseudoRng(seed);
  const height = Math.max(15, Math.min(150, options.height ?? (30 + rng() * 80)));
  const slant = options.slantAngle ?? (rng() - 0.5) * 0.45; // +-20 deg
  const mouseStep = options.mouseStep ?? (3.0 + rng() * 25.0); // 3 to 40 px
  const tremor = options.tremor ?? 0.7;
  const strokeThickness = Math.max(1.0, height * (0.045 + rng() * 0.02));

  const elements: RealisticStrokeElement[] = [];
  let cursorX = 50.0;
  const baseY = 80.0;

  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (ch === ' ') {
      cursorX += height * 0.35;
      continue;
    }

    const glyphStrokes = generateSymbolStrokes(ch, seed * 73 + i * 17 + 1, height, options);

    // Compute bounds
    const allPts = glyphStrokes.flat();
    const minX = Math.min(...allPts.map(p => p[0]));
    const maxX = Math.max(...allPts.map(p => p[0]));
    const glyphW = Math.max(maxX - minX, ch === '1' ? height * 0.35 : height * 0.15);

    for (let sIdx = 0; sIdx < glyphStrokes.length; sIdx++) {
      const rawStroke = glyphStrokes[sIdx];
      const humanized = humanizeStroke(rawStroke, rng, mouseStep, tremor, height, slant);

      // Translate to row cursor
      const finalPoints: Point[] = humanized.map(([px, py]) => [
        px - minX,
        py,
      ]);

      elements.push({
        id: `real-stroke-${seed}-${i}-${sIdx}`,
        type: 'freedraw',
        x: cursorX,
        y: baseY,
        points: finalPoints,
        strokeWidth: strokeThickness,
      });
    }

    // Advance cursor; if touchingNeighbors is true, set gap to touch
    const touchGap = options.touchingNeighbors ? -strokeThickness * 0.4 : (height * (0.12 + rng() * 0.15));
    cursorX += glyphW + touchGap;
  }

  return elements;
}
