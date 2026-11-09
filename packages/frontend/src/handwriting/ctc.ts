/** Log-space CTC algorithms. Blank is class zero; no grammar/answer model here. */
export interface CTCHypothesis { text: string; tokens: number[]; logProbability: number }
const add = (a: number, b: number): number => a === -Infinity ? b : b === -Infinity ? a : Math.max(a, b) + Math.log1p(Math.exp(-Math.abs(a - b)));
function dimensions(logp: Float32Array, classes: number): void {
  if (!Number.isInteger(classes) || classes < 2 || classes > 256 || logp.length % classes || logp.length / classes > 2048) throw new RangeError('Invalid or oversized CTC lattice');
}

export function logSoftmax(logits: Float32Array, classes: number, temperature = 1): Float32Array {
  if (!Number.isInteger(classes) || classes < 2 || logits.length % classes || !Number.isFinite(temperature) || temperature <= 0) throw new RangeError('Invalid CTC dimensions/temperature');
  const out = new Float32Array(logits.length);
  for (let t = 0; t < logits.length; t += classes) {
    let max = -Infinity, sum = 0;
    for (let c = 0; c < classes; c++) {
      if (!Number.isFinite(logits[t + c])) throw new RangeError('Non-finite CTC logits');
      max = Math.max(max, logits[t + c] / temperature);
    }
    for (let c = 0; c < classes; c++) sum += Math.exp(logits[t + c] / temperature - max);
    const z = max + Math.log(sum);
    for (let c = 0; c < classes; c++) out[t + c] = logits[t + c] / temperature - z;
  }
  return out;
}

export function ctcGreedy(logp: Float32Array, labels: readonly string[]): CTCHypothesis {
  dimensions(logp, labels.length);
  const tokens: number[] = [];
  let previous = 0, score = 0;
  for (let t = 0; t < logp.length; t += labels.length) {
    let best = 0;
    for (let c = 1; c < labels.length; c++) if (logp[t + c] > logp[t + best]) best = c;
    if (best && best !== previous) tokens.push(best);
    score += logp[t + best]; previous = best;
  }
  return { text: tokens.map(c => labels[c]).join(''), tokens, logProbability: score };
}

/** Prefix beam sums ALL retained blank/nonblank paths, including repeated letters. */
export function ctcBeam(logp: Float32Array, labels: readonly string[], width = 12): CTCHypothesis[] {
  dimensions(logp, labels.length);
  if (!Number.isInteger(width) || width < 1 || width > 64 || logp.length % labels.length) throw new RangeError('Invalid CTC beam');
  interface Prefix { tokens: number[]; blank: number; nonblank: number }
  let beam: Prefix[] = [{ tokens: [], blank: 0, nonblank: -Infinity }];
  for (let t = 0; t < logp.length; t += labels.length) {
    // Pruning only very improbable frame classes bounds browser work. Blank and
    // a prefix's final class are always included (essential for repeated digits).
    const classes = Array.from({ length: labels.length - 1 }, (_, i) => i + 1).sort((a, b) => logp[t + b] - logp[t + a]).slice(0, 8);
    const next = new Map<string, Prefix>();
    const get = (tokens: number[]): Prefix => {
      const key = tokens.join(',');
      let p = next.get(key);
      if (!p) { p = { tokens, blank: -Infinity, nonblank: -Infinity }; next.set(key, p); }
      return p;
    };
    for (const prefix of beam) {
      const total = add(prefix.blank, prefix.nonblank), last = prefix.tokens.at(-1);
      const same = get(prefix.tokens);
      same.blank = add(same.blank, total + logp[t]);
      for (const c of new Set(last ? [...classes, last] : classes)) {
        if (last === c) same.nonblank = add(same.nonblank, prefix.nonblank + logp[t + c]);
        if (prefix.tokens.length < 128) {
          const extended = get([...prefix.tokens, c]);
          extended.nonblank = add(extended.nonblank, (last === c ? prefix.blank : total) + logp[t + c]);
        }
      }
    }
    beam = [...next.values()].sort((a, b) => add(b.blank, b.nonblank) - add(a.blank, a.nonblank)).slice(0, width);
  }
  return beam.map(p => ({ text: p.tokens.map(c => labels[c]).join(''), tokens: p.tokens, logProbability: add(p.blank, p.nonblank) }));
}

/** Forced Viterbi alignment to a decoded sequence, NOT the reference label. */
export function ctcAlign(logp: Float32Array, classes: number, tokens: readonly number[]): number[][] | null {
  dimensions(logp, classes);
  if (tokens.some(c => !Number.isInteger(c) || c <= 0 || c >= classes)) throw new RangeError('Invalid CTC token');
  const frames = logp.length / classes, states = 2 * tokens.length + 1;
  if (!tokens.length || !frames || tokens.length > 128 || frames > 2048) return null;
  const path = new Int16Array(frames * states);
  let scores = new Float64Array(states).fill(-Infinity);
  scores[0] = logp[0]; scores[1] = logp[tokens[0]];
  for (let t = 1; t < frames; t++) {
    const next = new Float64Array(states).fill(-Infinity);
    for (let s = 0; s < states; s++) {
      const label = s % 2 ? tokens[(s - 1) / 2] : 0;
      let previous = s;
      if (s > 0 && scores[s - 1] > scores[previous]) previous = s - 1;
      if (s > 1 && label && label !== tokens[(s - 3) / 2] && scores[s - 2] > scores[previous]) previous = s - 2;
      next[s] = scores[previous] + logp[t * classes + label]; path[t * states + s] = previous;
    }
    scores = next;
  }
  let state = scores[states - 1] > scores[states - 2] ? states - 1 : states - 2;
  if (!Number.isFinite(scores[state])) return null;
  const aligned = Array.from({ length: tokens.length }, () => [] as number[]);
  for (let t = frames - 1; t >= 0; t--) {
    if (state % 2) aligned[(state - 1) / 2].push(t);
    state = path[t * states + state];
  }
  return aligned.map(a => a.reverse());
}
