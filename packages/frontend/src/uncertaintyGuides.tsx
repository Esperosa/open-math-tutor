import type { ReactNode } from 'react';
import type { Locale } from '@openmathtutor/shared';
import type { RecognizedSymbol } from './handwriting';

export interface GuideDefinition {
  id: string;
  title: Record<Locale, string>;
  tip: Record<Locale, string>;
  candidateTriggers: string[];
  renderSvg(): ReactNode;
}

export const SYMBOL_GUIDES: GuideDefinition[] = [
  {
    id: 'one-hook',
    title: { cs: '1 s háčkem', en: '1 with hook' },
    tip: {
      cs: 'Piš 1 s výrazným šikmým háčkem nahoře a svislým tahem dolů.',
      en: 'Write 1 with a distinct diagonal hook at the top and a vertical stem.',
    },
    candidateTriggers: ['1'],
    renderSvg: () => (
      <g stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" fill="none">
        <path d="M12 20 L22 11 L22 35" />
        <path d="M14 35 L30 35" opacity="0.6" strokeWidth="2" />
      </g>
    ),
  },
  {
    id: 'seven-bar',
    title: { cs: '7 s příčkou', en: '7 with crossbar' },
    tip: {
      cs: 'Piš 7 s vodorovnou příčkou uprostřed, aby se nepletla s 1.',
      en: 'Write 7 with a horizontal crossbar across the stem so it is not confused with 1.',
    },
    candidateTriggers: ['7'],
    renderSvg: () => (
      <g stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" fill="none">
        <path d="M11 12 L29 12 L17 35" />
        <path d="M14 23 L26 23" />
      </g>
    ),
  },
  {
    id: 'four-open',
    title: { cs: '4 otevřená', en: '4 open-top' },
    tip: {
      cs: 'Piš 4 s otevřeným vrškem a zřetelným pravým úhlem.',
      en: 'Write 4 with an open top and a distinct right angle.',
    },
    candidateTriggers: ['4', '9'],
    renderSvg: () => (
      <g stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" fill="none">
        <path d="M23 11 L13 25 L29 25" />
        <path d="M23 17 L23 35" />
      </g>
    ),
  },
  {
    id: 'x-multiply',
    title: { cs: 'x vs ×', en: 'x vs ×' },
    tip: {
      cs: 'Proměnnou x piš zaobleně nebo dvěma obloučky, násobení jako tečku · nebo křížek ×.',
      en: 'Write variable x with curves or parentheses-arcs, multiplication as middle dot · or cross ×.',
    },
    candidateTriggers: ['x', '×', '*'],
    renderSvg: () => (
      <g stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" fill="none">
        <path d="M10 14 Q14 23 10 32" />
        <path d="M18 14 Q14 23 18 32" />
        <path d="M25 18 L33 28 M33 18 L25 28" opacity="0.65" strokeWidth="2" />
      </g>
    ),
  },
  {
    id: 'comma-dot',
    title: { cs: 'čárka vs tečka', en: 'comma vs dot' },
    tip: {
      cs: 'Desetinnou čárku piš s prohnutým ocáskem dolů, tečku jako pevný bod.',
      en: 'Write a decimal comma with a curved tail down, dot as a solid point on the baseline.',
    },
    candidateTriggers: [',', '.'],
    renderSvg: () => (
      <g stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" fill="none">
        <circle cx="14" cy="30" r="2.5" fill="currentColor" />
        <circle cx="26" cy="27" r="2" fill="currentColor" />
        <path d="M26 28 Q27 34 22 36" />
      </g>
    ),
  },
  {
    id: 'division-colon',
    title: { cs: 'dělení : /', en: 'division : /' },
    tip: {
      cs: 'Dělení piš jako dvě zřetelné tečky nad sebou nebo šikmé lomítko.',
      en: 'Write division as two distinct dots vertically aligned, or an angled slash.',
    },
    candidateTriggers: [':', '/', '÷'],
    renderSvg: () => (
      <g stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" fill="none">
        <circle cx="16" cy="18" r="2.2" fill="currentColor" />
        <circle cx="16" cy="28" r="2.2" fill="currentColor" />
        <path d="M24 33 L30 13" />
      </g>
    ),
  },
];

/**
 * Selects relevant handwriting guide patterns based on detected symbols and candidates.
 * Prioritizes the most likely confusing pairs (1/7, 4/9, x/×, ,/., :/÷).
 */
export function pickSymbolGuidesByCandidates(candidates: readonly string[]): GuideDefinition[] {
  const candSet = new Set(candidates);
  const matched: GuideDefinition[] = [];

  for (const guide of SYMBOL_GUIDES) {
    if (guide.candidateTriggers.some(c => candSet.has(c))) {
      matched.push(guide);
    }
  }

  // If 1 or 7 is triggered, always show both so student sees the difference
  if ((candSet.has('1') || candSet.has('7')) && !matched.some(g => g.id === 'seven-bar')) {
    const seven = SYMBOL_GUIDES.find(g => g.id === 'seven-bar');
    if (seven) matched.push(seven);
  }
  if ((candSet.has('1') || candSet.has('7')) && !matched.some(g => g.id === 'one-hook')) {
    const one = SYMBOL_GUIDES.find(g => g.id === 'one-hook');
    if (one) matched.unshift(one);
  }

  // Fallback default guides if no specific trigger matched
  if (!matched.length) {
    return [SYMBOL_GUIDES[0]!, SYMBOL_GUIDES[1]!, SYMBOL_GUIDES[3]!];
  }

  return matched;
}

export function pickSymbolGuidesForSymbols(symbols: readonly RecognizedSymbol[] | undefined): GuideDefinition[] {
  if (!symbols || !symbols.length) {
    return [SYMBOL_GUIDES[0]!, SYMBOL_GUIDES[1]!, SYMBOL_GUIDES[3]!];
  }
  const allCandidates: string[] = [];
  for (const s of symbols) {
    if (s.label) allCandidates.push(s.label);
    for (const c of s.candidates) {
      if (c.label) allCandidates.push(c.label);
    }
  }
  return pickSymbolGuidesByCandidates(allCandidates);
}
