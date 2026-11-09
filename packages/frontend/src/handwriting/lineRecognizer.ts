import { ctcAlign, ctcBeam, ctcGreedy, logSoftmax } from './ctc';
import type { CTCHypothesis } from './ctc';
import { inferLine, LINE_LABELS } from './lineModel';
import { rankLineCandidates } from './context';
import { canonicalTranscript } from './parse';
import { union } from './strokes';
import { MODEL_LABELS } from './model';
import { rasterizeSymbol } from './raster';
import { applyCalibrationBlending, normalizeCalibrationLabel } from './personalCalibration';
import { readUnitSuffix } from './units';
import calibration from './model/line-calibration.json';
import type { RecognitionOptions, RecognizedSymbol, Stroke } from './types';
import type { PersonalCalibrationProfile } from './personalCalibration';

/** CTC emits a linear transcript already. Do not spatially parse it a second time. */
export function canonicalLine(text: string, unitAliases: readonly string[] = []): string {
  return canonicalTranscript(text, unitAliases);
}

export function calibratedLineConfidence(raw: number): number {
  const mapping = calibration.mapping as { upper: number; probability: number }[];
  return mapping.find(b => raw <= b.upper)?.probability ?? raw;
}

export interface LineReading {
  text: string;
  transcript: string;
  confidence: number;
  rawConfidence: number;
  rawProbabilities: number[];
  symbols: RecognizedSymbol[];
  logProbability: number;
  uncertain?: boolean;
}

/** Character boxes partition the forced-alignment frames, including intervening
 * blanks. A connected pen stroke can legitimately occur in several characters;
 * stroke IDs are an association, not a false promise of exact segmentation.
 */
export function recognizeStrokeLine(strokes: readonly Stroke[], options: RecognitionOptions = {}, profile: PersonalCalibrationProfile | null = null,
  comparison?: { text: string; confidence: number }, prepared?: ReturnType<typeof inferLine>) {
  const input = prepared ?? inferLine(strokes), classes = LINE_LABELS.length;
  const logp = logSoftmax(input.logits, classes);
  const greedy = ctcGreedy(logp, LINE_LABELS);
  // Agreement with an already calibrated readable CNN row needs no expensive
  // N-best materialization. Keep its measured probabilities rather than mix
  // unrelated frame evidence with legacy multiclass calibration.
  if (comparison && comparison.confidence >= .95 && canonicalLine(greedy.text, options.unitAliases) === comparison.text) {
    return { best: undefined, candidates: [] as LineReading[], rawText: comparison.text, transcript: greedy.text };
  }
  const hypotheses = ctcBeam(logp, LINE_LABELS);
  if (!hypotheses.some(h => h.text === greedy.text)) hypotheses.push(greedy);
  const frames = logp.length / classes;
  const prototypeCache = new Map<string, Float32Array>();
  const build = (h: CTCHypothesis): LineReading | null => {
    const aligned = ctcAlign(logp, classes, h.tokens);
    if (!aligned || aligned.some(a => !a.length)) return null;
    const centers = aligned.map((a, i) => a.reduce((best, t) => logp[t * classes + h.tokens[i]] > logp[best * classes + h.tokens[i]] ? t : best, a[0]));
    let personalPrior = 0;
    const symbols: RecognizedSymbol[] = h.tokens.map((token, i) => {
      const first = i ? Math.floor((aligned[i - 1].at(-1)! + aligned[i][0]) / 2) + 1 : 0;
      const last = i + 1 < aligned.length ? Math.floor((aligned[i].at(-1)! + aligned[i + 1][0]) / 2) : frames - 1;
      const from = Math.max(0, 2 * first - 1), to = Math.min(input.points.length, 2 * last + 3);
      const indices = [...new Set(input.strokeIndices.slice(from, to))];
      const associated = indices.map(si => strokes[si]);
      const fragments = indices.map(si => {
        const points = input.points.slice(from, to).filter((_, offset) => input.strokeIndices[from + offset] === si);
        return { ...strokes[si], points, bbox: union(points.map(([x, y]) => ({ x, y, width: 0, height: 0 }))) };
      });
      const probabilities = LINE_LABELS.map((label, c) => ({ label, probability: Math.exp(logp[centers[i] * classes + c]) }));
      const raw = probabilities[token].probability;
      const selected = { label: LINE_LABELS[token], probability: raw };
      const confidence = calibratedLineConfidence(raw);
      // Prototype correction can reorder hypotheses, never create extra tokens.
      // The user's existing raster samples remain local and use the same k-NN.
      const personalLabel = normalizeCalibrationLabel(selected.label);
      if (profile?.samples[personalLabel]?.length && associated.length) {
        const cacheKey = `${from}:${to}`;
        let boosts = prototypeCache.get(cacheKey);
        if (!boosts) {
          // Zero logits isolate the existing cosine-prototype boost. A whole
          // CNN classification is neither needed nor a personal-style prior.
          boosts = new Float32Array(MODEL_LABELS.length);
          applyCalibrationBlending(boosts, rasterizeSymbol(fragments), profile);
          prototypeCache.set(cacheKey, boosts);
        }
        const index = MODEL_LABELS.indexOf(personalLabel);
        if (index >= 0) personalPrior += boosts[index];
      }
      const candidates = [selected, ...probabilities.filter(c => c.label && c.label !== selected.label).sort((a, b) => b.probability - a.probability).slice(0, 2)].sort((a, b) => b.probability - a.probability);
      const competitor = candidates.find(c => c.label !== selected.label)?.probability ?? 0;
      return { label: selected.label, candidates, confidence, ctcIndex: i, ctcKey: `${h.tokens.join(',')}:${i}`, bbox: union(input.points.slice(from, to).map(([x, y]) => ({ x, y, width: 0, height: 0 }))),
        strokeIds: associated.map(s => s.id), strokeOrder: associated.map(s => s.order),
        uncertain: confidence < (options.confidenceThreshold ?? calibration.threshold) || raw - competitor < (options.marginThreshold ?? .2) };
    });
    return { text: canonicalLine(h.text, options.unitAliases), transcript: h.text,
      ...(readUnitSuffix(h.text, options.unitAliases ?? [])?.uncertain ? { uncertain: true } : {}),
      rawProbabilities: centers.map((t, i) => Math.exp(logp[t * classes + h.tokens[i]])),
      rawConfidence: Math.exp(centers.reduce((sum, t, i) => sum + logp[t * classes + h.tokens[i]], 0) / centers.length),
      confidence: Math.exp(symbols.reduce((sum, s) => sum + Math.log(Math.max(1e-12, s.confidence ?? 0)), 0) / symbols.length),
      symbols, logProbability: h.logProbability + personalPrior };
  };
  const candidates = hypotheses.map(build).filter((r): r is LineReading => r !== null);
  const ranked = rankLineCandidates(candidates, options);
  return { best: ranked[0], candidates: ranked, rawText: canonicalLine(greedy.text, options.unitAliases), transcript: greedy.text };
}
