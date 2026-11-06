import { useRef, useState } from 'react';
import { calcEvaluate, formatCalcResult, CalcError, type CalculatorPolicy, type Locale } from '@openmathtutor/shared';
import type { MessageKey } from './i18n';

interface Props {
  t: Record<MessageKey, string>;
  locale: Locale;
  policy: Exclude<CalculatorPolicy, 'none'>;
  examRules: boolean;
  onClose(): void;
  onUse(text: string): void;
}

const KEYS = ['7', '8', '9', '÷', '4', '5', '6', '×', '1', '2', '3', '−', '0', ',', '%', '+', '(', ')', '^', 'C'];
const FUNCTIONS: Record<string, (x: number) => number> = {
  '√': Math.sqrt, 'x²': x => x * x, '1/x': x => 1 / x,
  sin: x => Math.sin(x * Math.PI / 180), cos: x => Math.cos(x * Math.PI / 180), tan: x => Math.tan(x * Math.PI / 180),
  ln: Math.log, log: Math.log10,
};

export function Calculator({ t, locale, policy, examRules, onClose, onUse }: Props) {
  const [expr, setExpr] = useState('');
  const [error, setError] = useState(false);
  const [pos, setPos] = useState({ x: 0, y: 0 });
  const drag = useRef<{ x: number; y: number; px: number; py: number } | null>(null);

  function evaluate(): number | null {
    try { const value = calcEvaluate(expr); setError(false); return value; } catch (e) {
      if (!(e instanceof CalcError)) throw e;
      setError(true); return null;
    }
  }
  function press(key: string) {
    setError(false);
    if (key === 'C') { setExpr(''); return; }
    setExpr(e => e + key);
  }
  function equals() {
    const value = evaluate();
    if (value !== null) setExpr(formatCalcResult(value, locale));
  }
  function apply(name: string) {
    const value = evaluate();
    if (value === null) return;
    const out = FUNCTIONS[name]!(value);
    if (!Number.isFinite(out)) { setError(true); return; }
    setExpr(formatCalcResult(out, locale));
  }
  return <div className="calculator" role="dialog" aria-label={t.calcTitle} style={{ transform: `translate(${pos.x}px, ${pos.y}px)` }}>
    <div className="calc-head" onPointerDown={e => { (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId); drag.current = { x: e.clientX, y: e.clientY, px: pos.x, py: pos.y }; }}
      onPointerMove={e => { if (drag.current) setPos({ x: drag.current.px + e.clientX - drag.current.x, y: drag.current.py + e.clientY - drag.current.y }); }}
      onPointerUp={() => { drag.current = null; }}>
      <strong>{t.calcTitle}</strong>
      <button className="calc-close" aria-label={t.calcClose} onClick={onClose} onPointerDown={e => e.stopPropagation()}>×</button>
    </div>
    <input className="calc-display" aria-label={t.calcTitle} aria-invalid={error} inputMode="decimal" value={expr} placeholder="0" autoComplete="off"
      onChange={e => { setExpr(e.target.value); setError(false); }}
      onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); equals(); } e.stopPropagation(); }} />
    {error && <p role="alert" className="calc-error">{t.calcError}</p>}
    {policy === 'scientific' && <div className="calc-grid calc-sci">
      {Object.keys(FUNCTIONS).map(name => <button key={name} onClick={() => apply(name)}>{name}</button>)}
      <button onClick={() => press('π')}>π</button>
    </div>}
    <div className="calc-grid">
      {KEYS.map(key => <button key={key} className={key === 'C' ? 'stop' : ''} onClick={() => press(key)}>{key}</button>)}
      <button className="primary calc-equals" onClick={equals}>=</button>
    </div>
    <button className="calc-use" disabled={!expr.trim()} onClick={() => onUse(expr)}>{t.calcUse}</button>
    <small>{examRules ? t.calcExam : t.calcFree}{policy === 'scientific' ? ` ${t.calcDegrees}` : ''}</small>
  </div>;
}
