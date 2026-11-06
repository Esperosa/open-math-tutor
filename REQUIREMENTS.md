# Požadavky a stav plnění

Tento soubor sepisuje **všechny** požadavky, které padly v průběhu vývoje
OpenMathTutor, a jejich aktuální stav. Cílem je, aby nic nezapadlo a šlo
vždy zkontrolovat, co ještě chybí. Aktualizuje se při každé větší změně.

Značky: ✅ hotovo a ověřeno · 🟡 částečně / probíhá · ❌ zatím neuděláno

---

## 0. NEJVYŠŠÍ POŽADAVEK: je to TABULE a musí číst to, co na ni člověk napíše rukou

Pointa celé aplikace: student píše a kreslí na tabuli (pero, prst, myš) a appka **sama pozná, co napsal**, kontroluje to, vede ho a komentuje. Tohle je důležitější než cokoli jiného v tomto souboru; nic nesmí být označeno jako hotové, dokud to neprojde testem s ručně psaným vstupem.

| # | Požadavek | Stav |
|---|---|---|
| 0.1 | Ručně psané číslice, operátory a proměnné (tahy tužkou/prstem/myší) se čtou **lokálně v prohlížeči** malým modelem, bez AI a bez sítě | 🟡 rozpracováno |
| 0.2 | Rozpoznaný text je u řádku vidět („Přečetl jsem: 5+2=15“) a jde ho jedním klepnutím opravit z kandidátů, bez klávesnice | 🟡 |
| 0.3 | Rozpoznaný rukopis jde stejnou lokální kontrolou jako psaný text (✓/✗, trenér, procenta, mastery) | 🟡 |
| 0.4 | Když AI není připojená, appka to **řekne na rovinu** a ukáže, jak ji připojit (co spustit/přihlásit); lokální čtení a kontrola fungují i bez ní | 🟡 |
| 0.5 | AI s obrazem je volitelný doplněk pro těžký rukopis a kresby, nikdy jediná cesta | 🟡 |
| 0.6 | Testovací matice: rukopis (syntetické tahy z Hershey fontu s šumem + held-out MNIST), různé adresy (localhost/127.0.0.1), bridge nedostupný/dostupný, zoom 50–200 %, posunutá tabule, světlý/tmavý, telefon a dotyk/pero/myš, pomalé/rychlé psaní | 🟡 |
| 0.8 | Zvládá českou rozmanitost zápisu: dělení `:` `÷` `/` zlomková čára, násobení `×` `·` `*` `x`, všechny druhy závorek, desetinná čárka/tečka, evropské tvary číslic (1 s hákem, 7 s příčkou), `=` jedním i dvěma tahy, nerovnosti, odmocnina, %, π | 🟡 |
| 0.9 | Každý rozpoznaný symbol je přiřazený ke konkrétním tahům na tabuli (kde přesně je napsán) a nese kandidáty a jistotu | 🟡 |
| 0.10 | Nejistý rukopis jde AI i jako obrázek spolu s lokálním přepisem, polohou a nejistými symboly, aby AI mohla opravit čtení | 🟡 |
| 0.11 | Tabule je interaktivní pro korektury: student i AI dopisují, podtrhávají, škrtají, mažou části; přeškrtnutý symbol se ignoruje, přepsaný se čte znovu, přepočet jen změněných tahů | 🟡 |
| 0.12 | AI tutor **píše přímo do tabule jako učitel, který opravuje a vysvětluje**: ručně vypadajícím písmem a barvou odlišenou od studenta dopíše opravu vedle chybného místa, zakroužkuje/podtrhne/přeškrtne chybu, nakreslí šipku a krátké vysvětlení, rozepíše správný další krok pod řádek; nejen text v bublině | ✅ `teacher.spec.ts` ověří všech 8 typů akcí na tabuli, rukopisný font a červené/tyrkysové pero (pixmapový test PNG exportu); systémový prompt i `validation.ts` řídí pořadí (nejdřív kroužek/škrtnutí první chyby) a povolují škrtnutí, šipku i `write_math` pod řádek |
| 0.13 | Zápis AI se objevuje postupně (jako psaný), je v samostatné vrstvě, student ho může smazat/skrýt; AI se na místa odkazuje přes řádek/symbol (ne odhadnuté souřadnice) | ✅ `teacher.spec.ts`: postupné psaní (`data-writing`, `prefers-reduced-motion` zobrazí najednou), mazání jedné poznámky křížkem, zobrazení/skrytí/smazání z nabídky maskota, anotace nikdy nepřekrývají studentův text; bridge odmítne absolutní souřadnice a neznámá stepId (`validation.test.ts`) |
| 0.14 | Bublina maskota je jen stručný komentář; podstatné opravy a vysvětlení jsou na tabuli | ✅ `BRIDGE_API.md` + `prompt.test.ts`: `pedagogicalResponse` má nejvýše tři krátké věty (≤ ~220 znaků), podstatné věty jsou na tabuli jako `boardActions`; e2e ověří, že komentář dospí v bublině a opravy nezávisle na tabuli |
| 0.7 | Úspěšnost čtení se měří a zapisuje do dokumentace (číslice, operátory, celé řádky); pod stanovenou hranicí se nic netvrdí | 🟡 |

---

## 7. Hlas a papír tabule (zpráva z 2026-11-06 večer)

| # | Požadavek | Stav |
|---|---|---|
| 7.1 | Vzory papíru tabule: čistý, kostičkovaný, linkovaný, tečkovaný, školní s okrajem; sledují posun a zoom | ✅ (výběr v Nastavení) |
| 7.2 | Úvodní karta zadání se nesmí překrývat s menu plátna | ✅ karta se skryje při otevřeném menu |
| 7.3 | Víc a lepších hlasů: online hlasy prohlížeče (např. Microsoft Natural v Edge) jako volitelná možnost s upozorněním na odesílání textu do cloudu | ✅ |
| 7.4 | Kvalitní open-source hlasy v prohlížeči (Piper přes @diffusionstudio/vits-web, česká `cs_CZ-jirka` a anglické hlasy), stahování modelu jednou s varováním o velikosti, licence hlasů ověřit a uvést v NOTICE.md | ❌ naplánováno |
| 7.5 | Průchod celým UI/UX znovu a poctivé označení nedodělků (dřívější „hotovo“ neplatí tam, kde to uživatel vidí jinak) | 🟡 průběžně |

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
| 1.13 | Odstupňované nápovědy, ne rovnou celé řešení | ✅ prompt přepsán: u Zkontrolovat/Poradit jen nápověda a naváděcí otázka, celé řešení až na "Ukaž další krok" nebo výslovnou žádost |
| 1.14 | Hlas (speechSynthesis, cs-CZ) | ✅ |
| 1.15 | MVP matematický rozsah (aritmetika, zlomky, procenta, závorky, lineární rovnice) | ✅ |
| 1.16 | Testy (unit/integration/e2e) | ✅ audit 6: shared 92, frontend 75, e2e 30, lint a typecheck; dříve ověřeno: content 34, bridge 161, verifier 161 |
| 1.17 | Bezpečnost (žádný shell z LLM, CSP, origin kontrola) | ✅ |
| 1.18 | Dokumentace, licence, README cz/en | ✅ |

## 2. Rozšíření — kurzy, kalkulačka, obsah (2. zpráva)

| # | Požadavek | Stav |
|---|---|---|
| 2.1 | AI appku **vede**, ne jen reaguje | ✅ onboarding → první úloha, vedená lekce, nabídka vysvětlení při chybě |
| 2.2 | Volný textový dotaz ("řekni s čím mám problém") | ✅ panel "Zeptej se na cokoli" |
| 2.3 | Nahrávání skenů/fotek úlohy | ✅ UI hotové, čestně hlásí nedostupnost OCR u obou providerů |
| 2.4 | Předpřipravené kurzy (přijímačky SŠ/VŠ, maturita, VŠ) | ✅ 10 kurzů, původní úlohy |
| 2.5 | Reálné materiály od Cermatu apod. | 🟡 vědomě bez kopírování zkoušek; katalog rozšířen podle **veřejných specifikací** (Cermat JPZ/maturita), originální úlohy, zdroj u kurzu |
| 2.6 | Možnost vložit odkaz, appka bezpečně stáhne obsah (ne hromadné scrapování) | ❌ zatím jen upload souboru, ne URL |
| 2.7 | Interaktivní grafy | ✅ |
| 2.8 | Adaptivní, postupná výuka, appka pozná jak to studentovi jde | ✅ souhrn "Můj pokrok": zvládám / potřebuju zapracovat / procvičuju + studijní text na míru |
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
| 4.3 | Canvas (tabule) zabírá málo místa na obrazovce | ✅ tabule je celá obrazovka (`position: fixed`), vše ostatní plave nad ní |
| 4.4 | Hlavní má být canvas, v něm vyjížděcí panely / HUD | ✅ HUD: levý rail s výsuvnými zásuvkami (hover nebo klik, Esc/klik mimo zavře), horní lišta kurz › téma › dovednost, spodní akční pilulka, plovoucí zadání |
| 4.5 | Správná práce s view, aby se vše vešlo na obrazovku | ✅ rozložení se vejde do okna bez scrollu stránky; pod 900 px se panely přeskupí (ověřeno e2e na 390 px) |
| 4.6 | Spousta věcí vidět nepotřebuji, patří do nastavení | ✅ nastavení (jazyk, motiv, poskytovatel/model, hlas, soukromí) jsou v jednom vysouvacím panelu mimo hlavní pohled |
| 4.7 | Není vidět, kde přesně jsem v jakém kurzu | ✅ **hotovo a živě ověřeno** — trvalá lišta nad tabulí: kurz › téma › dovednost + počet zvládnutých |
| 4.8 | Kompletní redesign vzhledu i UX (ne jen úpravy) | ✅ nové rozložení i ovládání (HUD, zásuvky, kalkulačka, mascot) místo kosmetických úprav |
| 4.9 | Research na styl + na appky/programy, co tohle umí (konkurenční analýza) | 🟡 proběhl research UX vzorů (Excalidraw 0.18 API, tldraw, Desmos, Khanmigo) a veřejných osnov; nepodařilo se ověřit oficiální procentní váhy témat ani katalog požadavků k maturitě, viz PLAN.md |
| 4.10 | Nejdřív rozcestník: kdo jsem, na co se připravuju → appka vytvoří učební plán a provází mnou | ✅ **hotovo a živě ověřeno** — onboarding obrazovka při prvním spuštění (nebo po "Změnit kurz"), výběr kurzu rovnou spustí první úlohu na první odemčené dovednosti |
| 4.11 | Tutor-flow: já naklikám co potřebuju → appka dá úlohy → já to zkouším | ✅ dvoukrokový onboarding (kdo jsem + jak mi to jde) → kurz → úloha → kontrola; zbývá termín/cíl zkoušky |
| 4.12 | Integrovaná kalkulačka pro úlohy, co ji potřebují | ✅ kalkulačka na HUD, bezpečný vlastní vyhodnocovač (bez eval), tlačítko "Do řádku" |
| 4.13 | Kalkulačka s možnostmi podle úlohy / podle toho, co je u zkoušky povoleno | ✅ funkce podle kurzu: přijímačky SŠ bez kalkulačky, maturita vědecká bez grafu a řešení rovnic (zdroj Cermat), VŠ studijní |
| 4.14 | Appka analyzuje, co studentovi jde a co ne | ✅ panel "Zápisky a pokrok" ukazuje, co jde a co ne |
| 4.15 | Appka vede jako běžné výukové appky (Duolingo apod. styl), pro matiku, interaktivní a živé | 🟡 vedený tok, živá kontrola, tutor-postavička a tooltipy hotové; Duolingo-styl série/odměny a plán na termín zatím ne |
| 4.16 | Nový bug nalezený při živém testu 4.10: kurzy "Maturita" a "Vysoká škola — základy algebry" vůbec nešly spustit — appka hlásila "vše zvládnuto" u úplně nového uživatele (0 zvládnutých dovedností) | ✅ **nalezeno a opraveno** — oba kurzy přeskakovaly téma "Základy čísel", na kterém jsou ale (přímo i nepřímo) závislé všechny jejich dovednosti, takže se nikdy nic neodemklo; opraveno + přidán test, co tuhle třídu chyby hlídá pro všechny kurzy |
| 4.17 | Nový bug nalezený při živém testu 4.10: přepnutí na jiný kurz/lekci nechalo na tabuli rozepsaný předchozí příklad i jeho historii vysvětlení | ✅ **nalezeno a opraveno** — výběr nové lekce teď vždy založí čistě novou tabuli místo přepisování té aktuální |
| 4.18 | Živá kontrola při psaní: špatný řádek (např. 5+1=8) se označí ✗ a appka nabídne vysvětlení, ne rovnou řešení | ✅ lokální kontrola v prohlížeči (číselné rovnice, ekvivalence lineárních rovnic), značka u řádku, bublina "Vysvětli / Nápověda / Zkusím sám"; AI se volá až po kliknutí. Co kontrola neumí, označí "neznámé", nikdy "správně" |
| 4.19 | Ovládání plátna: scroll/zoom, šipky, podržení = nabídka | ✅ kolečko/pinch/mezerník (Excalidraw), šipky posouvají, podržení 500 ms otevře nabídku (text, guma, zeptat se, přiblížit sem, zobrazit vše, smazat výběr) |
| 4.20 | Vyhledání konkrétního tématu, jak ho student nazývá | ✅ Ctrl+K / pole v zásuvce Kurzy, bez diakritiky, klíčová slova; bez shody nabídne "Zeptat se AI" |
| 4.21 | Úplnější obsah (např. proč VŠ jen základy algebry) | ✅ 10 kurzů, 71 dovedností (matematika, VŠ předměty, fyzika, chemie): SŠ přijímačky, VŠ přijímačky, maturita, VŠ algebra, analýza, lineární algebra, diskrétní matematika, statistika. Dovednosti bez možnosti strojové kontroly jsou označené, VŠ osnovy jako "neoficiální" |
| 4.22 | Export a studijní materiály | ✅ zápisky (.md), tisk/PDF, tabule PNG/SVG, "Studijní text pro mě" (AI text označený jako neověřený) |
| 4.23 | Tooltipy: krátký text hned, delší při delším podržení | ✅ rail ikony (hover → název, po 1,2 s vysvětlení) |

## 4b. Druhá vlna: mentor (PLAN2.md)

| # | Požadavek | Stav |
|---|---|---|
| 5.1 | Student píše jen na tabuli, žádná povinná pole | ✅ text se píše přímo na plátno (výchozí nástroj), zadání je karta jen ke čtení (✎ jen pro úpravu), akce jsou v nabídce maskota |
| 5.2 | Appka sama sleduje psaní, kontroluje, vede a komentuje; jde vypnout, "po řádcích", "až na konec" | ✅ lokální trenér `coach.ts`; tři režimy v nabídce maskota; vypnutý trenér nemá značky ani bubliny; odlišná hodnota podobná výsledku slovní úlohy vyvolá měkký dotaz, ne automatický neúspěch; „Je to výsledek“ řádek posoudí jako finální a „Nevyšlo mi to“ zapíše přiznaný neúspěch; AI se nikdy nevolá automaticky při startu lekce; u řádku, který nejde ověřit lokálně, jen s povolením v Nastavení, jinak nabídka v bublině |
| 5.3 | Správný výsledek poznat bez AI, i s jednotkou | ✅ `answers.ts`: očekávaná odpověď z výrazu / lineární rovnice / `answerTemplate`, číselné odpovědi podle zapsané přesnosti (bez plošné 1% tolerance), jednotky a aliasy se kontrolují |
| 5.4 | Maskot-učitel mluví, má bublinu a mikrofon | ✅ vlastní SVG/CSS: mrkání, dýchání/houpání, občasné mávnutí a pohled, poskok/obočí/tečky podle nálady, pusa při řeči a tužka při typování; speechSynthesis, stručná rukopisná bublina s "Více", lokální přivítání viditelné po onboardingu i při zahájení lekce; push-to-talk přes Web Speech API (jen kde ho prohlížeč má; lokální Whisper vědomě ne) |
| 5.5 | Paměť o studentovi a styl vysvětlování | ✅ `learnerProfile.ts` (chyby podle typu a dovednosti, úspěšnost stylů, dny); souhrn jde AI jako `learnerContext`; student se na nic neptá |
| 5.6 | Plán s procenty, co mě čeká | ✅ zásuvka "Plán a cesta" + procenta v horní liště; mění se podle mastery; lekce z Kurzů přebírá svůj kurz |
| 5.7 | Test na doma jako PDF s klíčem | ✅ `testGen.ts` + `testSheet.ts`: tisk/PDF a HTML, klíč odpovědí na poslední stránce; vyfocené řešení vyhodnotí jen model s obrázky (řečeno v UI) |
| 5.8 | Fyzika a chemie, kreslení | ✅ kurzy Fyzika a Chemie s číselnými úlohami kontrolovanými bez AI; úlohy s kresbou jsou označené, AI kresby zatím nevidí |
| 5.9 | HUD bez překryvů | ✅ jedna zásuvka vlevo, jeden vyskakovací panel (nastavení / kalkulačka / učitel) naráz, vlastnosti Excalidrawu skryté, karty pod lištou nástrojů; měřeno e2e a testery |
| 5.10 | Učitel dojde ke komentovanému řádku a vrátí se do rohu | ✅ read-only geometrie řádku včetně pan/zoom a víceřádkového textu; transform overlay s kontrolou cíle i trasy proti HUD/toolbaru, návrat po cca 3–9 s, fallback v rohu při chybějící/neviditelné geometrii nebo nedostatku místa; žádná změna studentského plátna |
| 5.11 | Komentář nebrání psaní a respektuje omezený pohyb | ✅ mimo roh `pointer-events: none` i během návratu, akce zakázané do jeho dokončení; typewriter bez poskakování rozložení, celá věta pro čtečku; `prefers-reduced-motion` ukáže celý text okamžitě a vypne animace/přechody; unit + headless e2e testy včetně telefonu |

## 6. Vědomě mimo rozsah (ne zapomenuté, ale explicitně odložené)

- Android/Capacitor obálka, iOS build
- "Sign in with ChatGPT" režim
- Skutečná animace psaní perem tah po tahu (místo postupného odhalení KaTeX)
- Geometrie, kvadratické rovnice, odmocniny (verifikátor zatím nepodporuje)
- Codex tutoring (fail-closed, dokud OpenAI nezveřejní způsob, jak mu bezpečně zakázat shell nástroje)
- Claude OCR/obrázkový vstup (žádný dokumentovaný způsob v neinteraktivním režimu)
- Rozšíření SymPy verifikátoru o mocniny, soustavy, kvadratické rovnice a funkce (dovednosti bez něj jsou označené)
- Odměny a hry (jen série dní a dnešní počet v plánu), plán podle data zkoušky
- Oficiální procentní váhy témat a aktuální katalog požadavků k maturitě (nepodařilo se ověřit)

---

## Audit 6 — pravidla kontroly a započítání

- Přesné číselné hodnoty nemají procentní pásmo tolerance. Nižší zapsaná přesnost dovoluje skutečné zaokrouhlení, nikoli sousední hodnotu stejné přesnosti (175,6 g není 175,5 g). Zaokrouhlení měřených hodnot je omezené relativně na 1e-3; výslovné školní zlomky mají výjimku pro dvě a více desetinných míst (zachovává i 0,88 pro 7/8). U periodických zlomků se přijímá i zkrácení, např. 0,66 pro 2/3. Zlomky, smíšená čísla, π-koeficienty a vědecký zápis včetně e+ zůstávají podporované.
- Desetinná čárka i tečka se ověřují v aritmetických rovnostech a řetězcích, včetně jednotky na konci. Mezivýsledky ani opsaná data se automaticky neposuzují jako chybný finální výsledek.
- Mastery a profil započítají první finální posouzení úlohy právě jednou. Pozdější oprava vyvolá pochvalu a nabídku další úlohy, nikoli druhý pokus/úspěch; chyby jednotlivých kroků se v profilu sledují samostatně. Zaokrouhlené procento kurzu se nemusí změnit po každém pokusu.
- Řádky delší než 400 znaků se lokálně neověřují (ochrana před nákladnými regulárními výrazy), obsah tabule se nekrátí.
- Escape během editace řádku dokončí psaní, ale nezavírá kalkulačku. Na telefonech kalkulačka ponechává volný levý rail a spodní ovládání tabule.
