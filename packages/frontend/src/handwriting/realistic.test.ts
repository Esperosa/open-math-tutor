import { describe, expect, it } from 'vitest';
import { elementsToStrokes, recognizeBoardLines } from './index';
import { generateRealisticRow } from '../../../../tools/handwriting/realistic/generator';

describe('Realistic human handwriting pipeline tests', () => {
  it('correctly reads 5+1= without clustering failure or exponent hallucination', () => {
    for (const style5 of ['two-stroke', 'single'] as const) {
      for (const stylePlus of ['two-stroke', 'single'] as const) {
        for (const style1 of ['flag', 'straight'] as const) {
          const elements = generateRealisticRow('5+1=', 42, {
            height: 50,
            style5,
            stylePlus,
            style1,
            styleEqual: 'slanted-nonparallel',
            slantAngle: 0.15,
            mouseStep: 8,
            tremor: 0.5,
          });
          const recognized = recognizeBoardLines(elements);
          expect(recognized.length).toBe(1);
          expect(recognized[0].text).not.toContain('^');
          expect(recognized[0].text).toBe('5+1=');
        }
      }
    }
  });

  it('measures full rows across human styles: 5+1=6, 12+7=19, 2,5+1,5=4, 3·4=12, x+3=8', () => {
    const testCases: { text: string; expected: string; seeds: number[] }[] = [
      { text: '5+1=6', expected: '5+1=6', seeds: [101, 102, 103, 104] },
      { text: '12+7=19', expected: '12+7=19', seeds: [201, 202, 203, 204] },
      { text: '2,5+1,5=4', expected: '2,5+1,5=4', seeds: [301, 302, 303, 304] },
      { text: '3·4=12', expected: '3*4=12', seeds: [401, 402, 403, 404] },
      { text: 'x+3=8', expected: 'x+3=8', seeds: [501, 502, 503, 504] },
    ];

    let total = 0;
    let correct = 0;

    for (const tc of testCases) {
      for (const seed of tc.seeds) {
        const height = 25 + (seed % 4) * 28;
        const slantAngle = ((seed % 5) - 2) * 0.08;
        const mouseStep = 4 + (seed % 6) * 5;
        const elements = generateRealisticRow(tc.text, seed, {
          height,
          slantAngle,
          mouseStep,
          tremor: 0.35,
          styleEqual: 'slanted-nonparallel',
        });
        const recognized = recognizeBoardLines(elements);
        const actual = recognized[0]?.text ?? '';
        total++;
        if (actual === tc.expected) {
          correct++;
        }
      }
    }

    const accuracy = correct / total;
    console.log(`Realistic human rows accuracy: ${correct}/${total} = ${(accuracy * 100).toFixed(1)}%`);
    expect(accuracy).toBeGreaterThanOrEqual(0.85);
  });

  it('correctly handles touching adjacent characters without merging them into one monster glyph', () => {
    const elements = generateRealisticRow('5+1=6', 777, {
      height: 45,
      touchingNeighbors: true,
      style5: 'two-stroke',
      styleEqual: 'slanted-nonparallel',
    });
    const strokes = elementsToStrokes(elements);
    console.log('Strokes in row:', strokes.map(s => ({ id: s.id, x: s.bbox.x, w: s.bbox.width, y: s.bbox.y, h: s.bbox.height })));
    const recognized = recognizeBoardLines(elements);
    console.log('Touching elements symbols:', recognized[0]?.symbols.map(s => ({
      strokes: s.strokeIds,
      cand: s.candidates[0].label,
      box: s.bbox,
    })));
    expect(recognized.length).toBe(1);
    expect(recognized[0].symbols.length).toBe(5);
    expect(recognized[0].text).toBe('5+1=6');
  });

  it('correctly parses European 7 with crossbar and 2-stroke 5', () => {
    const el7 = generateRealisticRow('7', 123, { height: 60, style7: 'crossbar' });
    const rec7 = recognizeBoardLines(el7);
    expect(rec7.length).toBe(1);
    expect(rec7[0].text).toBe('7');

    const el5 = generateRealisticRow('5', 456, { height: 60, style5: 'two-stroke' });
    const rec5 = recognizeBoardLines(el5);
    expect(rec5.length).toBe(1);
    expect(rec5[0].text).toBe('5');
  });

  it('correctly handles variable sizes from 15 px to 150 px', () => {
    for (const height of [15, 25, 50, 90, 140]) {
      const elements = generateRealisticRow('12+7=19', 888 + height, {
        height,
        mouseStep: Math.max(2, Math.floor(height * 0.1)),
      });
      const recognized = recognizeBoardLines(elements);
      expect(recognized.length).toBe(1);
      expect(recognized[0].text).toBe('12+7=19');
    }
  });
});
