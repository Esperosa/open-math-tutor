# Prezentační média OpenMathTutor

Skutečné snímky a záznamy aplikace ze živé běžící instance, bez mocků AI u podporovaných akcí, bez vložených výsledků a bez úprav aplikačního kódu.

## Jak znovu vyrobit média

V kořeni projektu musí být nainstalované závislosti (`npm install`, `npm run build -w packages/shared`), Playwright Chromium (`npx playwright install chromium`) a dostupné programy `ffmpeg` a `ffprobe` na systémové PATH.
Služby: frontend běží na `http://localhost:5173`, bridge na `http://127.0.0.1:4178`. Poskytovatel `claude` (CLI) je přihlášen mimo aplikaci.

```sh
node docs/media/scripts/capture.mjs
node docs/media/scripts/verify.mjs
```

Jednotlivé scénáře lze přezaznamenat samostatně:

```sh
node docs/media/scripts/capture.mjs --only=01,02,04,05,06,07,08
node docs/media/scripts/capture.mjs --only=03 --ai-attempts=3
```

### Technické podmínky

- Sekvenční headless Playwright, nový **neperzistentní kontext pro každý scénář**.
  Bez existujících cookies, historie, lokálních úložišť, osobních profilů či fixture dat.
- Frontend se otevírá na `http://localhost:5173`: bridge tento původ výslovně povoluje.
- Záznam 1280 × 720, 25 fps, bez zvuku. MP4: H.264, CRF 28, yuv420p, faststart. WebM: VP9, CRF 36.
  Délka každého videa je v rozmezí 8–25 sekund. Ořezává se příprava před scénářem a čas po jeho dokončení; vydaná videa nemají umělé zrychlení.
- Psaní rukou využívá skutečné Hershey šablony tahů z `inkFixture` s lidským tempem a šumem, odesílané přes CDP pointer session (pointerType: 'pen').
- Stažené soubory se přebírají přes Playwright download událost, bez systémového dialogu a bez cest k uživatelskému adresáři.
- `verify.mjs` kontroluje velikost každého souboru pod 8 000 000 B, rozměry, délku 8–25 s, kodeky, absenci zvuku a provádí úplné dekódování všech videí. `verification.json` obsahuje přesné velikosti a SHA-256 všech souborů.

## Videa

Každý řádek představuje MP4 i odpovídající WebM (1280 × 720, 25 fps, bez zvuku, 8–25 s).

| Soubor | Co ukazuje | Jak se vyrobilo |
|---|---|---|
| [01-first-lesson.mp4](01-first-lesson.mp4) / [WebM](01-first-lesson.webm) | První spuštění: výběr zaměření a kurzu, uvítání maskota a animovaný zápis zadání příkladu na tabuli. | `capture.mjs --only=01` |
| [02-handwriting-check.mp4](02-handwriting-check.mp4) / [WebM](02-handwriting-check.webm) | Student píše rukou příklad s chybou, štítek „Přečetl jsem: 2x = 6“, značka ✗, příchod maskota, učitel zakroužkuje chybu a dopíše naváděcí otázku; student dopíše správnou opravu x = 2 → ✓. | `capture.mjs --only=02` |
| [03-ai-teacher-writes.mp4](03-ai-teacher-writes.mp4) / [WebM](03-ai-teacher-writes.webm) | Skutečný AI bridge s Claude (Sonnet): student napíše chybný krok rukou a zvolí v nabídce maskota „Poradit“, AI učitel zakroužkuje chybu a napíše přímo na tabuli naváděcí otázku. | `capture.mjs --only=03` |
| [04-chat.mp4](04-chat.mp4) / [WebM](04-chat.webm) | Rozhovor s tutorem: rychlé odpovědi (lokální FAQ bez AI pro běžné dotazy) + napsaná zpráva studenta se skutečnou odpovědí od Claude v konverzačním okně. | `capture.mjs --only=04` |
| [05-plan-progress.mp4](05-plan-progress.mp4) / [WebM](05-plan-progress.webm) | Průchod plánem: dvě vyřešené úlohy psané rukou, přepočet mastery dovedností a růst procent kurzu i tématu. | `capture.mjs --only=05` |
| [06-physics-units.mp4](06-physics-units.mp4) / [WebM](06-physics-units.webm) | Řešení fyzikální úlohy: zápis dráhy a času s jednotkami (m, s), výpočet rychlosti s jednotkou m/s a lokálně ověřený výsledek ✓. | `capture.mjs --only=06` |
| [07-test-and-export.mp4](07-test-and-export.mp4) / [WebM](07-test-and-export.webm) | Sestavení a stažení cvičného testu `test.html` (včetně klíče odpovědí), stažení zápisků (`zapisky.md`) a export tabule (`tabule.png`). | `capture.mjs --only=07` |
| [08-settings-paper-voices.mp4](08-settings-paper-voices.mp4) / [WebM](08-settings-paper-voices.webm) | Nastavení tabule: přepnutí všech 5 vzorů papíru (čistý, kostičky, linky, tečky, školní), tmavý režim, výběr hlasů a mobilní zobrazení (390 × 844). | `capture.mjs --only=08` |

## Snímky obrazovky

Desktopové PNG mají 1280 × 720; mobilní telefon má 390 × 844 při deviceScaleFactor 1.

| Soubor | Rozměry | Co ukazuje | Jak se vyrobilo |
|---|---|---|---|
| [shot-01-first-lesson.png](shot-01-first-lesson.png) | 1280 × 720 | První lekce po onboardingovém výběru kurzu: tabule se zadáním a uvítání maskota. | `capture.mjs --only=01` |
| [shot-02-handwriting.png](shot-02-handwriting.png) | 1280 × 720 | Rozpoznání rukopisu na tabuli se štítkem „Přečetl jsem: 2x = 6“. | `capture.mjs --only=02` |
| [shot-03-teacher-board.png](shot-03-teacher-board.png) | 1280 × 720 | Anotace učitele na tabuli: zakroužkovaná chyba červeným perem a naváděcí otázka tyrkysovým perem. | `capture.mjs --only=02` |
| [shot-04-chat-thread.png](shot-04-chat-thread.png) | 1280 × 720 | Otevřené okno rozhovoru s tutorem: historie konverzace, situační rychlé odpovědi, mikrofon a odpověď Claude. | `capture.mjs --only=04` |
| [shot-05-plan-progress.png](shot-05-plan-progress.png) | 1280 × 720 | Rozbalená zásuvka „Plán a cesta“ s přehledem témat, procentuálním pokrokem a rozpadem na dovednosti. | `capture.mjs --only=05` |
| [shot-06-physics-units.png](shot-06-physics-units.png) | 1280 × 720 | Fyzikální příklad na tabuli s jednotkami a zelenou značkou ✓ u správného výsledku. | `capture.mjs --only=06` |
| [shot-07-test-export.png](shot-07-test-export.png) | 1280 × 720 | Vygenerovaný cvičný test `test.html` připravený k tisku do PDF s klíčem správných odpovědí. | `capture.mjs --only=07` |
| [shot-08-settings-paper.png](shot-08-settings-paper.png) | 1280 × 720 | Panel nastavení s výběrem vzoru podkladu tabule, tmavým režimem a volbou hlasů. | `capture.mjs --only=08` |
| [01-onboarding.png](01-onboarding.png) | 1280 × 720 | Úvodní obrazovka a volba zaměření studenta. | `capture.mjs --only=01` |
| [02-courses.png](02-courses.png) | 1280 × 720 | Nabídka kurzů, vybrané téma a přehled dovedností. | `capture.mjs --only=01` |
| [03-lesson-light.png](03-lesson-light.png) | 1280 × 720 | Světlá tabule se zadáním a uvítáním maskota. | `capture.mjs --only=01` |
| [04-local-coach.png](04-local-coach.png) | 1280 × 720 | Lokální kontrola kroků na tabuli: ✗ a maskot u chyby. | `capture.mjs --only=02` |
| [06-plan.png](06-plan.png) | 1280 × 720 | Plán a cesta po vyřešení úloh. | `capture.mjs --only=05` |
| [07-physics.png](07-physics.png) | 1280 × 720 | Fyzikální příklad s jednotkou a ověřeným výsledkem. | `capture.mjs --only=06` |
| [08-tutor-menu.png](08-tutor-menu.png) | 1280 × 720 | Nabídka maskota s volbou doučovacích akcí a režimů. | `capture.mjs --only=03` |
| [09-board-dark.png](09-board-dark.png) | 1280 × 720 | Tmavá tabule se zadáním a mezikrokem. | `capture.mjs --only=08` |
| [10-phone-dark.png](10-phone-dark.png) | 390 × 844 | Zobrazení na mobilním telefonu v tmavém režimu (bez horizontálního přetečení). | `capture.mjs --only=08` |
| [11-phone-light.png](11-phone-light.png) | 390 × 844 | Zobrazení na mobilním telefonu ve světlém režimu. | `capture.mjs --only=08` |

## Exporty a skripty

| Soubor | Obsah | Jak vznikl |
|---|---|---|
| [exports/test.html](exports/test.html) | Skutečně stažený test, místo na postup a klíč odpovědí na samostatné stránce pro tisk do PDF. | `capture.mjs --only=07` |
| [exports/zapisky.md](exports/zapisky.md) | Stažené zápisky se zadáním a ověřeným krokem. | `capture.mjs --only=07` |
| [exports/tabule.png](exports/tabule.png) | Export obsahu tabule z aplikace. | `capture.mjs --only=07` |
| [scripts/capture.mjs](scripts/capture.mjs) | Záznamový skript pro Playwright s parametry `--only=NN` a `--ai-attempts=N`. | Opakovatelný skript. |
| [scripts/ink.mjs](scripts/ink.mjs) | Generátor tahů rukopisu z Hershey šablon pro nástroj pero (CDP pointer). | Opakovatelný skript. |
| [scripts/verify.mjs](scripts/verify.mjs) | Kontrola souborů, dekódování videí, velikostí, rozměrů a hashů. | Kontrolní skript. |
| [capture-report.json](capture-report.json) | Výsledky scénářů, trvání, naměřené časy AI odezvy a metadata. | `capture.mjs` |
| [verification.json](verification.json) | Přesný seznam všech médií s velikostmi, SHA-256 a parametry videí. | `verify.mjs` |
| [TODO-media.md](TODO-media.md) | Seznam prezentačních médií se stavem dokončení. | Dokumentace. |

## Co se nepovedlo a co se nepředstírá

1. **Scénář 03 (skutečný AI učitel píše na tabuli):** Bridge s poskytovatelem `claude` (Sonnet) na `http://127.0.0.1:4178` úspěšně zodpověděl požadavek s HTTP 200 za 6,68 s. Claude vrátil jak kroužek (`circle`) kolem chybného řádku, tak textovou nápovědu (`write_text`: *„Jakou operací zrušíš +3 na obou stranách?“*), která se v reálném čase vykreslila přímo na tabuli vedle chyby. Vše proběhlo bez mocků na první pokus.
2. **Scénář 04 (chat s tutorem):** Využívá kombinaci: rychlé odpovědi (situační dotaz *„Co znamená ✓ a ✗?“*) se zodpovídají okamžitě přes vestavěné lokální FAQ, zatímco volný dotaz studenta (*„Proč se mění znaménko?“*) odešel na skutečný Claude bridge a vrátil podrobné pedagogické vysvětlení za 6,04 s.
3. **Fyzikální jednotky (scénář 06):** Při psaní proměnné `v` jako kurzivního znaku rukopisný model vracel kandidáty nejistoty `l/`, což vyvolalo štítek s nabídkou oprav. Zápis byl upraven na přirozený fyzikální postup se zápisem zadaných veličin s jednotkami (`160 m`, `10 s`) a výpočtem (`160/10=16 m/s`), který lokální SymPy verifikátor i klasifikátor vyhodnotil jako správný bez jakékoli nejistoty (`solved`).
4. **Časování a délka:** Všech 8 videí má délku mezi 10,68 s a 18,68 s, splňuje limit 8–25 s, rozlišení 1280 × 720 při 25 fps, bez zvukové stopy, v kontejnerech MP4 (H.264) i WebM (VP9).
5. **Soukromí:** Žádný soubor neobsahuje osobní údaje, e-maily, API klíče ani cesty k uživatelským složkám.
