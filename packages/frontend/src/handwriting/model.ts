import weights from './model/weights.json';
import type { Candidate, Stroke } from './types';
import { rasterizeSymbol } from './raster';
import { CALIBRATION } from './calibration';
import type { PersonalCalibrationProfile } from './personalCalibration';
import { applyCalibrationBlending } from './personalCalibration';

// Decode without atob/Buffer so the exact same implementation runs in browsers and Node.
function decode(encoded: string): Float32Array {
  const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';
  const bytes = new Uint8Array(encoded.length * 3 / 4 - (encoded.endsWith('==') ? 2 : encoded.endsWith('=') ? 1 : 0));
  let bits = 0, value = 0, cursor = 0;
  for (const c of encoded) {
    if (c === '=') break;
    value = (value << 6) | alphabet.indexOf(c); bits += 6;
    if (bits >= 8) { bits -= 8; bytes[cursor++] = (value >> bits) & 255; }
  }
  const view = new DataView(bytes.buffer), result = new Float32Array(bytes.length / 4);
  for (let i = 0; i < result.length; i++) result[i] = view.getFloat32(i * 4, true);
  return result;
}
const tensors = Object.fromEntries(Object.entries(weights.tensors).map(([name, tensor]) => [name, decode(tensor.data)]));
export const MODEL_LABELS: readonly string[] = weights.labels;

/** Valid convolution, ReLU and 2x2 max-pool, fused to avoid intermediate allocations. NCHW layout. */
function convolution(input: Float32Array, size: number, inChannels: number, outChannels: number, kernel: number,
  w: Float32Array, bias: Float32Array): Float32Array {
  const convSize = size - kernel + 1, pooled = convSize / 2, output = new Float32Array(outChannels * pooled * pooled);
  for (let oc = 0; oc < outChannels; oc++) for (let py = 0; py < pooled; py++) for (let px = 0; px < pooled; px++) {
    let best = 0;
    for (let oy = 0; oy < 2; oy++) for (let ox = 0; ox < 2; ox++) {
      let sum = bias[oc], wi = oc * inChannels * kernel * kernel;
      for (let ic = 0; ic < inChannels; ic++) for (let ky = 0; ky < kernel; ky++) {
        let ii = ic * size * size + (py * 2 + oy + ky) * size + px * 2 + ox;
        for (let kx = 0; kx < kernel; kx++) sum += input[ii++] * w[wi++];
      }
      best = Math.max(best, sum);
    }
    output[oc * pooled * pooled + py * pooled + px] = best;
  }
  return output;
}
function dense(input: Float32Array, w: Float32Array, bias: Float32Array, relu: boolean): Float32Array {
  const out = new Float32Array(bias.length);
  for (let row = 0; row < bias.length; row++) {
    let sum = bias[row], offset = row * input.length;
    for (let i = 0; i < input.length; i++) sum += input[i] * w[offset++];
    out[row] = relu ? Math.max(0, sum) : sum;
  }
  return out;
}

/** Raw class logits before softmax, exposed for honest calibration fitting. */
export function classifyLogits(input: Float32Array): Float32Array {
  if (input.length !== 784 || input.some(v => !Number.isFinite(v) || v < 0 || v > 1)) throw new RangeError('Expected 784 finite pixels in [0,1]');
  const c1 = convolution(input, 28, 1, 16, 5, tensors['c1.weight'], tensors['c1.bias']);
  const c2 = convolution(c1, 12, 16, 32, 3, tensors['c2.weight'], tensors['c2.bias']);
  const d1 = dense(c2, tensors['d1.weight'], tensors['d1.bias'], true);
  return dense(d1, tensors['d2.weight'], tensors['d2.bias'], false);
}

export function softmax(logits: Float32Array | readonly number[], temperature = 1): Candidate[] {
  const scaled = Array.from(logits, v => temperature === 1 ? v : v / temperature);
  const max = Math.max(...scaled), exp = scaled.map(v => Math.exp(v - max)), total = exp.reduce((a, b) => a + b, 0);
  return exp.map((v, i) => ({ label: weights.labels[i], probability: v / total }))
    .sort((a, b) => b.probability - a.probability).slice(0, 3);
}

/** Full multiclass softmax (not a digits-only restricted classifier). Returns top three, unrenormalized. */
export function classifyRaster(input: Float32Array): Candidate[] {
  return softmax(classifyLogits(input), 1);
}

/** Temperature-scaled top three used by the live recognizer, with optional personal calibration blending. */
export function classifyRasterCalibrated(input: Float32Array, calibration?: PersonalCalibrationProfile | null): Candidate[] {
  const logits = classifyLogits(input);
  if (calibration && calibration.samples) {
    applyCalibrationBlending(logits, input, calibration);
  }
  return softmax(logits, CALIBRATION.temperature);
}

export function recognizeSymbol(strokes: readonly Stroke[], calibration?: PersonalCalibrationProfile | null): Candidate[] {
  return classifyRasterCalibrated(rasterizeSymbol(strokes), calibration);
}
