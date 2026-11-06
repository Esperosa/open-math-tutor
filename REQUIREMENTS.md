# Požadavky a stav plnění

Tento soubor sepisuje **všechny** požadavky, které padly v průběhu vývoje
OpenMathTutor, a jejich aktuální stav. Cílem je, aby nic nezapadlo a šlo
vždy zkontrolovat, co ještě chybí. Aktualizuje se při každé větší změně.

Značky: ✅ hotovo a ověřeno · 🟡 částečně / probíhá · ❌ zatím neuděláno

---

## 1. Základní architektura (z původního zadání)

| # | Požadavek | Stav |
|---|---|---|
| 1.1 | Bring-your-own-subscription — žádné centrální API klíče | ✅ |
| 1.2 | Excalidraw (tabule), SymPy (ověřování), KaTeX (zápis) jako 3 hlavní stavební kameny | ✅ |
| 1.3 | Skutečně funkční appka, ne jen plán | ✅ |
| 1.4 | UI česky, lokalizovatelné do angličtiny | ✅ |
| 1.5 | Electron desktop scaffold (Windows) | ✅ scaffold, 🟡 nebalíme jako instalátor |
| 1.6 | Android/iOS obálka | ❌ vědomě mimo tuto fázi |
| 1.7 | Lokální bridge orchestrující CLI providery | ✅ |
| 1.8 | Bezpečné ověřování SymPy (žádný eval/exec/sympify/parse_expr) | ✅ + CI brána |
| 1.9 | TutorProvider rozhraní (detect/auth/models/analyze/continue/cancel/stream) | 🟡 `stream` nevyužíváno (vědomě, progresivní vylepšení) |
| 1.10 | Debounce ~1,5–2 s, manuální tlačítka (Zkontrolovat/Poradit/…) | ✅ |
| 1.11 | AI píše/kreslí přímo na tabuli (ne jen chat bublina) | ✅ |
| 1.12 | Najde **první** příčinnou chybu, ne každý další řádek | ✅ |
| 1.13 | Odstupňované nápovědy, ne rovnou celé řešení | 🟡 **nesplněno plně** — slepý test ukázal, že AI u "Zkontrolovat" rovnou řekne správný výsledek. Potřeba upravit systémový prompt. |
| 1.14 | Hlas (speechSynthesis, cs-CZ) | ✅ |
| 1.15 | MVP matematický rozsah (aritmetika, zlomky, procenta, závorky, lineární rovnice) | ✅ |
| 1.16 | Testy (unit/integration/e2e) | ✅ 159+50+161 testů, e2e scénáře |
| 1.17 | Bezpečnost (žádný shell z LLM, CSP, origin kontrola) | ✅ |
| 1.18 | Dokumentace, licence, README cz/en | ✅ |

## 2. Rozšíření — kurzy, kalkulačka, obsah (2. zpráva)

| # | Požadavek | Stav |
|---|---|---|
| 2.1 | AI appku **vede**, ne jen reaguje | 🟡 existuje `next_problem` režim, ale není to ještě primární vstupní tok (viz 4.x) |
| 2.2 | Volný textový dotaz ("řekni s čím mám problém") | ✅ panel "Zeptej se na cokoli" |
| 2.3 | Nahrávání skenů/fotek úlohy | ✅ UI hotové, čestně hlásí nedostupnost OCR u obou providerů |
| 2.4 | Předpřipravené kurzy (přijímačky SŠ/VŠ, maturita, VŠ) | ✅ 4 kurzy, původní úlohy |
| 2.5 | Reálné materiály od Cermatu apod. | ❌ **vědomě odmítnuto** (právní riziko veřejné redistribuce derivátů) — náhrada: výzkum veřejných specifikací zkoušek pro věrohodnější vlastní úlohy, zatím neprovedeno |
| 2.6 | Možnost vložit odkaz, appka bezpečně stáhne obsah (ne hromadné scrapování) | ❌ zatím jen upload souboru, ne URL |
| 2.7 | Interaktivní grafy | ✅ |
| 2.8 | Adaptivní, postupná výuka, appka pozná jak to studentovi jde | 🟡 mastery systém existuje (obtížnost per dovednost), ale bez souhrnného přehledu "v čem jsem dobrý/slabý" |
| 2.9 | Velká databáze kurzů + možnost vlastního kurzu (NotebookLM styl) | ✅ |

## 3. Vizuál a UX — 1. kolo

| # | Požadavek | Stav |
|---|---|---|
| 3.1 | Research + skills na UX/vizuál před zásahem | ✅ `pf-ux-optimalizace` + `pf-lidsky-vzhled` |
| 3.2 | Liquid glass / glassmorphism / minimalismus | 🟡 tokeny a sklovité panely hotové, ale **není to kompletní redesign** rozložení |
| 3.3 | Modernější, animovanější, responzivnější vzhled | 🟡 stíny/přechody/animace doplněny, ale jen jako polish nad stávajícím rozložením |
| 3.4 | Najít a opravit skryté bugy | ✅ 4 bugy z UX testu opraveny, + kritický bug s výběrem providera |
| 3.5 | Appka otestovaná reálným použitím, ne jen kódem | ✅ slepý tester, živé ověření přes prohlížeč |

## 4. Kompletní redesign a autonomie — 2. kolo (aktuální zpráva)

| # | Požadavek | Stav |
|---|---|---|
| 4.1 | Appka musí fungovat sama, bez zásahu uživatele | ✅ **nově opraveno a živě ověřeno**: appka si sama vybere funkčního poskytovatele, ne jen přihlášeného (viz incident níže) |
| 4.2 | Nový kritický bug: napsaný špatný příklad appka vůbec neopravila | ✅ **nalezeno a opraveno**: appka si sama defaultně vybírala Codex (nainstalovaný a přihlášený, ale s vypnutým tutoringem), takže kontrola tiše selhávala. Teď appka pozná rozdíl mezi "přihlášený" a "umí skutečně poradit" a preferuje funkčního providera; pokud žádný není, jasně to napíše. |
| 4.3 | Canvas (tabule) zabírá málo místa na obrazovce | ❌ **neuděláno** — tabule má pevnou výšku a sdílí prostor s vždy viditelným 320px bočním panelem |
| 4.4 | Hlavní má být canvas, v něm vyjížděcí panely / HUD | ❌ **neuděláno** — současné rozložení je pevná dvousloupcová mřížka, ne HUD nad tabulí |
| 4.5 | Správná práce s view, aby se vše vešlo na obrazovku | ❌ **neuděláno** — jen základní responzivní breakpointy, ne skutečný viewport-fit systém |
| 4.6 | Spousta věcí vidět nepotřebuji, patří do nastavení | ❌ **neuděláno** — bočník pořád ukazuje všechny sekce najednou |
| 4.7 | Není vidět, kde přesně jsem v jakém kurzu | ✅ **hotovo a živě ověřeno** — trvalá lišta nad tabulí: kurz › téma › dovednost + počet zvládnutých |
| 4.8 | Kompletní redesign vzhledu i UX (ne jen úpravy) | ❌ **neuděláno** — dosavadní práce byla polish, ne přestavba |
| 4.9 | Research na styl + na appky/programy, co tohle umí (konkurenční analýza) | ❌ **zatím neuděláno** — je dalším krokem |
| 4.10 | Nejdřív rozcestník: kdo jsem, na co se připravuju → appka vytvoří učební plán a provází mnou | ✅ **hotovo a živě ověřeno** — onboarding obrazovka při prvním spuštění (nebo po "Změnit kurz"), výběr kurzu rovnou spustí první úlohu na první odemčené dovednosti |
| 4.11 | Tutor-flow: já naklikám co potřebuju → appka dá úlohy → já to zkouším | 🟡 zlepšeno (4.10 je teď primární vstupní tok pro nového uživatele), ale pořád jen jedno kliknutí na kurz, ne vícekrokový výběr (úroveň, cíl, časový rámec…) |
| 4.12 | Integrovaná kalkulačka pro úlohy, co ji potřebují | ❌ **neexistuje** |
| 4.13 | Kalkulačka s možnostmi podle úlohy / podle toho, co je u zkoušky povoleno | ❌ **neexistuje** |
| 4.14 | Appka analyzuje, co studentovi jde a co ne | 🟡 data existují (mastery), ale bez viditelného přehledu/analýzy pro studenta |
| 4.15 | Appka vede jako běžné výukové appky (Duolingo apod. styl), pro matiku, interaktivní a živé | ❌ **neuděláno** — toto je cíl bodů 4.3–4.11 dohromady |
| 4.16 | Nový bug nalezený při živém testu 4.10: kurzy "Maturita" a "Vysoká škola — základy algebry" vůbec nešly spustit — appka hlásila "vše zvládnuto" u úplně nového uživatele (0 zvládnutých dovedností) | ✅ **nalezeno a opraveno** — oba kurzy přeskakovaly téma "Základy čísel", na kterém jsou ale (přímo i nepřímo) závislé všechny jejich dovednosti, takže se nikdy nic neodemklo; opraveno + přidán test, co tuhle třídu chyby hlídá pro všechny kurzy |
| 4.17 | Nový bug nalezený při živém testu 4.10: přepnutí na jiný kurz/lekci nechalo na tabuli rozepsaný předchozí příklad i jeho historii vysvětlení | ✅ **nalezeno a opraveno** — výběr nové lekce teď vždy založí čistě novou tabuli místo přepisování té aktuální |

## 5. Vědomě mimo rozsah (ne zapomenuté, ale explicitně odložené)

- Android/Capacitor obálka, iOS build
- "Sign in with ChatGPT" režim
- Skutečná animace psaní perem tah po tahu (místo postupného odhalení KaTeX)
- Geometrie, kvadratické rovnice, odmocniny (verifikátor zatím nepodporuje)
- Codex tutoring (fail-closed, dokud OpenAI nezveřejní způsob, jak mu bezpečně zakázat shell nástroje)
- Claude OCR/obrázkový vstup (žádný dokumentovaný způsob v neinteraktivním režimu)
- Animovaná postavička učitele (odloženo úmyslně na konec, ať sedí stylově k redesignu)
- Plnohodnotný systém tooltipů s krátkým/delším textem (zatím jen 1 info ikona)

---

**Další krok:** body 4.3–4.15 jsou jeden provázaný problém — appka potřebuje nový
primární tok (rozcestník → učební plán → vedená lekce v HUD nad tabulí) místo
současného "vše najednou v bočním panelu". To je skutečná přestavba
architektury frontendu, ne kosmetická úprava, a bude se dělat jako taková:
nejdřív krátký konkurenční research, pak návrh obrazovek, pak postupná
implementace po krocích s testem u každého kroku.
