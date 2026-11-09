import { expect, it } from 'vitest';
import calibration from './model/line-calibration.json';
import { calibratedLineConfidence } from './lineRecognizer';

it('keeps emitted-token correctness separate from frame probabilities and uses monotone bounded calibration', () => {
  let previous = 0;
  for (let i = 0; i <= 100; i++) {
    const confidence = calibratedLineConfidence(i / 100);
    expect(confidence).toBeGreaterThanOrEqual(previous);
    expect(confidence).toBeLessThanOrEqual(1);
    previous = confidence;
  }
  expect(calibration.threshold).toBeGreaterThanOrEqual(.95);
});
