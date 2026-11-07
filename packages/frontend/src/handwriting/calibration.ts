import config from './model/calibration.json';

export interface ThresholdStats {
  total: number;
  correct: number;
  /** Samples at or above the threshold: how many were marked readable and how many were wrong. */
  above: number;
  wrongAbove: number;
  /** Samples below the threshold: how many were flagged uncertain and how many were wrong. */
  below: number;
  wrongBelow: number;
}

export interface LabelCalibration {
  threshold: number;
  calibration: ThresholdStats;
  evaluation: ThresholdStats;
}

export interface ReliabilityBin {
  from: number;
  to: number;
  count: number;
  accuracy: number;
  confidence: number;
}

export interface CalibrationConfig {
  /** Temperature fitted by NLL on the calibration half only. */
  temperature: number;
  defaultThreshold: number;
  marginThreshold: number;
  /** Expected calibration error on the untouched evaluation half. */
  ece: { before: number; after: number };
  bins: { before: ReliabilityBin[]; after: ReliabilityBin[] };
  /** Fitted temperatures kept for audit; production uses temperature only if it held out. */
  fittedTemperatures?: { nll: number; ece: number };
  overall: ThresholdStats;
  labels: Record<string, LabelCalibration>;
}

export const CALIBRATION = config as CalibrationConfig;

/** Per-symbol uncertainty threshold; unknown classes fall back to the caller's global value. */
export function uncertaintyThreshold(label: string, fallback: number): number {
  return CALIBRATION.labels[label]?.threshold ?? fallback;
}
