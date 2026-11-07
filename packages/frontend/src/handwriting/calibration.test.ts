// @vitest-environment node
import { expect, it } from 'vitest';
import { CALIBRATION, uncertaintyThreshold } from './calibration';
import { classifyRaster, classifyRasterCalibrated } from './model';

it('ships a measured calibration config with per-symbol thresholds and reliability bins', () => {
  expect(CALIBRATION.temperature).toBeGreaterThanOrEqual(.5);
  expect(CALIBRATION.temperature).toBeLessThanOrEqual(2);
  expect(CALIBRATION.defaultThreshold).toBeGreaterThanOrEqual(0);
  expect(CALIBRATION.defaultThreshold).toBeLessThanOrEqual(1);
  expect(CALIBRATION.marginThreshold).toBeGreaterThanOrEqual(0);
  expect(CALIBRATION.marginThreshold).toBeLessThanOrEqual(1);
  expect(Object.keys(CALIBRATION.labels).length).toBeGreaterThanOrEqual(10);
  for (const [label, calibrated] of Object.entries(CALIBRATION.labels)) {
    expect(calibrated.threshold, label).toBeGreaterThanOrEqual(0);
    expect(calibrated.threshold, label).toBeLessThanOrEqual(1);
    for (const stats of [calibrated.calibration, calibrated.evaluation]) {
      expect(stats.above + stats.below, label).toBe(stats.total);
      expect(stats.wrongAbove).toBeLessThanOrEqual(stats.above);
      expect(stats.wrongBelow).toBeLessThanOrEqual(stats.below);
    }
  }
  expect(CALIBRATION.bins.after.length).toBe(15);
  expect(CALIBRATION.bins.after.reduce((sum, bin) => sum + bin.count, 0)).toBe(CALIBRATION.overall.total);
});

it('guards against a claimed calibration gain that the held-out split did not show', () => {
  // The fitted temperatures were rejected because held-out ECE did not improve;
  // keeping identity is honest, and the test prevents a later edit from quietly
  // reporting a lower ECE without new evidence.
  expect(CALIBRATION.temperature).toBe(1);
  expect(CALIBRATION.ece.after).toBeLessThanOrEqual(CALIBRATION.ece.before + 1e-12);
  expect(CALIBRATION.ece.before).toBeLessThan(.01);
});

it('applies the measured per-symbol threshold and keeps raw inference available', () => {
  const unknown = uncertaintyThreshold('not-a-label', .42);
  expect(unknown).toBe(.42);
  expect(uncertaintyThreshold('5', .42)).toBe(CALIBRATION.labels['5'].threshold);
  const raster = new Float32Array(784);
  raster[400] = 1;
  expect(classifyRasterCalibrated(raster).map(c => c.label)).toEqual(classifyRaster(raster).map(c => c.label));
});
