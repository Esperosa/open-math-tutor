// @vitest-environment jsdom
import { describe, expect, it, beforeEach } from 'vitest';
import {
  CALIBRATION_SYMBOLS,
  addPersonalSample,
  clearPersonalCalibration,
  exportPersonalCalibrationJson,
  getPersonalSampleCount,
  importPersonalCalibrationJson,
  loadPersonalCalibration,
  type PersonalCalibrationProfile,
} from './personalCalibration';
import { recognizeSymbol } from './model';
import { rasterizeSymbol } from './raster';
import type { Stroke } from './types';

describe('Personal handwriting calibration (Naučit se moje písmo)', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('provides the canonical 16 characters for math whiteboard handwriting', () => {
    expect(CALIBRATION_SYMBOLS).toHaveLength(16);
    expect(CALIBRATION_SYMBOLS).toEqual([
      '0', '1', '2', '3', '4', '5', '6', '7', '8', '9',
      '+', '-', '=', '×', ':', ','
    ]);
  });

  it('loads, saves, and clears calibration in localStorage', () => {
    expect(loadPersonalCalibration()).toBeNull();

    const dummyRaster = new Array(784).fill(0);
    dummyRaster[100] = 1.0;
    const profile = addPersonalSample('7', dummyRaster);

    expect(profile.version).toBe(1);
    expect(getPersonalSampleCount(profile)).toBe(1);
    expect(profile.samples['7']).toHaveLength(1);

    const reloaded = loadPersonalCalibration();
    expect(reloaded).not.toBeNull();
    expect(reloaded?.samples['7']).toHaveLength(1);

    clearPersonalCalibration();
    expect(loadPersonalCalibration()).toBeNull();
  });

  it('exports and imports valid JSON profiles cleanly', () => {
    const dummyRaster = new Array(784).fill(0);
    for (let i = 0; i < 50; i++) dummyRaster[i * 10] = 0.8;
    addPersonalSample('=', dummyRaster);

    const json = exportPersonalCalibrationJson();
    expect(typeof json).toBe('string');
    const parsed = JSON.parse(json);
    expect(parsed.version).toBe(1);
    expect(parsed.samples['=']).toHaveLength(1);

    clearPersonalCalibration();
    expect(loadPersonalCalibration()).toBeNull();

    const imported = importPersonalCalibrationJson(json);
    expect(imported).not.toBeNull();
    expect(imported?.samples['=']).toHaveLength(1);
    expect(loadPersonalCalibration()?.samples['=']).toHaveLength(1);
  });

  it('measures measurable improvement on idiosyncratic personal styles before vs after calibration', () => {
    // Simulate a writer who writes '7' with a heavy European crossbar and straight top,
    // which in small CNN models can be confused or borderline with '+' or '1'.
    const stem: Stroke = {
      id: 's1',
      points: [[15, 5], [28, 5], [14, 45]],
      width: 2.5,
      order: 0,
      bbox: { x: 14, y: 5, width: 14, height: 40 },
    };
    const crossbar: Stroke = {
      id: 's2',
      points: [[8, 23], [24, 23]],
      width: 2.5,
      order: 1,
      bbox: { x: 8, y: 23, width: 16, height: 1 },
    };

    const strokes = [stem, crossbar];
    const raster = rasterizeSymbol(strokes);

    // Initial recognition without calibration
    const rawCandidates = recognizeSymbol(strokes, null);
    const initialSevenProb = rawCandidates.find(c => c.label === '7')?.probability ?? 0;

    // Create personal calibration sample for the user's specific '7'
    const profile: PersonalCalibrationProfile = {
      version: 1,
      updatedAt: Date.now(),
      samples: {
        '7': [{
          raster: Array.from(raster),
          strokeCount: 2,
          timestamp: Date.now(),
        }],
      },
    };

    // Recognition with personal calibration
    const calibratedCandidates = recognizeSymbol(strokes, profile);
    const calibratedSeven = calibratedCandidates[0];

    // Assert that '7' is the top candidate and confidence improved significantly
    expect(calibratedSeven.label).toBe('7');
    expect(calibratedSeven.probability).toBeGreaterThan(initialSevenProb);
    expect(calibratedSeven.probability).toBeGreaterThan(0.70);
  });
});
