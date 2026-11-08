import React, { useRef, useState, useEffect, useCallback } from 'react';
import {
  CALIBRATION_SYMBOLS,
  CALIBRATION_DESCRIPTIONS,
  addPersonalSample,
  type CalibrationSymbol,
} from './personalCalibration';
import type { Stroke, Point } from './types';

interface PersonalCalibrationModalProps {
  isOpen: boolean;
  locale: 'cs' | 'en';
  onClose: () => void;
  onComplete?: () => void;
}

export function PersonalCalibrationModal({
  isOpen,
  locale,
  onClose,
  onComplete,
}: PersonalCalibrationModalProps) {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [captured, setCaptured] = useState<Set<string>>(new Set());
  const [showCheck, setShowCheck] = useState(false);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const drawingRef = useRef(false);
  const currentPointsRef = useRef<Point[]>([]);
  const strokesRef = useRef<Stroke[]>([]);

  const currentSymbol: CalibrationSymbol = CALIBRATION_SYMBOLS[currentIndex] ?? '0';
  const desc = CALIBRATION_DESCRIPTIONS[currentSymbol];
  const isDone = currentIndex >= CALIBRATION_SYMBOLS.length;

  const redrawCanvas = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    ctx.clearRect(0, 0, canvas.width, canvas.height);

    // Draw coordinate guide / center crosshair softly
    ctx.strokeStyle = 'rgba(150, 150, 150, 0.18)';
    ctx.lineWidth = 1;
    ctx.setLineDash([4, 4]);
    ctx.beginPath();
    ctx.moveTo(canvas.width / 2, 10);
    ctx.lineTo(canvas.width / 2, canvas.height - 10);
    ctx.moveTo(10, canvas.height * 0.75); // Baseline guide
    ctx.lineTo(canvas.width - 10, canvas.height * 0.75);
    ctx.stroke();
    ctx.setLineDash([]);

    // Draw user strokes
    ctx.strokeStyle = '#1e293b';
    ctx.lineWidth = 4;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';

    for (const stroke of strokesRef.current) {
      if (stroke.points.length === 0) continue;
      ctx.beginPath();
      ctx.moveTo(stroke.points[0][0], stroke.points[0][1]);
      for (let i = 1; i < stroke.points.length; i++) {
        ctx.lineTo(stroke.points[i][0], stroke.points[i][1]);
      }
      ctx.stroke();
    }
  }, []);

  const clearCurrentStrokes = useCallback(() => {
    strokesRef.current = [];
    currentPointsRef.current = [];
    setShowCheck(false);
    redrawCanvas();
  }, [redrawCanvas]);

  useEffect(() => {
    if (isOpen) {
      clearCurrentStrokes();
    }
  }, [isOpen, currentIndex, clearCurrentStrokes]);

  if (!isOpen) return null;

  function handlePointerDown(e: React.PointerEvent<HTMLCanvasElement>) {
    const canvas = canvasRef.current;
    if (!canvas) return;
    canvas.setPointerCapture(e.pointerId);
    drawingRef.current = true;
    const rect = canvas.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    currentPointsRef.current = [[x, y]];

    const ctx = canvas.getContext('2d');
    if (ctx) {
      ctx.strokeStyle = '#1e293b';
      ctx.lineWidth = 4;
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';
      ctx.beginPath();
      ctx.moveTo(x, y);
    }
  }

  function handlePointerMove(e: React.PointerEvent<HTMLCanvasElement>) {
    if (!drawingRef.current) return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    currentPointsRef.current.push([x, y]);

    const ctx = canvas.getContext('2d');
    if (ctx) {
      ctx.lineTo(x, y);
      ctx.stroke();
    }
  }

  function handlePointerUp(e: React.PointerEvent<HTMLCanvasElement>) {
    if (!drawingRef.current) return;
    drawingRef.current = false;
    const canvas = canvasRef.current;
    if (canvas && canvas.hasPointerCapture(e.pointerId)) {
      canvas.releasePointerCapture(e.pointerId);
    }

    if (currentPointsRef.current.length > 0) {
      const pts = currentPointsRef.current;
      let minX = pts[0][0], maxX = pts[0][0], minY = pts[0][1], maxY = pts[0][1];
      for (const [px, py] of pts) {
        if (px < minX) minX = px;
        if (px > maxX) maxX = px;
        if (py < minY) minY = py;
        if (py > maxY) maxY = py;
      }
      const newStroke: Stroke = {
        id: `calib-${Date.now()}-${strokesRef.current.length}`,
        points: pts,
        width: 4,
        order: strokesRef.current.length,
        bbox: { x: minX, y: minY, width: Math.max(1, maxX - minX), height: Math.max(1, maxY - minY) },
      };
      strokesRef.current.push(newStroke);
      currentPointsRef.current = [];

      // Valid stroke captured: show green checkmark and save sample
      setShowCheck(true);
      try {
        addPersonalSample(currentSymbol, strokesRef.current);
        setCaptured(prev => new Set(prev).add(currentSymbol));
      } catch {
        // Fallback safely
      }
    }
  }

  function handleNext() {
    if (currentIndex < CALIBRATION_SYMBOLS.length - 1) {
      setCurrentIndex(i => i + 1);
    } else {
      onComplete?.();
      onClose();
    }
  }

  function handleSkipSymbol() {
    handleNext();
  }

  function handleSkipAll() {
    onClose();
  }

  return (
    <div className="calib-modal-overlay" role="dialog" aria-modal="true" aria-label={locale === 'cs' ? 'Kalibrace písma' : 'Handwriting Calibration'}>
      <div className="calib-modal-card">
        <div className="calib-modal-header">
          <h2>{locale === 'cs' ? 'Naučit se moje písmo' : 'Learn my handwriting'}</h2>
          <button type="button" className="close-btn" aria-label={locale === 'cs' ? 'Zavřít' : 'Close'} onClick={onClose}>×</button>
        </div>

        {!isDone ? (
          <>
            <div className="calib-progress-bar">
              <div
                className="calib-progress-fill"
                style={{ width: `${((currentIndex + 1) / CALIBRATION_SYMBOLS.length) * 100}%` }}
              />
            </div>
            <p className="calib-step-indicator">
              {locale === 'cs'
                ? `Znak ${currentIndex + 1} z ${CALIBRATION_SYMBOLS.length}`
                : `Symbol ${currentIndex + 1} of ${CALIBRATION_SYMBOLS.length}`}
            </p>

            <div className="calib-workspace">
              {/* Preview target */}
              <div className="calib-target-card">
                <span className="calib-target-label">
                  {locale === 'cs' ? 'Ukázka:' : 'Preview:'}
                </span>
                <div className="calib-target-glyph" data-testid="calib-target-glyph">
                  {currentSymbol}
                </div>
                <div className="calib-target-desc">
                  <strong>{locale === 'cs' ? desc?.cs : desc?.en}</strong>
                </div>
              </div>

              {/* Drawing pad */}
              <div className="calib-drawing-box">
                <canvas
                  ref={canvasRef}
                  width={220}
                  height={220}
                  className="calib-canvas"
                  data-testid="calib-canvas"
                  onPointerDown={handlePointerDown}
                  onPointerMove={handlePointerMove}
                  onPointerUp={handlePointerUp}
                  onPointerCancel={handlePointerUp}
                />
                {showCheck && (
                  <div className="calib-checkmark" data-testid="calib-checkmark" role="img" aria-label={locale === 'cs' ? 'Zaznamenáno' : 'Captured'}>
                    ✓
                  </div>
                )}
                <span className="calib-canvas-hint">
                  {locale === 'cs' ? 'Napište znak sem' : 'Draw symbol here'}
                </span>
              </div>
            </div>

            <div className="calib-actions">
              <button type="button" className="calib-btn-clear" onClick={clearCurrentStrokes}>
                {locale === 'cs' ? 'Vymazat' : 'Clear'}
              </button>
              <button type="button" className="calib-btn-skip" onClick={handleSkipSymbol}>
                {locale === 'cs' ? 'Přeskočit znak' : 'Skip symbol'}
              </button>
              <button
                type="button"
                className="primary calib-btn-next"
                data-testid="calib-btn-next"
                onClick={handleNext}
              >
                {currentIndex < CALIBRATION_SYMBOLS.length - 1
                  ? (locale === 'cs' ? 'Další znak →' : 'Next symbol →')
                  : (locale === 'cs' ? 'Dokončit ✓' : 'Finish ✓')}
              </button>
            </div>

            <div className="calib-footer">
              <button type="button" className="calib-btn-skip-all" onClick={handleSkipAll}>
                {locale === 'cs' ? 'Přeskočit celou kalibraci' : 'Skip calibration'}
              </button>
            </div>
          </>
        ) : (
          <div className="calib-done-screen">
            <div className="calib-checkmark big">✓</div>
            <h3>{locale === 'cs' ? 'Kalibrace dokončena!' : 'Calibration complete!'}</h3>
            <p>
              {locale === 'cs'
                ? `Úspěšně uloženo ${captured.size} vzorků vašeho písma. Vzorky zůstávají bezpečně v tomto prohlížeči.`
                : `Successfully stored ${captured.size} handwriting samples. They remain stored safely in this browser.`}
            </p>
            <button type="button" className="primary" onClick={onClose}>
              {locale === 'cs' ? 'Zpět na tabuli' : 'Back to board'}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
