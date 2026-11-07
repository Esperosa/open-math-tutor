import { useEffect, useState, useSyncExternalStore } from 'react';
import type { BoardActivity } from './activity';

/**
 * Holds a freshly computed value back until a pen-written line has had its pause, so a half-written
 * number never gets a verdict mark. Typed lines are complete when they commit and show at once.
 * `negative` volí delší pauzu; `unsettled` skryje odvolaný výsledek.
 * `scope` (the board id) resets the value immediately when the board changes.
 */
export function useSettledValue<T>(value: T, activity: BoardActivity, scope: string, negative = true, unsettled?: T): T {
  const phase = useSyncExternalStore(l => activity.subscribePhase(l), () => activity.phase);
  const strokeVersion = activity.strokeVersion;
  const [state, setState] = useState({ scope, value, strokeVersion });
  useEffect(() => {
    let timer: ReturnType<typeof setTimeout> | undefined;
    const apply = () => {
      const wait = activity.lastKind === 'pen' ? activity.remaining(negative) : 0;
      if (wait > 0) timer = setTimeout(apply, wait + 8);
      else setState(prev => prev.value === value && prev.scope === scope && prev.strokeVersion === strokeVersion ? prev : { scope, value, strokeVersion });
    };
    apply();
    return () => clearTimeout(timer);
  }, [value, scope, activity, negative, phase, strokeVersion]);
  if (state.scope !== scope) return unsettled === undefined ? value : unsettled;
  // Odvolaný výsledek se po pen-up nesmí vrátit před novou pauzou.
  if (activity.penDown || state.strokeVersion !== strokeVersion) {
    return unsettled === undefined ? state.value : unsettled;
  }
  return state.value;
}
