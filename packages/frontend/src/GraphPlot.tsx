import { useMemo } from 'react';
import { parseMathStatement, sampleFunction, type BoardAction } from '@openmathtutor/shared';

type PlotAction = Extract<BoardAction, { type: 'plot_function' }>;

interface Props { action: PlotAction }

const PADDING = 24;

export function GraphPlot({ action }: Props) {
  const points = useMemo(() => {
    try {
      const statement = parseMathStatement(action.expression);
      if (statement.form !== 'expression') return [];
      return sampleFunction(statement.value, action.variable, action.domain, 160);
    } catch {
      return [];
    }
  }, [action.expression, action.variable, action.domain]);

  const finiteYs = points.map(p => p.y).filter((y): y is number => y !== null);
  const yMin = finiteYs.length ? Math.min(...finiteYs) : -1;
  const yMax = finiteYs.length ? Math.max(...finiteYs) : 1;
  const ySpan = yMax - yMin || 1;
  const innerWidth = action.width - PADDING * 2;
  const innerHeight = action.height - PADDING * 2;
  const xToPx = (x: number) => PADDING + ((x - action.domain.min) / (action.domain.max - action.domain.min || 1)) * innerWidth;
  const yToPx = (y: number) => PADDING + innerHeight - ((y - yMin) / ySpan) * innerHeight;

  // Each run of consecutive, finite points becomes its own path segment so a
  // division-by-zero gap (y: null) renders as a visible break, never a lie.
  const segments: string[] = [];
  let current: string[] = [];
  for (const p of points) {
    if (p.y === null) {
      if (current.length > 1) segments.push(current.join(' '));
      current = [];
      continue;
    }
    current.push(`${xToPx(p.x).toFixed(1)},${yToPx(p.y).toFixed(1)}`);
  }
  if (current.length > 1) segments.push(current.join(' '));

  const axisY = yMin <= 0 && yMax >= 0 ? yToPx(0) : null;
  const axisX = action.domain.min <= 0 && action.domain.max >= 0 ? xToPx(0) : null;

  return <svg
    className="graph-plot" data-testid="graph-plot" width={action.width} height={action.height}
    viewBox={`0 0 ${action.width} ${action.height}`} role="img"
    aria-label={`${action.variable} ↦ ${action.expression}`}>
    <rect x={0} y={0} width={action.width} height={action.height} className="graph-background" />
    {axisY !== null && <line x1={PADDING} y1={axisY} x2={action.width - PADDING} y2={axisY} className="graph-axis" />}
    {axisX !== null && <line x1={axisX} y1={PADDING} x2={axisX} y2={action.height - PADDING} className="graph-axis" />}
    {segments.map((d, i) => <polyline key={i} points={d} className="graph-curve" fill="none" />)}
  </svg>;
}
