export type TutorMood = 'idle' | 'thinking' | 'concerned' | 'happy';

/** Small geometric tutor: a chalkboard-green rounded head, blinking eyes and a pencil. Purely decorative. */
export function Tutor({ mood }: { mood: TutorMood }) {
  return <svg className={`tutor tutor-${mood}`} data-testid="tutor" data-mood={mood} viewBox="0 0 64 64" width="64" height="64" aria-hidden="true">
    <g className="tutor-body">
      <rect x="10" y="12" width="44" height="40" rx="14" fill="var(--accent)" />
      <rect x="16" y="20" width="32" height="24" rx="9" fill="var(--paper)" />
      <g className="tutor-eyes" fill="var(--ink)">
        <ellipse cx="25" cy="31" rx="2.6" ry="3.4" /><ellipse cx="39" cy="31" rx="2.6" ry="3.4" />
      </g>
      {mood === 'concerned'
        ? <path d="M26 39c3-2 9-2 12 0" fill="none" stroke="var(--ink)" strokeWidth="2" strokeLinecap="round" />
        : <path d="M26 38c3 3 9 3 12 0" fill="none" stroke="var(--ink)" strokeWidth="2" strokeLinecap="round" />}
      <path className="tutor-pencil" d="M50 46l8-10 3 2-8 10-4 2z" fill="#d9a441" stroke="var(--ink)" strokeWidth="1.2" strokeLinejoin="round" />
    </g>
  </svg>;
}
