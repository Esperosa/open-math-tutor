import { useLayoutEffect, useRef, useState } from 'react';
import { clearTutorRoute, tutorDestination, type TutorRect } from './tutorPosition';

const CONTROLS = '.hud-top-left, .hud-top-right, .rail, .drawer.open, .settings-pop.open, .calculator, .ctx-menu, .tip, .layer-badge, .excalidraw .Island, .excalidraw footer';
const HOME = { x: 0, y: 0, visiting: false, returning: false, snap: true };
function controlRects() {
  return [...document.querySelectorAll<HTMLElement>(CONTROLS)].filter(e => {
    const s = getComputedStyle(e);
    return s.visibility !== 'hidden' && s.display !== 'none' && s.opacity !== '0';
  }).map(e => e.getBoundingClientRect()).filter(r => r.width > 0 && r.height > 0);
}
/** Geometry is read-only: pan/zoom/resize or a new control can cancel a visit, never mutate the scene. */
export function useTutorVisit(id: string | undefined, text: string, stepId: string | undefined, blocked: boolean, reduced: boolean, locate: ((id: string) => TutorRect | null) | undefined) {
  const ref = useRef<HTMLDivElement>(null);
  const [pose, setPose] = useState(HOME);
  useLayoutEffect(() => {
    setPose(HOME);
    if (!id || !stepId || blocked || !locate) return;
    let returned = false, active = false;
    let returnTimer: ReturnType<typeof setTimeout> | undefined;
    const homeRect = (el: HTMLDivElement) => ({ x: el.offsetLeft, y: el.offsetTop, width: el.offsetWidth, height: el.offsetHeight });
    const goHome = (snap: boolean) => {
      returned = true;
      const el = ref.current;
      const safe = el && clearTutorRoute(el.getBoundingClientRect(), homeRect(el), controlRects());
      if (snap || reduced || !active || !safe) setPose(HOME);
      else {
        setPose({ ...HOME, returning: true, snap: false });
        // Fallback if a browser omits transitionend (e.g. tab backgrounding).
        returnTimer = setTimeout(() => setPose(HOME), 700);
      }
    };
    const measure = () => {
      const el = ref.current;
      if (!el || returned) return;
      const home = homeRect(el);
      const dest = tutorDestination(home, locate(stepId), { width: window.innerWidth, height: window.innerHeight }, controlRects(), el.getBoundingClientRect());
      if (!dest) { if (active) goHome(true); return; }
      active = true;
      const x = dest.x - home.x, y = dest.y - home.y;
      setPose(prev => prev.visiting && prev.x === x && prev.y === y ? prev : { x, y, visiting: true, returning: false, snap: false });
    };
    measure();
    const interval = setInterval(measure, 180);
    const timer = setTimeout(() => { clearInterval(interval); goHome(false); }, Math.min(12000, 5500 + Math.min(text.length, 220) * 24));
    const resize = () => { clearInterval(interval); goHome(true); };
    window.addEventListener('resize', resize);
    return () => { clearInterval(interval); clearTimeout(timer); clearTimeout(returnTimer); window.removeEventListener('resize', resize); };
  }, [id, text, stepId, blocked, reduced, locate]);
  const finishReturn = () => setPose(prev => prev.returning ? HOME : prev);
  return { ref, ...pose, away: pose.visiting || pose.returning, finishReturn };
}
