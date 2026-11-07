import { describe, expect, it } from 'vitest';
import { pickSymbolGuidesByCandidates, pickSymbolGuidesForSymbols, SYMBOL_GUIDES } from './uncertaintyGuides';
import type { RecognizedSymbol } from './handwriting';

describe('uncertaintyGuides', () => {
  it('selects 1 s háčkem and 7 s příčkou when 1 or 7 is among candidates', () => {
    const guides = pickSymbolGuidesByCandidates(['1']);
    const ids = guides.map(g => g.id);
    expect(ids).toContain('one-hook');
    expect(ids).toContain('seven-bar');
  });

  it('selects 4 otevřená when 4 or 9 is among candidates', () => {
    const guides = pickSymbolGuidesByCandidates(['4']);
    expect(guides.map(g => g.id)).toContain('four-open');

    const guides9 = pickSymbolGuidesByCandidates(['9']);
    expect(guides9.map(g => g.id)).toContain('four-open');
  });

  it('selects x vs × when x or × or * is present', () => {
    const guidesX = pickSymbolGuidesByCandidates(['x']);
    expect(guidesX.map(g => g.id)).toContain('x-multiply');

    const guidesTimes = pickSymbolGuidesByCandidates(['×']);
    expect(guidesTimes.map(g => g.id)).toContain('x-multiply');
  });

  it('selects comma vs dot for comma or dot candidates', () => {
    const guides = pickSymbolGuidesByCandidates([',']);
    expect(guides.map(g => g.id)).toContain('comma-dot');
  });

  it('selects division for : or / or ÷', () => {
    const guides = pickSymbolGuidesByCandidates([':']);
    expect(guides.map(g => g.id)).toContain('division-colon');

    const guidesSlash = pickSymbolGuidesByCandidates(['/']);
    expect(guidesSlash.map(g => g.id)).toContain('division-colon');
  });

  it('provides fallback standard guides when no known trigger is detected', () => {
    const guides = pickSymbolGuidesByCandidates(['unknown']);
    expect(guides.length).toBeGreaterThanOrEqual(2);
    expect(guides.map(g => g.id)).toContain('one-hook');
  });

  it('extracts candidate triggers from recognized symbols', () => {
    const symbol: RecognizedSymbol = {
      label: '1',
      strokeIds: ['s1'],
      strokeOrder: [0],
      bbox: { x: 0, y: 0, width: 20, height: 40 },
      candidates: [
        { label: '1', probability: 0.55 },
        { label: '7', probability: 0.35 },
      ],
      uncertain: true,
    };
    const guides = pickSymbolGuidesForSymbols([symbol]);
    const ids = guides.map(g => g.id);
    expect(ids).toContain('one-hook');
    expect(ids).toContain('seven-bar');
  });

  it('renders SVG for every guide pattern without error', () => {
    for (const guide of SYMBOL_GUIDES) {
      const svg = guide.renderSvg();
      expect(svg).toBeDefined();
    }
  });
});
