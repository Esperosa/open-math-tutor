import type { Locale } from '@openmathtutor/shared';

/** Everyday questions about the app itself, answered without AI so they work offline and instantly. */
export type FaqId = 'marks' | 'modes' | 'delete' | 'write' | 'calculator' | 'voice' | 'move' | 'plan' | 'notes' | 'hint' | 'thanks' | 'hello';
export interface FaqAnswer { id: FaqId; text: string }

interface Entry { id: FaqId; keys: RegExp[]; cs: string; en: string }

const ENTRIES: Entry[] = [
  { id: 'marks', keys: [/\bznacka|\bznacky|znamen\w* (zelen|cerven|fajf|krizek|✓|✗)|fajfk|krizek|zelen\w* (znack|fajf)|cerven\w* (znack|krizek)|[✓✗]|checkmark|\btick\b|\bcross\b/],
    cs: 'U každého řádku vidíš ✓ (řádek sedí s předchozím) nebo ✗ (něco nesedí). Značka je jen moje rychlá kontrola počítání. Když si nejsem jistý, nedám žádnou. Na ✗ můžeš klepnout v bublině na „Nápověda“.',
    en: 'Each line gets a ✓ (it matches the line before) or a ✗ (something does not add up). It is only my quick calculation check. When I am not sure, I show no mark. Tap "Hint" in the bubble after a ✗.' },
  { id: 'modes', keys: [/prubezn|az na konec|hlidan|trener|vypnout|zapnout (kontrol|hlid)|rezim|prepnout|\blive\b|at the end|checking mode|switch (mode|checking)|turn off/],
    cs: 'Klepni na mě a nahoře v nabídce vyber, jak hlídat: „Průběžně“ (každý řádek hned), „Až na konec“ (až napíšeš výsledek) nebo „Vypnuto“ (mlčím a nemarkuju).',
    en: 'Tap me and pick in the menu how to watch: "As I go" (every line at once), "At the end" (once you write the result) or "Off" (I stay quiet and show no marks).' },
  { id: 'delete', keys: [/smaz|vymaz|odstran|guma|gumov|zrusit radek|opravit radek|delete|erase|remove (a )?line|rubber/],
    cs: 'Řádek smažeš přepsáním, nebo klepnutím na „Smazat chybný řádek“ v bublině u ✗. Podržení prstu na tabuli otevře nabídku s gumou a smazáním výběru. Poznámky učitele zmizí křížkem u nich.',
    en: 'Rewrite a line, or tap "Delete the wrong line" in the bubble after a ✗. Holding on the board opens a menu with the eraser and delete selection. Teacher notes go away with the cross next to them.' },
  { id: 'write', keys: [/jak (se )?(pise|psat|napsat|zapsat|zadat)|klavesnic|\bruku|perem|prstem|pisu|how (do i|to) (write|enter|type)|handwrit|keyboard/],
    cs: 'Klikni na tabuli a piš (Escape nebo klepnutí jinam dokončí řádek). Můžeš psát i perem, prstem nebo myší. Mezi řádky nech malou mezeru, každý řádek je jeden krok.',
    en: 'Click the board and write (Escape or a click elsewhere finishes the line). You can also write with a pen, finger or mouse. Leave a small gap between lines, each line is one step.' },
  { id: 'calculator', keys: [/kalkulack|kalkulator|spocitat|calculator/],
    cs: 'Kalkulačka je v pravém horním rohu. U některých kurzů je omezená stejně jako u zkoušky. Tlačítko „Do řádku“ výsledek zapíše na tabuli.',
    en: 'The calculator is in the top right corner. Some courses limit it the way the exam does. "Use in line" writes the result to the board.' },
  { id: 'voice', keys: [/\bhlas|mluv\w* nahlas|ticho|ztis|zvuk|mikrofon|voice|speak|sound|mute|microphone/],
    cs: 'Můj hlas zapneš v nabídce (klepni na mě): „Učitel mluví nahlas“. Rychlost a hlas najdeš v Nastavení. Mluvit se mnou můžeš tlačítkem s mikrofonem v rozhovoru.',
    en: 'Turn my voice on in the menu (tap me): "Teacher speaks aloud". Speed and voice are in Settings. You can talk to me with the microphone button in the chat.' },
  { id: 'move', keys: [/posun|posouv|zoom|priblizit|oddalit|zobrazit vse|ztratil|kde je|\bpan\b|scroll|move the board|\blost\b/],
    cs: 'Tabuli posuneš kolečkem, mezerníkem a tahem, nebo šipkami. Přiblížení je Ctrl + kolečko. Podržení na tabuli otevře nabídku s „Zobrazit vše“.',
    en: 'Move the board with the wheel, space and drag, or the arrow keys. Zoom with Ctrl + wheel. Holding on the board opens a menu with "Show all".' },
  { id: 'plan', keys: [/\bplan\w*|procent|\bkurz|pokrok|kolik (mi )?zbyva|progress|percent|course|how far/],
    cs: 'Plán a procenta najdeš vlevo v zásuvce „Plán a cesta“ a nahoře v liště. Každý vyřešený příklad je posune.',
    en: 'Your plan and percentages are in the left drawer "Plan and path" and in the top bar. Every solved problem moves them.' },
  { id: 'notes', keys: [/zapisk|export|stahnout|tisk|pdf|ulozit|download|print|save/],
    cs: 'Zápisky, tisk a export tabule jsou v zásuvce „Zápisky a pokrok“. Tabuli stáhneš jako PNG nebo SVG.',
    en: 'Notes, printing and board export are in the "Notes and progress" drawer. You can download the board as PNG or SVG.' },
  { id: 'hint', keys: [/napoved|poradit|nevim jak|jak (dal|pokracovat)|hint|stuck|how to continue/],
    cs: 'Napiš aspoň jeden řádek na tabuli. Když v něm je chyba, bublina nabídne „Nápověda“. Další krok ti ukážu na požádání tlačítkem „Ukaž další krok“.',
    en: 'Write at least one line on the board. When it has a mistake, the bubble offers "Hint". I show the next step on request with "Show the next step".' },
  { id: 'thanks', keys: [/dekuj|diky|dik\b|thanks|thank you/], cs: 'Rádo se stalo! Pokračuj, jdeš na to dobře.', en: 'You are welcome! Carry on, you are doing well.' },
  { id: 'hello', keys: [/^(ahoj|cau|cus|nazdar|dobry den|hello|hi|hey)\b/], cs: 'Ahoj! Napiš na tabuli příklad, nebo se zeptej, s čím si nevíš rady.', en: 'Hi! Write a problem on the board, or ask what you are stuck on.' },
];

const plain = (text: string) => text.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/\s+/g, ' ').trim();

/** Best matching everyday answer, or null when the question is not about the app (then it goes to the AI). */
export function answerFaq(question: string, locale: Locale): FaqAnswer | null {
  const q = plain(question);
  if (!q || q.length > 200) return null;
  let best: { entry: Entry; score: number } | null = null;
  for (const entry of ENTRIES) {
    const score = entry.keys.reduce((n, k) => n + (k.test(q) ? 1 : 0), 0);
    if (score > 0 && (!best || score > best.score)) best = { entry, score };
  }
  // A long free-form question that merely contains a keyword ("proč se mění znaménko u zlomku, kurz...") belongs to the AI.
  if (!best || (q.split(' ').length > 9 && best.entry.id !== 'marks' && best.entry.id !== 'modes')) return null;
  return { id: best.entry.id, text: best.entry[locale] };
}

export function faqById(id: FaqId, locale: Locale): FaqAnswer {
  const entry = ENTRIES.find(e => e.id === id)!;
  return { id, text: entry[locale] };
}
