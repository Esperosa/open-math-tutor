// @vitest-environment jsdom
import '@testing-library/jest-dom/vitest';
import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import { COLOR_LEGEND_ITEMS, ColorLegendDialog } from './ColorLegend';
import { messages } from './i18n';

function parseHex(hex: string): [number, number, number] {
  const clean = hex.replace('#', '');
  const r = parseInt(clean.slice(0, 2), 16) / 255;
  const g = parseInt(clean.slice(2, 4), 16) / 255;
  const b = parseInt(clean.slice(4, 6), 16) / 255;
  return [r, g, b];
}

function sRgbToLinear(c: number): number {
  return c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
}

function relativeLuminance(hex: string): number {
  const [r, g, b] = parseHex(hex);
  return 0.2126 * sRgbToLinear(r) + 0.7152 * sRgbToLinear(g) + 0.0722 * sRgbToLinear(b);
}

function contrastRatio(hex1: string, hex2: string): number {
  const lum1 = relativeLuminance(hex1);
  const lum2 = relativeLuminance(hex2);
  const brighter = Math.max(lum1, lum2);
  const darker = Math.min(lum1, lum2);
  return (brighter + 0.05) / (darker + 0.05);
}

describe('ColorLegend', () => {
  const lightBg = '#ffffff';
  const darkBg = '#1c2424';

  it('contains all 5 essential whiteboard items with Czech and English texts', () => {
    expect(COLOR_LEGEND_ITEMS).toHaveLength(5);
    for (const item of COLOR_LEGEND_ITEMS) {
      expect(item.label.cs).toBeTruthy();
      expect(item.label.en).toBeTruthy();
      expect(item.shapeDesc.cs).toBeTruthy();
      expect(item.shapeDesc.en).toBeTruthy();
    }
  });

  it('satisfies WCAG AA contrast ratio (>= 4.5:1) in light mode against white background', () => {
    for (const item of COLOR_LEGEND_ITEMS) {
      const ratio = contrastRatio(item.colorLight, lightBg);
      expect(ratio, `Item ${item.id} (${item.colorLight}) vs light bg`).toBeGreaterThanOrEqual(4.5);
    }
  });

  it('satisfies WCAG AA contrast ratio (>= 4.5:1) in dark mode against dark background', () => {
    for (const item of COLOR_LEGEND_ITEMS) {
      const ratio = contrastRatio(item.colorDark, darkBg);
      expect(ratio, `Item ${item.id} (${item.colorDark}) vs dark bg`).toBeGreaterThanOrEqual(4.5);
    }
  });

  it('distinguishes marks by visual shape as well as color for color-blind users', () => {
    const shapes = COLOR_LEGEND_ITEMS.map(i => i.shape);
    const uniqueShapes = new Set(shapes);
    expect(uniqueShapes.size).toBe(5);
    expect(shapes).toContain('circle-check');
    expect(shapes).toContain('cross');
    expect(shapes).toContain('question-dot');
  });

  it('renders modal with items when open', () => {
    render(<ColorLegendDialog open={true} onClose={() => {}} locale="cs" t={messages.cs} />);
    expect(screen.getByTestId('color-legend-dialog')).toBeInTheDocument();
    expect(screen.getByText(messages.cs.colorLegendTitle)).toBeInTheDocument();
    expect(screen.getByTestId('legend-item-red-pen')).toBeInTheDocument();
    expect(screen.getByTestId('legend-item-teal-pen')).toBeInTheDocument();
    expect(screen.getByTestId('legend-item-green-mark')).toBeInTheDocument();
    expect(screen.getByTestId('legend-item-red-mark')).toBeInTheDocument();
    expect(screen.getByTestId('legend-item-gray-mark')).toBeInTheDocument();
  });
});
