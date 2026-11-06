/**
 * idle: waiting · watching: the student is writing (eyes and pencil follow the last stroke) · checking: pen lifted, verdict on its way
 * thinking: the AI works · concerned: a mistake · happy: a correct step or result · waving: greeting
 */
export type TutorMood = 'idle' | 'watching' | 'checking' | 'thinking' | 'concerned' | 'happy' | 'waving';

const CONFETTI = [
  { x: -26, y: -30, r: 40, c: 'var(--accent)' }, { x: -14, y: -38, r: -30, c: '#d9a441' }, { x: 0, y: -42, r: 20, c: '#c47777' },
  { x: 14, y: -38, r: -50, c: 'var(--accent)' }, { x: 26, y: -30, r: 35, c: '#d9a441' }, { x: -34, y: -14, r: -20, c: '#c47777' },
  { x: 34, y: -14, r: 25, c: 'var(--accent)' },
];

/**
 * Small geometric tutor: a chalkboard-green rounded head, blinking eyes, a pencil and a mouth that moves while it speaks.
 * Gaze follows the CSS variables --gaze-x/--gaze-y (-1..1) that `bindGaze` sets on an ancestor.
 */
export function Tutor({ mood, speaking = false, writing = false, pointing = false, celebrate = false, size = 64 }:
  { mood: TutorMood; speaking?: boolean; writing?: boolean; pointing?: boolean; celebrate?: boolean; size?: number }) {
  const smile = mood === 'happy' || mood === 'waving';
  return <svg className={`tutor tutor-${mood}${speaking ? ' tutor-speaking' : ''}${writing ? ' tutor-writing' : ''}${pointing ? ' tutor-pointing' : ''}`}
    data-testid="tutor" data-mood={mood} data-speaking={speaking} data-writing={writing} data-pointing={pointing}
    viewBox="0 0 64 64" width={size} height={size} aria-hidden="true">
    <g className="tutor-body">
      <rect x="10" y="12" width="44" height="40" rx="14" fill="var(--accent)" />
      <rect x="16" y="20" width="32" height="24" rx="9" fill="var(--paper)" />
      <g className="tutor-gaze"><g className="tutor-track"><g className="tutor-eyes" fill="var(--ink)">
        <ellipse cx="25" cy="31" rx="2.6" ry="3.4" /><ellipse cx="39" cy="31" rx="2.6" ry="3.4" />
      </g></g></g>
      {mood === 'concerned' && <path className="tutor-brows" d="M21 24l7 2m8 0 7-2" fill="none" stroke="var(--ink)" strokeWidth="2" strokeLinecap="round" />}
      {speaking
        ? <ellipse className="tutor-mouth" cx="32" cy="39" rx="4" ry="3" fill="var(--ink)" />
        : mood === 'concerned'
          ? <path d="M26 39c3-2 9-2 12 0" fill="none" stroke="var(--ink)" strokeWidth="2" strokeLinecap="round" />
          : smile
            ? <path className="tutor-smile" d="M24.5 37c2.5 6 12.5 6 15 0z" fill="var(--ink)" stroke="var(--ink)" strokeWidth="1.4" strokeLinejoin="round" />
            : <path d="M26 38c3 3 9 3 12 0" fill="none" stroke="var(--ink)" strokeWidth="2" strokeLinecap="round" />}
      <g className="tutor-pencil-wrap"><path className="tutor-pencil" d="M50 46l8-10 3 2-8 10-4 2z" fill="#d9a441" stroke="var(--ink)" strokeWidth="1.2" strokeLinejoin="round" /></g>
      <path className="tutor-hand" d="M12 42Q3 39 5 32" fill="none" stroke="var(--accent)" strokeWidth="5" strokeLinecap="round" />
    </g>
    {(mood === 'thinking' || mood === 'checking') && <g className="tutor-dots" fill="var(--ink)"><circle cx="26" cy="7" r="2" /><circle cx="33" cy="7" r="2" /><circle cx="40" cy="7" r="2" /></g>}
    {mood === 'happy' && celebrate && <g className="tutor-confetti" aria-hidden="true">
      {CONFETTI.map((piece, i) => <rect key={i} x="30" y="22" width="3.2" height="5.4" rx="1" fill={piece.c}
        style={{ ['--cx' as string]: `${piece.x}px`, ['--cy' as string]: `${piece.y}px`, ['--cr' as string]: `${piece.r}deg`, animationDelay: `${i * 40}ms` }} />)}
    </g>}
  </svg>;
}
