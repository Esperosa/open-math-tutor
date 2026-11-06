import { useEffect, useRef, useState } from 'react';
import { useReducedMotion } from './useReducedMotion';

/** A number that glides to its new value (progress percentages); shows the target at once with reduced motion. */
export function useTween(target: number, durationMs = 650): number {
  const reduced = useReducedMotion();
  const [shown, setShown] = useState(target);
  const from = useRef(target);
  useEffect(() => {
    if (reduced || from.current === target) { from.current = target; setShown(target); return; }
    const start = performance.now(), origin = from.current;
    let frame = 0;
    const step = (now: number) => {
      const t = Math.min(1, (now - start) / durationMs);
      const eased = 1 - (1 - t) ** 3;
      from.current = origin + (target - origin) * eased;
      setShown(Math.round(from.current));
      if (t < 1) frame = requestAnimationFrame(step);
    };
    frame = requestAnimationFrame(step);
    return () => cancelAnimationFrame(frame);
  }, [target, durationMs, reduced]);
  return shown;
}
