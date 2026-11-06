/** Author credit with the pelican logo; the logo is the author's own mark and stays unmodified. */
export function Credit({ locale, compact = false }: { locale: 'cs' | 'en'; compact?: boolean }) {
  const label = locale === 'cs' ? 'Vytvořil Jiří Pelikán' : 'Created by Jiří Pelikán';
  return <a className={`credit${compact ? ' credit-compact' : ''}`} href="https://jirkapelikan.cz" target="_blank" rel="noopener noreferrer" aria-label={`${label}, jirkapelikan.cz`}>
    <img src="/pelikan-logo.png" alt="" width="22" height="22" />
    <span>{label} · jirkapelikan.cz</span>
  </a>;
}
