import type { ExcalidrawElement } from '@excalidraw/excalidraw/element/types';
import type { Box, Step } from './boardState';

/** Scene-space, independent of recognizer, pan, zoom and renderer. Unknown symbols
 * must return null, never guess a glyph box for unrecognized pen strokes. */
export type StepLocator = (stepId: string, symbolIndex?: number) => Box | null;
export interface StepLocatorRegistry {
  locate: StepLocator;
  registerStepLocator(locator: StepLocator): () => void;
}
export function createStepLocatorRegistry(fallback: StepLocator): StepLocatorRegistry {
  const locators = new Set<StepLocator>();
  return {
    locate: (id, symbol) => {
      for (const locator of [...locators].reverse()) {
        const box = locator(id, symbol);
        if (box && [box.x, box.y, box.width, box.height].every(Number.isFinite) && box.width > 0 && box.height > 0) return box;
      }
      return fallback(id, symbol);
    },
    registerStepLocator: locator => { locators.add(locator); return () => { locators.delete(locator); }; },
  };
}

export function textStepLocator(steps: readonly Step[], elements: readonly ExcalidrawElement[]): StepLocator {
  return (id, symbol) => {
    const step = steps.find(s => s.stepId === id || id.startsWith(`${s.stepId}#`));
    if (!step) return null;
    const ink = elements.filter(e => !e.isDeleted && step.elementIds.includes(e.id));
    if (!ink.length || ink.some(e => e.angle !== 0)) return null;
    const box = { x: Math.min(...ink.map(e => e.x)), y: Math.min(...ink.map(e => e.y)),
      width: 0, height: 0 };
    box.width = Math.max(...ink.map(e => e.x + e.width)) - box.x;
    box.height = Math.max(...ink.map(e => e.y + e.height)) - box.y;
    const lineIndex = id === step.stepId ? null : Number(id.slice(step.stepId.length + 1));
    const el = ink.length === 1 && ink[0].type === 'text' ? ink[0] : null;
    if (lineIndex === null && symbol === undefined) return box;
    if (!el) return null;
    const lines = el.text.split('\n');
    const line = lineIndex === null ? { text: lines[0], n: 0 }
      : lines.map((text, n) => ({ text, n })).filter(l => l.text.trim())[lineIndex];
    if (!line || (lineIndex === null && lines.length !== 1)) return null;
    const height = el.height / lines.length;
    const row = { x: el.x, y: el.y + line.n * height, width: el.width, height };
    if (symbol === undefined) return row;
    const chars = [...line.text.trim()];
    if (!Number.isInteger(symbol) || symbol < 0 || symbol >= chars.length) return null;
    // Measure with the exact hand font. Scale to Excalidraw's measured element;
    // font fallback/loading cannot put the symbol outside its parent row.
    const ctx = typeof document === 'undefined' ? null : document.createElement('canvas').getContext('2d');
    if (!ctx) return null;
    ctx.font = `${el.fontSize}px ${el.fontFamily === 1 ? 'Virgil' : el.fontFamily === 5 ? 'Excalifont' : 'sans-serif'}`;
    const widest = Math.max(...lines.map(l => ctx.measureText(l).width), 1);
    const leading = line.text.length - line.text.trimStart().length;
    const prefix = line.text.slice(0, leading) + chars.slice(0, symbol).join('');
    return { ...row, x: row.x + ctx.measureText(prefix).width / widest * el.width,
      width: Math.max(1, ctx.measureText(chars[symbol]).width / widest * el.width) };
  };
}
