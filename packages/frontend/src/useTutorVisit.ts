import { useLayoutEffect, useRef, useState } from 'react';
import { clearTutorRoute, tutorDestination, type TutorRect } from './tutorPosition';

const CONTROLS = '.hud-top-left, .hud-top-right, .rail, .drawer.open, .settings-pop.open, .calculator, .ctx-menu, .tip, .excalidraw .Island, .excalidraw .layer-ui__wrapper__footer, .excalidraw .layer-ui__wrapper__footer-left, .excalidraw .zoom-actions, .excalidraw footer, .step-mark';
const HOME = { x: 0, y: 0, visiting: false, returning: false, snap: true };

function controlRects(): TutorRect[] {
  return [...document.querySelectorAll<HTMLElement>(CONTROLS)].filter(e => {
    if (e.closest('.teacher-layer') || e.closest('.layer-badge')) return false;
    const s = getComputedStyle(e);
    return s.visibility !== 'hidden' && s.display !== 'none' && s.opacity !== '0';
  }).map(e => e.getBoundingClientRect()).filter(r => r.width > 0 && r.height > 0);
}

/**
 * Hook managing the mascot's visits to written rows.
 * D7: When a student starts writing, the mascot retreats to the corner.
 * Collision functions in tutorPosition.ts prevent stopping over student strokes and marks.
 */
export function useTutorVisit(
  id: string | undefined,
  text: string,
  stepId: string | undefined,
  blocked: boolean,
  reduced: boolean,
  locate: ((id: string) => TutorRect | null) | undefined,
  locateObstacles?: () => TutorRect[],
  writing?: boolean,
) {
  const ref = useRef<HTMLDivElement>(null);
  const [pose, setPose] = useState(HOME);

  useLayoutEffect(() => {
    if (writing) {
      // D7: When student starts writing a new line, bubble immediately retreats to the corner.
      setPose(prev => (prev.visiting ? { ...HOME, returning: true, snap: false } : HOME));
      return;
    }
    setPose(HOME);
    if (!id || !stepId || blocked || !locate) return;
    let returned = false, active = false;
    let target: TutorRect | null = null;
    let returnTimer: ReturnType<typeof setTimeout> | undefined;

    const homeRect = (el: HTMLDivElement) => ({ x: el.offsetLeft, y: el.offsetTop, width: el.offsetWidth, height: el.offsetHeight });

    const getObstacles = () => [...controlRects(), ...(locateObstacles ? locateObstacles() : [])];

    const goHome = (snap: boolean) => {
      returned = true;
      const el = ref.current;
      const safe = el && clearTutorRoute(el.getBoundingClientRect(), homeRect(el), getObstacles());
      if (snap || reduced || !active || !safe) setPose(HOME);
      else {
        setPose({ ...HOME, returning: true, snap: false });
        returnTimer = setTimeout(() => setPose(HOME), 700);
      }
    };

    const measure = () => {
      const el = ref.current;
      if (!el || returned) return;
      const home = homeRect(el);
      const obstacles = getObstacles();
      const dest = tutorDestination(home, locate(stepId), { width: window.innerWidth, height: window.innerHeight }, obstacles, el.getBoundingClientRect(), target);
      if (!dest) { if (active) goHome(true); return; }
      active = true;
      target = dest;
      const x = dest.x - home.x, y = dest.y - home.y;
      setPose(prev => prev.visiting && prev.x === x && prev.y === y ? prev : { x, y, visiting: true, returning: false, snap: false });
    };

    measure();
    const interval = setInterval(measure, 180);
    const timer = setTimeout(() => { clearInterval(interval); goHome(false); }, 2800 + Math.min(text.length, 220) * 24);
    const resize = () => { clearInterval(interval); goHome(true); };
    window.addEventListener('resize', resize);
    return () => { clearInterval(interval); clearTimeout(timer); clearTimeout(returnTimer); window.removeEventListener('resize', resize); };
  }, [id, text, stepId, blocked, reduced, locate, locateObstacles, writing]);

  const finishReturn = () => setPose(prev => prev.returning ? HOME : prev);
  return { ref, ...pose, away: pose.visiting || pose.returning, finishReturn };
}
