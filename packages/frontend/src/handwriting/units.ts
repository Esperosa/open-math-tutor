import { normalizeUnit } from '@openmathtutor/shared';

const UNITS = ['m/s', 'mol/l', 'km/h', 'kg', 'J', 'N', 'mol', 'Ω', 'Kč', '°C', 'M', '%', 'm', 's', 'g', 'W', 'V', 'A'];

/** Context is an allowlist, not an answer: it can suggest spelling, never a value. */
export function unitAliasesFor(expectedUnit?: string, statement = ''): string[] {
  return UNITS.filter(unit => (expectedUnit && normalizeUnit(expectedUnit) === normalizeUnit(unit))
    || new RegExp(`(?:^|[\\s(])${unit.replace('/', '\\/')}(?=[\\s).,;?]|$)`).test(statement));
}

export function readUnitSuffix(text: string, aliases: readonly string[]): { expression: string; unit: string; uncertain: boolean } | null {
  for (const unit of aliases.filter(alias => UNITS.includes(alias)).sort((a, b) => b.length - a.length)) {
    if (text.endsWith(unit) && /\d$/.test(text.slice(0, -unit.length))) return { expression: text.slice(0, -unit.length), unit, uncertain: false };
    // Segmented handwritten m often becomes *n1, n3 or *n7; s resembles 2/5.
    // These suggestions retain uncertainty even if the resulting sum is true.
    const pattern = unit === 'm/s' ? /(?:[*×x]?n[137]?|m)[/1][s25]$/ : unit === 'kg' ? /k9$/ : null;
    const match = pattern?.exec(text);
    if (match && /\d$/.test(text.slice(0, match.index))) return { expression: text.slice(0, match.index), unit, uncertain: true };
  }
  return null;
}
