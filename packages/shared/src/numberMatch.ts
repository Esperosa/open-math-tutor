/** Match a value, or the explicit lower-precision decimal the student wrote.
 * No percentage-wide acceptance band: extra decimal places never buy slack.
 * Recurring fractions also permit truncation (e.g. 2/3 written as 0.66).
 */
export function numberMatches(expected: number, given: number, written: string, fractionRounding = false): boolean {
  const close = (a: number, b: number) => Math.abs(a - b) <= 64 * Number.EPSILON * Math.max(Math.abs(a), Math.abs(b), Number.MIN_VALUE);
  if (close(expected, given)) return true;
  const literal = /^[-−]?(\d+)[.,](\d+)(?:\s*(?:[eE]\s*([+\-−]?\d+)|[·×xX*]\s*10\s*\^?\s*([+\-−]?\d+)))?$/.exec(written.trim());
  if (!literal) return false; // integers, fractions and expressions are exact
  const places = literal[2]!.length - Number((literal[3] ?? literal[4] ?? '0').replace('−', '-'));
  const factor = 10 ** places;
  const scaled = Math.abs(expected) * factor;
  if (!Number.isFinite(scaled) || !Number.isFinite(factor) || factor === 0 || close(scaled, Math.round(scaled))) return false;
  // Cap scientific/measurement rounding at 0.1 %. Explicit school fractions
  // keep the documented two-or-more-place rounding/truncation convention.
  if (!(fractionRounding && places >= 2) && Math.abs(given - expected) > Math.abs(expected) * (1e-3 + 16 * Number.EPSILON)) return false;
  const sign = Math.sign(expected);
  const halfUp = Math.floor(scaled + 0.5 + 16 * Number.EPSILON * scaled);
  if (close(given, sign * halfUp / factor)) return true;
  // Only recurring/high-precision results permit chopping off the remaining digits.
  const mantissa = Math.abs(expected).toString().split('e')[0]!;
  return fractionRounding && (mantissa.split('.')[1]?.length ?? 0) > 12 && close(given, sign * Math.floor(scaled) / factor);
}
