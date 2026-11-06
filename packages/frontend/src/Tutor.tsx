export type TutorMood = 'idle' | 'thinking' | 'concerned' | 'happy';

/** Small geometric tutor: a chalkboard-green rounded head, blinking eyes, a pencil and a mouth that moves while it speaks. */
export function Tutor({ mood, speaking = false, writing = false, size = 64 }: { mood: TutorMood; speaking?: boolean; writing?: boolean; size?: number }) {
  return <svg className={`tutor tutor-${mood}${speaking ? ' tutor-speaking' : ''}${writing ? ' tutor-writing' : ''}`} data-testid="tutor" data-mood={mood} data-speaking={speaking} data-writing={writing}
    viewBox="0 0 64 64" width={size} height={size} aria-hidden="true">
    <g className="tutor-body">
      <rect x="10" y="12" width="44" height="40" rx="14" fill="var(--accent)" />
      <rect x="16" y="20" width="32" height="24" rx="9" fill="var(--paper)" />
      <g className="tutor-gaze"><g className="tutor-eyes" fill="var(--ink)">
        <ellipse cx="25" cy="31" rx="2.6" ry="3.4" /><ellipse cx="39" cy="31" rx="2.6" ry="3.4" />
      </g></g>
      {mood === 'concerned' && <path className="tutor-brows" d="M21 24l7 2m8 0 7-2" fill="none" stroke="var(--ink)" strokeWidth="2" strokeLinecap="round" />}
      {speaking
        ? <ellipse className="tutor-mouth" cx="32" cy="39" rx="4" ry="3" fill="var(--ink)" />
        : mood === 'concerned'
          ? <path d="M26 39c3-2 9-2 12 0" fill="none" stroke="var(--ink)" strokeWidth="2" strokeLinecap="round" />
          : <path d="M26 38c3 3 9 3 12 0" fill="none" stroke="var(--ink)" strokeWidth="2" strokeLinecap="round" />}
      <path className="tutor-pencil" d="M50 46l8-10 3 2-8 10-4 2z" fill="#d9a441" stroke="var(--ink)" strokeWidth="1.2" strokeLinejoin="round" />
      <path className="tutor-hand" d="M12 42Q3 39 5 32" fill="none" stroke="var(--accent)" strokeWidth="5" strokeLinecap="round" />
    </g>
    {mood === 'thinking' && <g className="tutor-dots" fill="var(--ink)"><circle cx="26" cy="7" r="2" /><circle cx="33" cy="7" r="2" /><circle cx="40" cy="7" r="2" /></g>}
  </svg>;
}
