import { useRef, useState, type ReactNode } from 'react';

export type PanelId = 'plan' | 'courses' | 'ask' | 'materials' | 'exercises' | 'history' | 'notes';

const ICONS: Record<PanelId | 'settings' | 'calc', ReactNode> = {
  plan: <path d="M5 19V9m7 10V5m7 14v-7" />,
  calc: <path d="M6 3h12a1 1 0 0 1 1 1v16a1 1 0 0 1-1 1H6a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1zM8 7h8M8 12h.01M12 12h.01M16 12h.01M8 16h.01M12 16h.01M16 16h.01" />,
  courses: <path d="M4 5.5A1.5 1.5 0 0 1 5.5 4H11v15H5.5A1.5 1.5 0 0 0 4 20.5zM20 5.5A1.5 1.5 0 0 0 18.5 4H13v15h5.5a1.5 1.5 0 0 1 1.5 1.5z" />,
  ask: <path d="M5 5h14a1 1 0 0 1 1 1v9a1 1 0 0 1-1 1h-8l-4 3.5V16H5a1 1 0 0 1-1-1V6a1 1 0 0 1 1-1z" />,
  materials: <path d="M12 16V5m0 0-4 4m4-4 4 4M5 15v3a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1v-3" />,
  exercises: <path d="M7 7h12v12H7zM5 17V5h12" />,
  notes: <path d="M7 3h8l4 4v14H7zM14 3v5h5M10 12h6M10 16h6" />,
  history: <path d="M12 7v5l3 2M4.5 12a7.5 7.5 0 1 0 2.2-5.3M4.5 5v3.5H8" />,
  settings: <path d="M12 9.5a2.5 2.5 0 1 0 0 5 2.5 2.5 0 0 0 0-5zM19 12l1.5-1-1.5-3-1.8.4a6 6 0 0 0-1.4-.8L15.5 5h-3l-.3 1.6a6 6 0 0 0-1.4.8L9 7.0 7.5 10 9 12l-1.5 2L9 17l1.8-.4c.4.3.9.6 1.4.8l.3 1.6h3l.3-1.6c.5-.2 1-.5 1.4-.8l1.8.4 1.5-3z" />,
};

export function Icon({ name }: { name: PanelId | 'settings' | 'calc' }) {
  return <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" strokeWidth="1.7"
    strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">{ICONS[name]}</svg>;
}

interface RailProps {
  items: { id: PanelId; label: string; hint: string }[];
  active: PanelId | null;
  onHover(id: PanelId): void;
  onToggle(id: PanelId): void;
}

/** Progressive tooltip: the short label on hover, the longer explanation if the pointer stays. */
export function useProgressiveTip() {
  const [tip, setTip] = useState<{ id: string; long: boolean } | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout>>();
  return {
    tip,
    enter(id: string) { clearTimeout(timer.current); setTip({ id, long: false }); timer.current = setTimeout(() => setTip({ id, long: true }), 1200); },
    leave() { clearTimeout(timer.current); setTip(null); },
  };
}

export function Rail({ items, active, onHover, onToggle }: RailProps) {
  const tips = useProgressiveTip();
  return <nav className="rail" aria-label="HUD">
    {items.map(item => <button key={item.id} className={`rail-btn${active === item.id ? ' active' : ''}`}
      aria-label={item.label} aria-pressed={active === item.id}
      onMouseEnter={() => { onHover(item.id); tips.enter(item.id); }} onMouseLeave={tips.leave} onClick={() => onToggle(item.id)}>
      <Icon name={item.id} />
      {active !== item.id && tips.tip?.id === item.id && <span className="tip" role="tooltip"><strong>{item.label}</strong>{tips.tip.long && <span>{item.hint}</span>}</span>}
    </button>)}
  </nav>;
}
