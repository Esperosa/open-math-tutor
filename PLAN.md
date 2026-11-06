# PLAN — redesign podle zadání uživatele

**Stav:** fáze 1–7 provedeny (viz git log). Odchylky od plánu: "Studijní text" používá existující režim `ask` místo nového režimu bridge; kontrola řádků běží lokálně v prohlížeči (ne přes /verify-step), protože pokrývá nejčastější chyby okamžitě a bez serveru. Verifikátor (SymPy) zatím nerozšířen o mocniny/soustavy/kvadratické rovnice; dovednosti, které neumí, jsou v UI označené "bez automatické kontroly".

Závazný plán. Pořadí se nemění, fáze se neodbývají. Po každé fázi: typecheck, lint,
unit + e2e testy, živé ověření v prohlížeči, commit, aktualizace REQUIREMENTS.md.
Zdroje: výzkum UX (Excalidraw 0.18 API, vzory HUD) a výzkum veřejných specifikací
zkoušek (Cermat, fakulty). Co není ověřeno, je v plánu označeno "draft".

## Cíl (use case)
Doučovač: student na úvodní obrazovce klikne kdo je a na co se připravuje, appka
sestaví plán a vede ho. Tabule je celá obrazovka, vše ostatní je HUD, který se
rozbalí jen na najetí/kliknutí. Počítání se průběžně kontroluje, špatný krok appka
nepřepíše řešením, ale nabídne vysvětlení. Z práce vznikají zápisky a studijní texty.

## Fáze 1 — Tabule na celou obrazovku + HUD (požadavky 4.3–4.6, 4.8)
- Tabule `position:fixed; inset:0`, Excalidraw ve zen režimu, vestavěné menu skryté.
- Levý rail 48 px (ikony): Kurzy, Zeptej se, Nahrát, Cvičení, Historie, Zápisky.
  Hover/klik vysune 320 px skleněnou zásuvku, Esc/klik mimo zavře.
- Horní chip: kurz › téma › dovednost + postup. Vpravo nastavení (jazyk, motiv,
  poskytovatel/model, hlas, data) v jedné nabídce, mimo hlavní pohled.
- Spodní akční pilulka: Zkontrolovat, Poradit, Další krok, Vysvětli jinak, Zastavit.
- Zadání jako plovoucí karta na tabuli (ne dvě pole nad ní).
- Ověřit v běžící appce, ne předpokládat: zenModeEnabled, co skryje, a ovládání níže.

## Fáze 2 — Ovládání plátna (pracovní tok)
- Kolečko = posun, Ctrl+kolečko/pinch = zoom, mezerník+tah, prostřední tlačítko
  (ověřit, že fungují; doplnit co chybí).
- Šipky posouvají plátno, když není nic vybráno a fokus není v poli.
- Plovoucí zoom (− / % / + / přizpůsobit), dvojklik na % = 100 %.
- Podržení (500 ms, zrušit při pohybu >6 px): kontextová nabídka na prázdném místě
  (Text, Guma, Přidat řádek, Zeptat se, Přiblížit sem) a na prvku (Kopírovat,
  Smazat, Zeptat se na tohle).
- Klávesové zkratky + nápověda (?).

## Fáze 3 — Průběžná kontrola a oprava při psaní
- Automatická kontrola v lekci zapnutá výchozně (debounce ~1,8 s).
- Nejdřív levná lokální kontrola verifikátorem, AI jen když je krok špatně.
- Značka ✓/✗ u každého řádku (HTML překryv podle scroll/zoom stavu).
- Špatný řádek: nic se nepíše na tabuli, bublina tutora
  "Řádek 2 nesedí. Chceš vysvětlit?" [Vysvětli] [Nápověda] [Zkusím sám].
- Systémový prompt: první odpověď je nápověda, ne výsledek (požadavek 1.13).
- Test: zadání 5+1=8 musí vyvolat značku ✗ a nabídku bez klikání na tlačítko.

## Fáze 4 — Obsah a vyhledávání (kurzy)
- Ctrl+K / pole v zásuvce Kurzy: hledá kurzy, témata, dovednosti (cs/en);
  volný text "chci se naučit …" bez shody jde do Zeptej se.
- Katalog rozšířen podle veřejných specifikací (originální úlohy, nic z archivu):
  ss-prijimacky (číslo, proměnná, závislosti a data, geometrie, nestandardní),
  maturita (základní/rozšiřující), vs-prijimacky (draft), a kurzy VŠ: analýza,
  lineární algebra, diskrétní matematika, statistika (vše draft, označit
  "neoficiální osnova"). "Vysoká škola — základy algebry" přejmenovat/rozdělit.
- Pole `calculator: none|basic|scientific` u kurzu (ss-prijimacky none,
  maturita basic podle Cermat, VŠ draft/neznámé = basic) s odkazem na zdroj.
- Verifikátor rozšiřovat v pořadí podle odemčených dovedností: 1) mocniny, odmocniny,
  polynomy (rozklad, vzorce) 2) soustavy lineárních rovnic 3) kvadratické rovnice,
  nerovnice, absolutní hodnota 4) funkce 5) matice/determinanty 6) kombinatorika.
  Dovednost, kterou verifikátor neumí, se označí "bez automatické kontroly".

## Fáze 5 — Kalkulačka
- Plovoucí přetahovatelný panel, výpočty přes bezpečný `mathEval.ts` (žádný eval).
- Funkce podle `calculator` kurzu; u `none` se tlačítko nezobrazí.

## Fáze 6 — Zápisky, export, studijní texty
- Export tabule PNG/SVG (padding 32 px), PDF zápisků přes tiskový styl.
- Zápisky na cvičení: zadání, kroky, vysvětlení, verdikty (Markdown/HTML).
- "Studijní text pro mě": z mastery a nedávných chyb vznikne text zaměřený na slabá
  místa (nový režim bridge, výstup označen jako neověřený AI text).
- Přehled "v čem jsem dobrý/slabý" (4.14) v zásuvce.

## Fáze 7 — Vedený tok a živost (4.11, 4.15)
- Onboarding dál než jeden klik: cíl, termín, úroveň → plán dovedností.
- Tutorova bublina/postavička (až po ustálení designu), tooltipy hover/dlouhý hover.

## Pravidla provádění
- Žádná fáze se nepřeskakuje ani nesloučí, dokud předchozí není hotová a ověřená.
- Nové chování má test (unit/e2e) a živé ověření; ověřovat v čistém profilu.
- Nepravdivé nároky na obsah zakázány: neověřené osnovy se v UI označí.
- Reálné zadání Cermatu/fakult se nekopíruje, jen veřejné specifikace.
- Commit po každé fázi bez stopy nástroje, push podle dosavadní dohody.
