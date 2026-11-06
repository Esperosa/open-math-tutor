import { ProviderError } from '@openmathtutor/shared';

/** Inspect transient subprocess output only to classify; NEVER relay it or attach
 * it as a cause: status/errors can contain emails, keys, paths or model text. */
export function classifyFailure(value: unknown): ProviderError {
  if (value instanceof ProviderError) return value;
  const e = value as { code?: string; name?: string; message?: string };
  if (e?.code === 'ENOENT') return new ProviderError('cli_missing', 'Official provider CLI was not found on PATH.');
  if (e?.name === 'AbortError') return new ProviderError('cancelled', 'Request cancelled.');
  const message = typeof value === 'string' ? value : e?.message ?? '';
  if (/rate.?limit|429|usage limit|quota|out of credits/i.test(message)) return new ProviderError('rate_limited', 'Provider usage limit reached.');
  if (/not logged|not authenticated|login required|please (?:log|sign) in|authentication|unauthorized|401|invalid (?:api )?(?:key|token)|missing (?:api )?(?:key|credentials)|no (?:auth |api )?credentials|ANTHROPIC_API_KEY|apiKeyHelper/i.test(message)) return new ProviderError('not_authenticated', 'Sign in using the official CLI outside this app; the selected CLI mode must support that login.');
  if (/timeout|timed out|ETIMEDOUT/i.test(message)) return new ProviderError('timeout', 'Provider request timed out.');
  if (/terms of service|tos restriction|policy restriction/i.test(message)) return new ProviderError('tos_restricted', 'Provider policy does not permit this request.');
  if (/json|schema|malformed/i.test(message)) return new ProviderError('invalid_response', 'Provider returned invalid structured output.');
  return new ProviderError('provider_unavailable', 'Provider CLI or service is unavailable.');
}
