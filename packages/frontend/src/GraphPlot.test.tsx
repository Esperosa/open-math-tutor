import { afterEach, describe, expect, it } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
import type { BoardAction } from '@openmathtutor/shared';
import { GraphPlot } from './GraphPlot';

afterEach(cleanup);

function plot(overrides: Partial<Extract<BoardAction, { type: 'plot_function' }>> = {}): Extract<BoardAction, { type: 'plot_function' }> {
  return {
    id: 'plot-1', type: 'plot_function', boardRevision: 1,
    expression: '2x', variable: 'x', domain: { min: -5, max: 5 },
    anchor: { x: 0, y: 0 }, width: 300, height: 200,
    ...overrides,
  };
}

describe('GraphPlot', () => {
  it('renders an svg with a continuous curve for a linear function', () => {
    render(<GraphPlot action={plot()} />);
    const svg = screen.getByTestId('graph-plot');
    expect(svg).toBeInTheDocument();
    expect(svg.querySelectorAll('polyline')).toHaveLength(1);
  });

  it('splits the curve into separate segments around a pole (division by zero)', () => {
    // GraphPlot samples at 160 evenly spaced points; this domain's step is exactly 1,
    // so x=0 (the pole of 1/x) lands precisely on an interior sample (index 10).
    render(<GraphPlot action={plot({ expression: '1/x', domain: { min: -10, max: 149 } })} />);
    const svg = screen.getByTestId('graph-plot');
    expect(svg.querySelectorAll('polyline').length).toBeGreaterThanOrEqual(2);
  });

  it('renders no curve but does not throw for an unparseable expression', () => {
    expect(() => render(<GraphPlot action={plot({ expression: 'not valid !!' })} />)).not.toThrow();
    expect(screen.getByTestId('graph-plot').querySelectorAll('polyline')).toHaveLength(0);
  });

  it('sizes the svg to the action width/height', () => {
    render(<GraphPlot action={plot({ width: 320, height: 180 })} />);
    const svg = screen.getByTestId('graph-plot');
    expect(svg).toHaveAttribute('width', '320');
    expect(svg).toHaveAttribute('height', '180');
  });
});
