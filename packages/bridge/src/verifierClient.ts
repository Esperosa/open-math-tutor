import type { MathAstNode, MathStatement } from '@openmathtutor/shared';
import { record, text, oneOf } from './validation.js';

// Narrow local adapter: these HTTP transport shapes are specified in verifier/SPEC.md,
// not exported by shared. MathStatement itself is imported from the contract.
export interface VerifyRequest {
  topic: 'arithmetic' | 'fractions' | 'percentages' | 'linear_equation';
  task_statement: MathStatement | null;
  previous_step: MathStatement | null;
  current_step: MathStatement;
}
export interface VerifyResponse {
  status: 'equivalent' | 'not_equivalent' | 'ambiguous_domain' | 'invalid';
  reason: string; detail: string;
  counterexample: { symbol_values: Record<string, number> } | null;
}
export class VerifierUnavailable extends Error {}

function statement(value: unknown): value is MathStatement {
  let count = 0;
  const symbols = new Set<string>();
  const node = (v: unknown, depth = 0): v is MathAstNode => {
    if (++count > 200 || depth > 64 || !record(v)) return false;
    const recurse = (x: unknown) => node(x, depth + 1);
    switch (v.kind) {
      case 'num': return Number.isSafeInteger(v.value);
      case 'frac': return Number.isSafeInteger(v.numerator) && Number.isSafeInteger(v.denominator);
      case 'symbol':
        if (typeof v.name !== 'string' || !/^[a-zA-Z]$/.test(v.name)) return false;
        symbols.add(v.name); return symbols.size <= 6;
      case 'neg': return recurse(v.operand);
      case 'paren': return recurse(v.inner);
      case 'add': case 'sub': case 'mul': case 'div': return recurse(v.left) && recurse(v.right);
      case 'pow': return recurse(v.base) && recurse(v.exponent);
      default: return false;
    }
  };
  if (!record(value)) return false;
  return value.form === 'expression' ? node(value.value) :
    value.form === 'relation' && record(value.value) && oneOf(value.value.op, ['eq', 'lt', 'le', 'gt', 'ge']) &&
    node(value.value.lhs) && node(value.value.rhs);
}
export function validVerifyRequest(value: unknown): value is VerifyRequest {
  return record(value) && oneOf(value.topic, ['arithmetic', 'fractions', 'percentages', 'linear_equation']) &&
    (value.task_statement === null || statement(value.task_statement)) &&
    (value.previous_step === null || statement(value.previous_step)) && statement(value.current_step);
}
function validResponse(value: unknown): value is VerifyResponse {
  if (!record(value) || !oneOf(value.status, ['equivalent', 'not_equivalent', 'ambiguous_domain', 'invalid']) ||
      !text(value.reason, 1000) || typeof value.detail !== 'string' || value.detail.length > 8000) return false;
  if (value.counterexample === null) return true;
  return record(value.counterexample) && record(value.counterexample.symbol_values) &&
    Object.keys(value.counterexample.symbol_values).length <= 6 &&
    Object.entries(value.counterexample.symbol_values).every(([key, v]) => /^[a-zA-Z]$/.test(key) && typeof v === 'number' && Number.isFinite(v));
}

async function boundedJson(response: Response): Promise<unknown> {
  if (!response.body) throw new VerifierUnavailable('Empty verifier response.');
  const reader = response.body.getReader();
  const chunks: Uint8Array[] = []; let bytes = 0;
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      bytes += value.length;
      if (bytes > 64_000) throw new VerifierUnavailable('Oversized verifier response.');
      chunks.push(value);
    }
    return JSON.parse(Buffer.concat(chunks).toString('utf8'));
  } finally { await reader.cancel(); }
}

export class VerifierClient {
  constructor(private readonly baseUrl = 'http://127.0.0.1:4179', private readonly timeoutMs = 6000) {
    const url = new URL(baseUrl);
    if (url.protocol !== 'http:' || url.hostname !== '127.0.0.1' || url.username || url.password || url.pathname !== '/' || url.search || url.hash) {
      throw new Error('Verifier must use a loopback HTTP origin.');
    }
  }
  async health(): Promise<boolean> {
    try {
      const response = await fetch(`${this.baseUrl}/health`, { redirect: 'error', signal: AbortSignal.timeout(800) });
      const body = await boundedJson(response);
      return response.ok && record(body) && body.status === 'ok';
    } catch { return false; }
  }
  async verifyStep(body: VerifyRequest, signal?: AbortSignal): Promise<{ statusCode: number; body: unknown }> {
    if (!validVerifyRequest(body)) throw new TypeError('Invalid verifier request.');
    try {
      const response = await fetch(`${this.baseUrl}/verify-step`, {
        method: 'POST', redirect: 'error', headers: { 'content-type': 'application/json' },
        body: JSON.stringify(body), signal: signal ? AbortSignal.any([signal, AbortSignal.timeout(this.timeoutMs)]) : AbortSignal.timeout(this.timeoutMs),
      });
      const payload = await boundedJson(response);
      if (response.ok && !validResponse(payload)) throw new Error('Invalid verifier response.');
      if (!response.ok && !(record(payload) && (typeof payload.detail === 'string' || Array.isArray(payload.detail) || typeof payload.error === 'string'))) throw new Error('Invalid verifier error.');
      return { statusCode: response.status, body: payload };
    } catch { throw new VerifierUnavailable('Local verifier is unreachable or returned an invalid response.'); }
  }
}
