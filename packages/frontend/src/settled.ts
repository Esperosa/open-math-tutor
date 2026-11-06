import { useEffect, useState } from 'react';
import type { BoardActivity } from './activity';

/**
 * Holds a freshly computed value back until a pen-written line has had its pause, so a half-written
 * number never gets a verdict mark. Typed lines are complete when they commit and show at once.
 * `scope` (the board id) resets the value immediately when the board changes.
 */
export function useSettledValue<T>(value: T, activity: BoardActivity, scope: string): T {
  const [state, setState] = useState({ scope, value });
  useEffect(() => {
    let timer: ReturnType<typeof setTimeout> | undefined;
    const apply = () => {
      const wait = activity.lastKind === 'pen' ? activity.remaining() : 0;
      if (wait > 0) timer = setTimeout(apply, wait + 8);
      else setState(prev => prev.value === value && prev.scope === scope ? prev : { scope, value });
    };
    apply();
    return () => clearTimeout(timer);
  }, [value, scope, activity]);
  return state.scope === scope ? state.value : value;
}
