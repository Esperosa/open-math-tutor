import weights from './model/weights.json';
import type { Stroke } from './types';
import { rasterizeSymbol } from './raster';

export const CALIBRATION_STORAGE_KEY = 'omtop-handwriting-calibration-v1';
export const MODEL_LABELS: readonly string[] = weights.labels;

export interface PersonalSample {
  raster: number[]; // 784 float values in [0, 1]
  strokeCount: number;
  timestamp: number;
}

export interface PersonalCalibrationProfile {
  version: 1;
  updatedAt: number;
  samples: Record<string, PersonalSample[]>;
}

/** The canonical 16 characters for the personal calibration activity. */
export const CALIBRATION_SYMBOLS = [
  '0', '1', '2', '3', '4', '5', '6', '7', '8', '9',
  '+', '-', '=', '×', ':', ','
] as const;

export type CalibrationSymbol = typeof CALIBRATION_SYMBOLS[number];

export const CALIBRATION_DESCRIPTIONS: Record<CalibrationSymbol, { cs: string; en: string; guideLatex: string }> = {
  '0': { cs: 'Číslice nula', en: 'Digit zero', guideLatex: '0' },
  '1': { cs: 'Číslice jedna', en: 'Digit one', guideLatex: '1' },
  '2': { cs: 'Číslice dva', en: 'Digit two', guideLatex: '2' },
  '3': { cs: 'Číslice tři', en: 'Digit three', guideLatex: '3' },
  '4': { cs: 'Číslice čtyři', en: 'Digit four', guideLatex: '4' },
  '5': { cs: 'Číslice pět', en: 'Digit five', guideLatex: '5' },
  '6': { cs: 'Číslice šest', en: 'Digit six', guideLatex: '6' },
  '7': { cs: 'Číslice sedm', en: 'Digit seven', guideLatex: '7' },
  '8': { cs: 'Číslice osm', en: 'Digit eight', guideLatex: '8' },
  '9': { cs: 'Číslice devět', en: 'Digit nine', guideLatex: '9' },
  '+': { cs: 'Plus (sčítání)', en: 'Plus (addition)', guideLatex: '+' },
  '-': { cs: 'Mínus (odčítání)', en: 'Minus (subtraction)', guideLatex: '-' },
  '=': { cs: 'Rovná se', en: 'Equals', guideLatex: '=' },
  '×': { cs: 'Krát (násobení)', en: 'Times (multiplication)', guideLatex: '\\times' },
  ':': { cs: 'Děleno (dvojtečka / dělení)', en: 'Divide (colon / division)', guideLatex: ':' },
  ',': { cs: 'Desetinná čárka', en: 'Decimal comma', guideLatex: ',' },
};

/** Normalizes user input labels to model labels. */
export function normalizeCalibrationLabel(label: string): string {
  if (label === '−' || label === '–') return '-';
  if (label === '÷') return ':';
  if (label === '*' || label === '·') return '×';
  return label;
}

/** Loads personal calibration from localStorage (safe in any environment). */
export function loadPersonalCalibration(): PersonalCalibrationProfile | null {
  try {
    if (typeof localStorage === 'undefined') return null;
    const raw = localStorage.getItem(CALIBRATION_STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as PersonalCalibrationProfile;
    if (parsed.version === 1 && typeof parsed.updatedAt === 'number' && parsed.samples && typeof parsed.samples === 'object') {
      return parsed;
    }
  } catch {
    // Corrupted storage returns null cleanly
  }
  return null;
}

/** Saves personal calibration to localStorage. Never transmits over network. */
export function savePersonalCalibration(profile: PersonalCalibrationProfile): boolean {
  try {
    if (typeof localStorage === 'undefined') return false;
    localStorage.setItem(CALIBRATION_STORAGE_KEY, JSON.stringify(profile));
    return true;
  } catch {
    return false;
  }
}

/** Deletes personal calibration from localStorage. */
export function clearPersonalCalibration(): boolean {
  try {
    if (typeof localStorage === 'undefined') return false;
    localStorage.removeItem(CALIBRATION_STORAGE_KEY);
    return true;
  } catch {
    return false;
  }
}

/** Counts total user samples stored across all symbols. */
export function getPersonalSampleCount(profile?: PersonalCalibrationProfile | null): number {
  if (!profile?.samples) return 0;
  return Object.values(profile.samples).reduce((total, arr) => total + (Array.isArray(arr) ? arr.length : 0), 0);
}

/** Exports calibration profile as a formatted JSON string for download/backup. */
export function exportPersonalCalibrationJson(profile?: PersonalCalibrationProfile | null): string {
  const data = profile ?? loadPersonalCalibration() ?? { version: 1, updatedAt: Date.now(), samples: {} };
  return JSON.stringify(data, null, 2);
}

/** Imports calibration JSON string safely. */
export function importPersonalCalibrationJson(json: string): PersonalCalibrationProfile | null {
  try {
    const parsed = JSON.parse(json) as PersonalCalibrationProfile;
    if (parsed.version === 1 && parsed.samples && typeof parsed.samples === 'object') {
      const sanitized: PersonalCalibrationProfile = {
        version: 1,
        updatedAt: typeof parsed.updatedAt === 'number' ? parsed.updatedAt : Date.now(),
        samples: {},
      };
      for (const [key, samples] of Object.entries(parsed.samples)) {
        if (!Array.isArray(samples)) continue;
        const valid = samples.filter(s => Array.isArray(s.raster) && s.raster.length === 784);
        if (valid.length > 0) {
          sanitized.samples[normalizeCalibrationLabel(key)] = valid.slice(0, 10);
        }
      }
      savePersonalCalibration(sanitized);
      return sanitized;
    }
  } catch {
    return null;
  }
  return null;
}

/** Adds or updates a personal sample for a given label. */
export function addPersonalSample(
  label: string,
  rasterOrStrokes: Float32Array | number[] | readonly Stroke[],
  profile?: PersonalCalibrationProfile | null
): PersonalCalibrationProfile {
  const normLabel = normalizeCalibrationLabel(label);
  const current: PersonalCalibrationProfile = profile ?? loadPersonalCalibration() ?? {
    version: 1,
    updatedAt: Date.now(),
    samples: {},
  };

  let raster: number[];
  let strokeCount = 1;

  if (Array.isArray(rasterOrStrokes) && rasterOrStrokes.length > 0 && typeof (rasterOrStrokes[0] as unknown as Stroke)?.id === 'string') {
    const strokes = rasterOrStrokes as unknown as readonly Stroke[];
    strokeCount = strokes.length;
    raster = Array.from(rasterizeSymbol(strokes));
  } else {
    raster = Array.from(rasterOrStrokes as Float32Array | number[]);
  }

  if (raster.length !== 784) {
    throw new RangeError(`Expected 784 raster values, got ${raster.length}`);
  }

  const existing = current.samples[normLabel] ?? [];
  // Keep up to 8 samples per symbol to keep inference fast
  const updated = [...existing, { raster, strokeCount, timestamp: Date.now() }].slice(-8);

  const next: PersonalCalibrationProfile = {
    ...current,
    updatedAt: Date.now(),
    samples: {
      ...current.samples,
      [normLabel]: updated,
    },
  };

  savePersonalCalibration(next);
  return next;
}

/**
 * Computes cosine similarity between two 784-element vectors.
 */
function cosineSimilarity(a: Float32Array | readonly number[], b: readonly number[]): number {
  let dot = 0;
  let normA = 0;
  let normB = 0;
  for (let i = 0; i < 784; i++) {
    const va = a[i];
    const vb = b[i];
    dot += va * vb;
    normA += va * va;
    normB += vb * vb;
  }
  if (normA < 1e-6 || normB < 1e-6) return 0;
  return dot / (Math.sqrt(normA) * Math.sqrt(normB));
}

/**
 * Blends CNN logits with user prototype similarities.
 * Acts as a calibrated k-NN / nearest-centroid component:
 * - If input has high cosine similarity (>0.58) with a user sample of symbol L,
 *   a calibrated logit boost is applied to L.
 * - This reliably handles personal penmanship variations (e.g. continental 7,
 *   curved 1, looped 2) without overfitting.
 */
export function applyCalibrationBlending(
  logits: Float32Array,
  raster: Float32Array | readonly number[],
  profile: PersonalCalibrationProfile,
  weight = 3.5
): void {
  if (!profile.samples) return;

  const labelIndexMap = new Map<string, number>();
  for (let i = 0; i < MODEL_LABELS.length; i++) {
    labelIndexMap.set(MODEL_LABELS[i], i);
  }

  for (const [symbol, samples] of Object.entries(profile.samples)) {
    if (!samples || samples.length === 0) continue;
    const targetIdx = labelIndexMap.get(symbol);
    if (targetIdx === undefined) continue;

    // Find best match among user samples for this symbol
    let maxSim = 0;
    for (const sample of samples) {
      const sim = cosineSimilarity(raster, sample.raster);
      if (sim > maxSim) maxSim = sim;
    }

    // Meaningful similarity threshold for 28x28 stroke rasters
    if (maxSim > 0.58) {
      const boost = (maxSim - 0.5) * weight;
      logits[targetIdx] += boost;
    }
  }
}
