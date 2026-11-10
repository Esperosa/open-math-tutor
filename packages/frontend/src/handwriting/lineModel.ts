/** Local conv + bidirectional GRUs, matching PyTorch r,z,n gate order.
 * No ONNX/WASM/network/runtime dependencies. Weights are MathWriting-derived,
 * CC BY-NC-SA 4.0; see NOTICE.md. Float32 little-endian base64 is only storage.
 */
import model from './model/line-weights.json';
import { lineFeatures } from './lineFeatures';
import type { Stroke } from './types';

export const LINE_LABELS: readonly string[] = model.labels;
interface Tensor { shape: number[]; data: string }
const tensors = new Map<string, Float32Array>();

function weights(name: string): Float32Array {
  let cached = tensors.get(name);
  if (!cached) {
    const tensor = (model.weights as Record<string, Tensor>)[name];
    if (!tensor) throw new Error(`Missing line tensor ${name}`);
    const bytes = atob(tensor.data), view = new DataView(new ArrayBuffer(bytes.length));
    for (let i = 0; i < bytes.length; i++) view.setUint8(i, bytes.charCodeAt(i));
    cached = new Float32Array(bytes.length / 4);
    for (let i = 0; i < cached.length; i++) cached[i] = view.getFloat32(i * 4, true);
    if (cached.length !== tensor.shape.reduce((a, b) => a * b, 1) || cached.some(v => !Number.isFinite(v))) throw new Error(`Invalid line tensor ${name}`);
    tensors.set(name, cached);
  }
  return cached;
}

function conv(x: Float32Array): Float32Array {
  const n = x.length / 6, frames = Math.ceil(n / 2), out = new Float32Array(frames * 48);
  const w = weights('conv.weight'), b = weights('conv.bias');
  for (let t = 0; t < frames; t++) for (let c = 0; c < 48; c++) {
    let sum = b[c];
    for (let i = 0; i < 6; i++) for (let k = 0; k < 5; k++) {
      const at = 2 * t + k - 2;
      if (at >= 0 && at < n) sum += x[at * 6 + i] * w[(c * 6 + i) * 5 + k];
    }
    out[t * 48 + c] = Math.max(0, sum);
  }
  return out;
}

const sigmoid = (x: number): number => 1 / (1 + Math.exp(-x));

function recurrent(x: Float32Array, inputs: number, layer: number, hidden: number): Float32Array {
  const frames = x.length / inputs, gates = hidden * 3;
  const out = new Float32Array(frames * hidden * 2);
  for (const reverse of [false, true]) {
    const suffix = `_l${layer}${reverse ? '_reverse' : ''}`;
    const wi = weights(`gru.weight_ih${suffix}`), wh = weights(`gru.weight_hh${suffix}`);
    const bi = weights(`gru.bias_ih${suffix}`), bh = weights(`gru.bias_hh${suffix}`);
    const h = new Float32Array(hidden), input = new Float32Array(gates), state = new Float32Array(gates);
    for (let iteration = 0; iteration < frames; iteration++) {
      const t = reverse ? frames - 1 - iteration : iteration;
      for (let g = 0; g < gates; g++) {
        let sumI = bi[g], sumH = bh[g];
        const rowI = g * inputs, rowH = g * hidden, offset = t * inputs;
        // All dimensions in the pinned architecture are divisible by four.
        // Unroll dot products to reduce bounds/loop overhead in browser JS.
        for (let i = 0; i < inputs; i += 4) sumI += wi[rowI + i] * x[offset + i] + wi[rowI + i + 1] * x[offset + i + 1]
          + wi[rowI + i + 2] * x[offset + i + 2] + wi[rowI + i + 3] * x[offset + i + 3];
        for (let i = 0; i < hidden; i += 4) sumH += wh[rowH + i] * h[i] + wh[rowH + i + 1] * h[i + 1]
          + wh[rowH + i + 2] * h[i + 2] + wh[rowH + i + 3] * h[i + 3];
        input[g] = sumI; state[g] = sumH;
      }
      for (let i = 0; i < hidden; i++) {
        const r = sigmoid(input[i] + state[i]), z = sigmoid(input[hidden + i] + state[hidden + i]);
        const n = Math.tanh(input[hidden * 2 + i] + r * state[hidden * 2 + i]);
        h[i] = (1 - z) * n + z * h[i];
        out[t * hidden * 2 + (reverse ? hidden : 0) + i] = h[i];
      }
    }
  }
  return out;
}

export function lineLogits(features: Float32Array): Float32Array {
  if (features.length % 6 || features.length > 1280 * 6 || features.some(v => !Number.isFinite(v))) throw new RangeError('Invalid line feature tensor');
  if (!features.length) return new Float32Array();
  const tensor0 = (model.weights as Record<string, Tensor>)['gru.weight_ih_l0'];
  const hidden = tensor0 ? tensor0.shape[0] / 3 : 64;
  const numLayers = Object.keys(model.weights).filter(k => k.startsWith('gru.weight_ih_l') && !k.includes('reverse')).length || 2;
  let x = conv(features);
  for (let l = 0; l < numLayers; l++) {
    const inDim = l === 0 ? 48 : hidden * 2;
    x = recurrent(x, inDim, l, hidden);
  }
  const headDim = hidden * 2;
  const w = weights('head.weight'), b = weights('head.bias'), classes = LINE_LABELS.length;
  const frames = x.length / headDim;
  const out = new Float32Array(frames * classes);
  for (let t = 0; t < frames; t++) for (let c = 0; c < classes; c++) {
    let sum = b[c];
    for (let i = 0; i < headDim; i += 4) sum += w[c * headDim + i] * x[t * headDim + i] + w[c * headDim + i + 1] * x[t * headDim + i + 1]
      + w[c * headDim + i + 2] * x[t * headDim + i + 2] + w[c * headDim + i + 3] * x[t * headDim + i + 3];
    out[t * classes + c] = sum;
  }
  return out;
}

export function inferLine(strokes: readonly Stroke[]) {
  const input = lineFeatures(strokes);
  return { ...input, logits: lineLogits(input.features) };
}
