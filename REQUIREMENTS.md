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
| 0.1 | Ručně psané číslice, operátory a proměnné (tahy tužkou/prstem/myší) se čtou **lokálně v prohlížeči** malým modelem, bez AI a bez sítě | ✅ `ink.spec.ts` kreslí skutečné tahy myší, perem i dotykem; lokální model bez síťového volání. Naměřeno: 98,99 % MNIST, 97,57 % pendigits, 92,08 % neviděné fonty ([report](docs/handwriting-e2e-report.md)) |
| 0.2 | Rozpoznaný text je u řádku vidět („Přečetl jsem: 5+2=15“) a jde ho jedním klepnutím opravit z kandidátů, bez klávesnice | ✅ `ink-reading-*` s přepisem a `data-confidence`; kandidáti a `correctInk` s regresním testem, oprava přepočítá `parserCompatible` |
| 0.3 | Rozpoznaný rukopis jde stejnou lokální kontrolou jako psaný text (✓/✗, trenér, procenta, mastery) | ✅ `ink.spec.ts` ověří ✓ i ✗; `boardState.ts` a `lines.ts` řeší nejistotu i započtení do mastery |
| 0.4 | Když AI není připojená, appka to **řekne na rovinu** a ukáže, jak ji připojit (co spustit/přihlásit); lokální čtení a kontrola fungují i bez ní | ✅ HUD `ai-status` s `data-state="offline"`; všechny ink e2e běží s nedostupným bridge |
| 0.5 | AI s obrazem je volitelný doplněk pro těžký rukopis a kresby, nikdy jediná cesta | 🟡 hinty a `imageCrop` jsou hotové a validované, ale oba provideři obrázek v neinteraktivním režimu odmítají (`multimodal_unsupported`) |
| 0.6 | Testovací matice: rukopis (syntetické tahy z Hershey fontu s šumem + held-out MNIST), různé adresy (localhost/127.0.0.1), bridge nedostupný/dostupný, zoom 50–200 %, posunutá tabule, světlý/tmavý, telefon a dotyk/pero/myš, pomalé/rychlé psaní | 🟡 pokryto: myš/pero/dotyk, 200% zoom + pan, telefon, bridge offline, rychlé i pomalé tahy. Chybí 50% zoom, tmavý/světlý motiv a `localhost` vs `127.0.0.1` |
| 0.8 | Zvládá českou rozmanitost zápisu: dělení `:` `÷` `/` zlomková čára, násobení `×` `·` `*` `x`, všechny druhy závorek, desetinná čárka/tečka, evropské tvary číslic (1 s hákem, 7 s příčkou), `=` jedním i dvěma tahy, nerovnosti, odmocnina, %, π | 🟡 desetinná čárka/tečka mezi číslicemi a celé stojící zlomky mají geometrii i pen e2e z kola 7; `x`/`×`, nové třídy a další neviděné rukopisy zůstávají limitem modelu |
| 0.9 | Každý rozpoznaný symbol je přiřazený ke konkrétním tahům na tabuli (kde přesně je napsán) a nese kandidáty a jistotu | ✅ `RecognizedSymbol.strokeIds`/`bbox`/`candidates`; testy ověří stabilní `stepId`, kandidáty i neměnnost vstupu |
| 0.10 | Nejistý rukopis jde AI i jako obrázek spolu s lokálním přepisem, polohou a nejistými symboly, aby AI mohla opravit čtení | 🟡 `handwriting` hinty s polohou, kandidáty, pořadím tahů a jistotou jdou; obrázek blokuje `multimodal_unsupported` |
| 0.11 | Tabule je interaktivní pro korektury: student i AI dopisují, podtrhávají, škrtají, mažou části; přeškrtnutý symbol se ignoruje, přepsaný se čte znovu, přepočet jen změněných tahů | 🟡 mazání a cache fungují, dlouhé přeškrtnutí má pen e2e; krátké nejasné škrtnutí vyžádá gumu a zachová nejistotu. Univerzální rozpoznání korektur a plná korektura AI nejsou dokončené |
| 0.12 | AI tutor **píše přímo do tabule jako učitel, který opravuje a vysvětluje**: ručně vypadajícím písmem a barvou odlišenou od studenta dopíše opravu vedle chybného místa, zakroužkuje/podtrhne/přeškrtne chybu, nakreslí šipku a krátké vysvětlení, rozepíše správný další krok pod řádek; nejen text v bublině | ✅ `teacher.spec.ts` ověří všech 8 typů akcí na tabuli, rukopisný font a červené/tyrkysové pero (pixmapový test PNG exportu); systémový prompt i `validation.ts` řídí pořadí (nejdřív kroužek/škrtnutí první chyby) a povolují škrtnutí, šipku i `write_math` pod řádek |
| 0.13 | Zápis AI se objevuje postupně (jako psaný), je v samostatné vrstvě, student ho může smazat/skrýt; AI se na místa odkazuje přes řádek/symbol (ne odhadnuté souřadnice) | ✅ `teacher.spec.ts`: postupné psaní (`data-writing`, `prefers-reduced-motion` zobrazí najednou), mazání jedné poznámky křížkem, zobrazení/skrytí/smazání z nabídky maskota, anotace nikdy nepřekrývají studentův text; bridge odmítne absolutní souřadnice a neznámá stepId (`validation.test.ts`) |
| 0.14 | Bublina maskota je jen stručný komentář; podstatné opravy a vysvětlení jsou na tabuli | ✅ `BRIDGE_API.md` + `prompt.test.ts`: `pedagogicalResponse` má nejvýše tři krátké věty (≤ ~220 znaků), podstatné věty jsou na tabuli jako `boardActions`; e2e ověří, že komentář dospí v bublině a opravy nezávisle na tabuli |
| 0.15 | Zadání lekce se na tabuli samo „napíše“ animací (rukopisné písmo ve vrstvě učitele) při startu lekce, a klepnutím na kartu zadání vlevo se napíše znovu; student s ním může rovnou pracovat (píše pod něj / vedle něj), nemusí nic opisovat. Karta zůstává jako malý odkaz na zadání | ✅ zápis zadání na tabuli při startu lekce a po „Další příklad“ animací postupného psaní (rukopisné písmo Virgil, tyrkysová barva učitele, vrstva učitele customData.aiLayer, registerStepLocator zadání bez počítání jako studentský řádek, plynulý posun viewportu bez změny zoomu mimo HUD). Klepnutí na kartu zadání smaže staré a animuje znovu. Sází čitelně zlomky (a/b), exponenty (² ³ ⁿ) a · místo *. Exportuje se do PNG, lze smazat křížkem. Respektuje prefers-reduced-motion; reload načte stav bez zdvojení/přeanimování. Volná tabule nepíše nic. Testy: taskFormatting.test.ts + e2e board-prompt-legend-uncertainty.spec.ts |
| 0.16 | Kompletní průchod každým kurzem rukou po celé postupné cestě (odemykání dovedností) jako student, automaticky i nezávislým testerem; report s úspěšností | 🟡 běží (DeepSeek walker, tester kolo 7/8) |
| 0.17 | Rozpoznávač má změřenou KALIBRACI a práh nejistoty: pro každou třídu symbolu křivka jistota → skutečná správnost, zvolený práh „nejistý“ s měřenou chybovostí pod/nad prahem; testovací sady zahrnují víc stylů (pisatelé, tloušťky, sklony, velikosti, leváci/praváci, děti, myš vs. pero vs. dotyk, rychlé vs. pomalé psaní) a počty stylů se uvádějí v ACCURACY.md | ✅ spolehlivostní křivka a prahy v calibration.json; osobní kalibrace („Naučit se moje písmo“) v localStorage se vzorky a k-NN / prototypovým blendingem; měřeno na simulovaných osobitých stylech pisatele (kontinentální 7 vs 1 před 0 %, po 100 %). Měřeno na 14 held-out pendigits pisatelích (96,51 %) a held-out Hershey komplex/triplex fontech (97,08 %). |
| 0.18 | Když si rozpoznávač není jistý, appka to řekne a ukáže VZOR znaku (jak ho psát, např. 1 s háčkem, 7 s příčkou, 4 otevřená), nabídne psát větší/pomaleji/odděleně a pokud jde, použije AI s obrázkem; student není obviňován | ✅ přátelské hlášení u nejistého čtení bez obviňování studenta („Nejsem si jistý, jak jsem to přečetl. Zkus psát o něco větší a oddělenější, nebo klepni na správný znak.“). Vyskakovací okno se vzory tvarů v SVG (1 s háčkem, 7 s příčkou, 4 otevřená, x vs ×, čárka vs tečka, dělení : /), tlačítky „Opravit klepnutím“ (kandidáti), „Zkusit znovu napsat“ (odstranění tahu řádku) a „Poslat AI k přečtení“ (aktivní jen při připojené AI s podporou obrazu, jinak vysvětlení důvodu). Testy: uncertaintyGuides.test.tsx + e2e board-prompt-legend-uncertainty.spec.ts |
| 0.19 | Legenda barev a značek na tabuli: červené pero = oprava/chyba, tyrkysové = vysvětlení učitele, zelená ✓ = správně, ✗ = nesedí, šedá = nejisté čtení; legenda je dostupná jedním klepnutím („Co znamenají barvy?“) a učitel/AI ji při první poznámce stručně řekne; barvy jsou čitelné i v tmavém režimu a pro barvoslepé (tvar značky navíc) | ✅ legenda barev a značek: otevření z nabídky maskota („Co znamenají barvy?“) i z ikony ? u odznaku vrstvy učitele. 5 položek: červené pero (oprava/chyba, #b42318), tyrkysové pero (vysvětlení učitele, #065f69), zelená ✓ (správně, #136340), červený ✗ (nesedí, #a32d2d), šedá ? (nejisté čtení, #475467). Rozlišení tvarem pro barvoslepost (✓ kroužek, ✗ kříž, ? tečka, pera). Kontrast ≥ 4,5:1 ve světlém i tmavém režimu. Učitel při první poznámce na tabuli jednou větou vysvětlí legendu (uloženo, po smazat vše znovu). Texty cs+en. Testy: colorLegend.test.tsx + e2e board-prompt-legend-uncertainty.spec.ts |
| 0.20 | Kontextová predikce nejistého znaku: skladba řádku hledá nejlepší celkové čtení (beam search přes kandidáty symbolů) podle syntaxe a typografie (po operátoru číslice, jedno `=`, desetinný oddělovač mezi číslicemi, závorky se párují, `x` jako proměnná vs `×` podle okolí) a podle slovníku z ZADÁNÍ (proměnné, jednotky, čísla ze zadání), nikdy podle toho, zda rovnice vychází (jinak by se chybné odpovědi „opravovaly“ na správné); změna oproti nejlepšímu samostatnému čtení se ukáže ve štítku „Přečetl jsem“ a jde vrátit; měří se přínos a falešné „opravy“ | ✅ beam search v context.ts s gramatikou výrazů (penalizace ^+, dvojitých operátorů, = uvnitř čísla, nesmyslných závorek), slabý prior ze zadání (5+1 -> 5+1=), plausibilita počtu číslic (=1005 po 5+1), nikdy rovnice (5+2=15 zachováno). Realistické řádky 5+1=6, 12+7=19, 2,5+1,5=4, 3·4=12, x+3=8 prochází se 100% úspěšností (realistic.test.ts). Glitch-free zpoždění popoverů při aktivním psaní (1200ms pen-up okno, max 5 voleb). |
| 0.7 | Úspěšnost čtení se měří a zapisuje do dokumentace (číslice, operátory, celé řádky); pod stanovenou hranicí se nic netvrdí | ✅ `accuracy.test.ts` měří MNIST, pendigits, neviděné fonty i celé řádky; čísla a limity jsou v [reportu](docs/handwriting-e2e-report.md) a README |

---

## 7. Hlas a papír tabule (zpráva z 2026-11-06 večer)

| # | Požadavek | Stav |
|---|---|---|
| 7.1 | Vzory papíru tabule: čistý, kostičkovaný, linkovaný, tečkovaný, školní s okrajem; sledují posun a zoom | ✅ (výběr v Nastavení) |
| 7.2 | Úvodní karta zadání se nesmí překrývat s menu plátna | ✅ karta se skryje při otevřeném menu |
| 7.3 | Víc a lepších hlasů: online hlasy prohlížeče (např. Microsoft Natural v Edge) jako volitelná možnost s upozorněním na odesílání textu do cloudu | ✅ |
| 7.4 | Kvalitní open-source hlasy v prohlížeči (Piper přes @diffusionstudio/vits-web, česká `cs_CZ-jirka` a anglické hlasy), stahování modelu jednou s varováním o velikosti, licence hlasů ověřit a uvést v NOTICE.md | ✅ skupina „Kvalitní hlasy (Piper, offline)“: `cs_CZ-jirka`, `en_US-lessac`, `en_US-amy`, `en_GB-alba`; stažení jednou (≈60 MB) do OPFS s průběhem a zrušením, pak offline přehrávání ve workeru + Web Audio, záloha na systémový hlas; licence v NOTICE.md |
| 7.5 | Průchod celým UI/UX znovu a poctivé označení nedodělků (dřívější „hotovo“ neplatí tam, kde to uživatel vidí jinak) | 🟡 průběžně |

---

## 8. Odezva, rozhovor a živost (zpráva z 2026-11-06 večer)

Zpětná vazba: „kontrola pořád nereaguje a když jo, tak mu to strašně trvá; chatování s tutorem mi dost chybí; chybí animace.“ Čísla: [`docs/latency-report.md`](docs/latency-report.md).

| # | Požadavek | Stav |
|---|---|---|
| 8.1 | Lokální kontrola řádku je vidět do ~400 ms po dopsání (dřív 1,1 s) | ✅ `tests/latency.spec.ts`: psaný řádek Escape → značka ~18 ms, → komentář ~233 ms. Ručně psaný řádek: reakce maskota po zvednutí pera ~4 ms; komentář ~450 ms po pen-up (pauza) je pokrytá unit testem, celý řetězec pero → verdikt čeká na napojení čtení rukopisu do tabule (🟡) |
| 8.2 | Nekomentovat rozepsaný řádek: pero dole ani druhý tah v pauze řádek neukončí | ✅ `activity.test.ts`, `App.live.test.tsx` (komentář až ~450 ms po zvednutí pera, ne dřív) |
| 8.3 | Okamžitá vizuální odezva: maskot se „dívá“ už při psaní a po zvednutí pera kontroluje; značka ✓/✗ ihned po verdiktu | ✅ e2e `mentor-animation.spec.ts`, `latency.spec.ts` |
| 8.4 | Žádné zbytečné blokování; kontrola ve Web Workeru, pokud je těžká | ✅ otevřený textový editor už neblokuje explicitní dotaz ani příjem odpovědi AI (`App.live.test.tsx`); Web Worker vědomě ne: kontrola 20 řádků trvá ~0,15 ms |
| 8.5 | AI požadavek: stav hned, „zrušit“, rozumné limity | ✅ „přemýšlím“ ~5 ms, tlačítko Zrušit v bublině i v rozhovoru, „pořád přemýšlím“ po 12 s, limit 90 s |
| 8.6 | AI požadavek: průběžný text, pokud poskytovatel streamuje | ❌ nejde: všichni poskytovatelé vrací jeden ověřený JSON, SSE endpoint z BRIDGE_API.md nemá serverovou stranu |
| 8.7 | Měření (Playwright) do reportu, lokálně < 800 ms | ✅ `tests/latency.spec.ts` přepisuje měřenou tabulku v `docs/latency-report.md` |
| 8.8 | Rozhovor s tutorem: vlákno s historií, ukládané per tabuli | ✅ `tests/chat.spec.ts` (přežije reload, nová tabule má prázdné vlákno) |
| 8.9 | Odpovědi bez psaní: rychlé odpovědi podle kontextu („Vysvětli jinak“, „Ukaž další krok“, „Chápu“, „Nechápu“, „Příklad“, …) | ✅ `chat.test.ts`, `chat.spec.ts` |
| 8.10 | Mikrofon push-to-talk, přepis → zpráva | 🟡 e2e s náhradní `SpeechRecognition`; skutečný mikrofon a rozpoznávání prohlížeče se netestovaly |
| 8.11 | Volitelné pole „Napsat zprávu“, ne vždy viditelné; odpověď rukou do tabule není nutná | ✅ pole je sbalené, dokud ho student nerozbalí |
| 8.12 | Dotazy jdou AI (`mode: 'ask'`) s krátkým kontextem konverzace, learnerContext a materiály; odpověď bublina + případný zápis na tabuli | ✅ kontrakt `conversation` (bridge validace a prompt testy, e2e s mock bridge); zápis na tabuli jde stávající vrstvou učitele, pro `ask` bez vlastního testu |
| 8.13 | Lokální FAQ bez AI (✓/✗, režimy, mazání řádku, psaní, kalkulačka, hlas, posun, plán, export) | ✅ `chat.test.ts` |
| 8.14 | Bez připojené AI to appka řekne a nabídne místní pomoc | ✅ `chat.spec.ts` |
| 8.15 | Okno rozhovoru nepřekrývá víc než nutné: sbalitelné, dvě velikosti, ustupuje zásuvkám a nabídce, HUD kolizní pravidla zachována | ✅ e2e (desktop i telefon). Přetahování okna ❌: je ukotvené vpravo dole u maskota |
| 8.16 | Maskot má stavy: čeká, sleduje psaní (oči a tužka za posledním tahem), přemýšlí (tečky), raduje se (skok, konfety), mračí se, ukazuje na řádek, mluví, mává | ✅ `live.test.tsx`, `mentor-animation.spec.ts` |
| 8.17 | Plynulá chůze k řádku | 🟡 délka přechodu podle vzdálenosti (520–700 ms), kroky při chůzi, ukazování na místě; plynulost se měří jen jako „mnoho malých kroků“, ne očima |
| 8.18 | Mikro-animace: značka se „namaluje“, procenta se plynule přepočítají, přechody panelů, bublina se „napíše“ | ✅ značky a bublina e2e; procenta `live.test.tsx` (hook), panely jen CSS |
| 8.19 | Respektuje `prefers-reduced-motion` | ✅ e2e: žádná animace u maskota, značek ani rozhovoru |
| 8.20 | Známý nedostatek | 🟡 bublina učitele, který dojde k řádku, může zakrýt značku ✓/✗ sousedního řádku (značky nejsou mezi překážkami trasy) |

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
| 1.10 | Konec řádku se pozná podle pauzy (dřív pevný debounce 1,1–2,2 s): psaný řádek ~220 ms po Escape, ručně psaný ~450 ms po zvednutí pera; manuální tlačítka (Zkontrolovat/Poradit/…) | ✅ viz sekce 8 |
| 1.11 | AI píše/kreslí přímo na tabuli (ne jen chat bublina) | ✅ |
| 1.12 | Najde **první** příčinnou chybu, ne každý další řádek | ✅ |
| 1.13 | Odstupňované nápovědy, ne rovnou celé řešení | ✅ prompt přepsán: u Zkontrolovat/Poradit jen nápověda a naváděcí otázka, celé řešení až na "Ukaž další krok" nebo výslovnou žádost |
| 1.14 | Hlas (speechSynthesis, cs-CZ) | ✅ |
| 1.15 | MVP matematický rozsah (aritmetika, zlomky, procenta, závorky, lineární rovnice) | ✅ |
| 1.16 | Testy (unit/integration/e2e) | ✅ po sekci 8: shared 121, content 34, frontend 163, bridge 181 (+7 přeskočených živých CLI testů), e2e 48, lint a typecheck; verifier 161 naposledy ověřen dříve |
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
- Streamování textu odpovědi AI po slovech a přetahování okna rozhovoru (viz 8.6 a 8.15)
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


## Kolo 7 — čtení a kontrola rukopisu (2026-11-06)

Tato tabulka hodnotí konkrétní regresní scénáře, nikoli univerzální přesnost OCR.
Důkazy a zbývající limity: [handwriting e2e report](docs/handwriting-e2e-report.md#opravy-po-nezávislém-testu--kolo-7-2026-11-06).

| Bod | Stav po opravě logiky |
|---|---|
| D1 | ✅ Změna zadání zahodí staré expected/hodnocení; všech pět tvarů má unit + pen e2e po skutečném výběru kurzu. |
| D2 | ✅ Geometrie čárky (tečka / šikmý tah / háček); nejistý řádek nikdy nevytvoří aritmetickou opravu učitele; unit a mock-provider pen e2e. |
| D3 | ✅ Celá rovnost se třemi stojícími zlomky zůstává jediným řádkem; unit a pen e2e. |
| D4 | ✅ První symbolická rovnice je zadání bez známky; x=4 správně, x=5 špatně, implicitní násobení a holý kořen pokryty. |
| D5 | ✅ Viditelná nejistota, 44px cíle, pozice znaku v názvu kandidáta, top-3 + běžné záměny, bezpečná korektura; pen e2e se šumem 15 / výškou 70. Nejde o záruku zachycení každého omylu modelu. |
| D6 | 🟡 Hodnota/jednotka/operandy se vážou na expected z úlohy, nesouvisející výpočet nedostane ✓; kontext m/s zůstává nejistý. J přes rozpoznávač a kg přes parser testovány; plné čtení kg čeká na třídu k v paralelní práci s modelem. |
| D10 | ✅ Štítek propouští tahy, kandidáti jen u nejistých znaků; opravené párování dvojteček dvou těsných řádků; pen e2e s 18px mezerou pod řádkem. |
| D13 | ✅ Zbloudilé tečky/malé tahy mimo řádek ignorovány; jasné přeškrtnutí odstraní znak, nejasné vyžádá gumu, nejistota přežije opravu jiného znaku. |

Nezávislé recenze a regresní testy zahrnují i zachování nejistoty při replay
korektur, zákaz výsledku z `4/0`, závorky v kontrole operandů a běžný převod
minut na hodiny. Váhy a trénink se v této větvi neměnily. Stav „TOP“ ani
úplné dokončení 0.6/0.8/0.10 se netvrdí.

Ověření kódu `6ac284d`: lint a typecheck prošly; unit **571 prošlo / 7 živých CLI přeskočeno**; standardní Playwright **70/70** na vlastním portu 5320 s mockovaným/odpojeným bridge.
