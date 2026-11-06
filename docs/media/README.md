# Prezentační média OpenMathTutor

Skutečné snímky aplikace, bez mocků AI, vložených výsledků nebo úprav zdrojového kódu aplikace.
Před zveřejněním prosím projděte finální videa a snímky lidskou kontrolou.
Pomocné skripty jsou také určené k lidskému code review.

## Jak znovu vyrobit média

V kořeni projektu musí být nainstalované závislosti (`npm install`), Playwright Chromium
(`npx playwright install chromium`) a dostupné `ffmpeg` + `ffprobe`.
Při tomto záznamu už byly oba programy nainstalované; nic se nedoinstalovávalo.
Služby spusťte podle hlavního README: frontend :5173, bridge :4178, verifier :4179.
Claude CLI musí být přihlášený mimo aplikaci. Nepouštějte souběžně e2e testy ani další záznam.

```sh
node docs/media/scripts/capture.mjs
node docs/media/scripts/verify.mjs
```

Jednotlivé scénáře lze přezaznamenat bez ostatních:

```sh
node docs/media/scripts/capture.mjs --only=01,02,04,05,06
node docs/media/scripts/capture.mjs --only=03 --ai-attempts=3
```

`--ai-attempts` přijímá 1–3 (výchozí 3). Chyba/timeout AI se zkusí znovu jen do tohoto
limitu. Platná odpověď bez psané nápovědy se označí `ai_no_written_hint` a scénář se vynechá.
Pro vlastní umístění programů použijte proměnné prostředí `FFMPEG` a `FFPROBE`.
Skript lze spustit z jiného pracovního adresáře; cesty řeší vůči sobě.

### Technické podmínky

- Sekvenční headless Playwright, nový **neperzistentní kontext pro každý scénář/pokus**.
  Bez existujících cookies, historie, úložišť, osobních profilů či aplikovaných fixture dat.
- Frontend se otevírá jako `http://localhost:5173`: bridge tento původ výslovně povoluje,
  zatímco původ `http://127.0.0.1:5173` odmítá. Jde o stejný lokální Vite server.
- Pomocné funkce `writeOnBoard`, `setTask` a práce s kurzy vycházejí z
  `packages/frontend/tests/replay.spec.ts` a `tutor.spec.ts`. **Síťové mocky testů se nepoužívají.**
- Text vzniká skutečným psaním do Excalidrawu: 105 ms mezi znaky, běžně 1,5 s pauza
  po dokončení řádku; volby a důležité výsledky mají další čitelné pauzy.
- Záznam 1280 × 720, 25 fps, bez zvuku. MP4: H.264, CRF 28, yuv420p, faststart.
  WebM: VP9, CRF 36. Ořezává se příprava před scénářem a čas po jeho konci;
  vydaná videa nemají zrychlení ani vystřižené čekání uvnitř scénáře.
- Stažené soubory se přebírají přes Playwright download událost, bez systémového dialogu
  nebo viditelné cesty k uživatelskému adresáři. Text UI a textové exporty se kontrolují
  na cesty, e-maily a rozpoznatelné tvary tokenů. Nevznikly žádné fotky osob ani nové logo.
- `verify.mjs` kontroluje velikost každého souboru pod 8 000 000 B, rozměry, délku 8–25 s,
  kodek, nepřítomnost zvukové stopy a úplné dekódování všech videí.
  `verification.json` obsahuje přesné velikosti a SHA-256 všech ostatních souborů.

## Videa

Každý řádek představuje MP4 i odpovídající WebM. Chybějící číslo 03 je záměrné, viz omezení níže.

| Soubor | Co ukazuje | Výroba |
|---|---|---|
| [01-first-lesson.mp4](01-first-lesson.mp4) / [WebM](01-first-lesson.webm) | První spuštění, výběr kurzu, přivítání maskota, otevření kurzů a spuštění konkrétní dovednosti. | `capture.mjs --only=01` |
| [02-local-coach.mp4](02-local-coach.mp4) / [WebM](02-local-coach.webm) | Postup rovnice přímo na tabuli: dva řádky ✓, chybný řádek ✗, návštěva maskota a krátká rada. Bez AI požadavku. | `capture.mjs --only=02` |
| [04-plan-progress.mp4](04-plan-progress.mp4) / [WebM](04-plan-progress.webm) | Dvě skutečně vyřešené úlohy. Kurz 0 → 1 → 1 %, téma 0 → 5 → 10 %. Zaokrouhlení celého kurzu po druhé úloze zůstane na 1 %. | `capture.mjs --only=04` |
| [05-physics-units.mp4](05-physics-units.mp4) / [WebM](05-physics-units.webm) | Rychlost auta: zápis dráhy a času, výpočet s jednotkou m/s a lokálně ověřený výsledek. | `capture.mjs --only=05` |
| [06-test-and-export.mp4](06-test-and-export.mp4) / [WebM](06-test-and-export.webm) | Sestavení a stažení `test.html`, potvrzení aplikace, zápisky a export Markdown/PNG. | `capture.mjs --only=06` |

## Screenshoty

Desktopové PNG mají 1280 × 720; telefon má 390 × 844 při deviceScaleFactor 1.

| Soubor | Co ukazuje | Výroba |
|---|---|---|
| [01-onboarding.png](01-onboarding.png) | Čisté první spuštění a volba zaměření. | `capture.mjs --only=01` |
| [02-courses.png](02-courses.png) | Kurzy, vybrané téma a nabídka dovedností. | `capture.mjs --only=01` |
| [03-lesson-light.png](03-lesson-light.png) | Světlá tabule se zadáním a úplným přivítáním maskota. | `capture.mjs --only=01` |
| [04-local-coach.png](04-local-coach.png) | Dvě ✓, jedna ✗ a maskot u chyby. | `capture.mjs --only=02` |
| [06-plan.png](06-plan.png) | Plán po dvou vyřešených úlohách. | `capture.mjs --only=04` |
| [07-physics.png](07-physics.png) | Fyzikální úloha s jednotkou a správným výsledkem. | `capture.mjs --only=05` |
| [08-tutor-menu.png](08-tutor-menu.png) | Nabídka maskota, režimy lokální kontroly a dostupné akce. | `capture.mjs --only=06` |
| [09-board-dark.png](09-board-dark.png) | Tmavá tabule se zadáním a správným mezikrokem. | `capture.mjs --only=06` |
| [10-phone-dark.png](10-phone-dark.png) | Telefon 390 × 844, tmavý režim. | `capture.mjs --only=06` |
| [11-phone-light.png](11-phone-light.png) | Stejný telefon ve světlém režimu. | `capture.mjs --only=06` |

## Exporty a skripty

| Soubor | Obsah | Jak vznikl |
|---|---|---|
| [exports/test.html](exports/test.html) | Skutečně stažený test, místo na postup a klíč odpovědí na samostatné tiskové stránce. Pro PDF otevřete v prohlížeči a zvolte tisk → uložit jako PDF. Soubor není vydáván za hotové PDF. | `capture.mjs --only=06` |
| [exports/zapisky.md](exports/zapisky.md) | Skutečně stažené zápisky se zadáním a správným řádkem. | `capture.mjs --only=06` |
| [exports/tabule.png](exports/tabule.png) | Export obsahu tabule z aplikace, nikoli další screenshot viewportu. | `capture.mjs --only=06` |
| [scripts/capture.mjs](scripts/capture.mjs) | Opakovatelný sekvenční scénář a převod přes ffmpeg. | Ručně připravený záznamový skript, ověřený spuštěním. |
| [scripts/verify.mjs](scripts/verify.mjs) | Kontrola souborů a generování velikostí, parametrů a hashů. | Ručně připravený kontrolní skript, ověřený spuštěním. |
| [capture-report.json](capture-report.json) | Výsledky scénářů, skutečná procenta a bezpečná metadata AI pokusů. Žádné hlavičky ani syrový CLI výstup. | `capture.mjs` |
| [verification.json](verification.json) | Přesný seznam souborů s velikostmi, SHA-256 a parametry videí. Neobsahuje vlastní hash. | `verify.mjs` |
| [README.md](README.md) | Tento katalog, postup a omezení. | Dokumentace k záznamům. |

## Co se nepovedlo a co se nepředstírá

**Scénář 03: psaná AI nápověda nebyla vydána.** Reálný bridge byl osloven přes nabídku
maskota s poskytovatelem `claude`, modelem `sonnet` a akcí „Poradit“.
Dvě dokončené odpovědi HTTP 200 trvaly přibližně 7,75 s a 6,50 s: první obsahovala jen
`circle`, druhá žádnou akci na tabuli. První technický záznam navíc přerušila chyba
záznamového skriptu po odeslání požadavku; po její opravě byly provedeny už jen dva další
pokusy. Celkem tedy nejvýše tři odeslané AI požadavky, žádný mock.

Aktuální `packages/bridge/src/providers/prompt.ts` ve `RESPONSE_SCHEMA` povoluje pouze
`underline`, `circle`, `highlight` a systémový prompt zakazuje odhadovat souřadnice bez
znalosti viewportu. Nápověda **napsaná přímo na tabuli** proto v tomto stavu není podporovaná.
Video s pouhou bublinou by nesplňovalo zadání; pod názvem `03-real-ai-hint` se tedy nic nevydává.

Při přípravě bylo opraveno také chybějící zvolení kurzu v zásuvce, příliš přísná kontrola
zaokrouhlených procent a kompozice bubliny přes předchozí řádky. Finální výstupy jsou z
opakovaných úspěšných běhů, nikoli z těchto nezdařených záznamů. Zdrojový kód aplikace
se kvůli médiím neměnil. E2e testy se při nahrávání nespouštěly. Žádný commit ani push.

## Kontrola kvality

Finálních deset screenshotů a šest časových vzorků z každého z pěti videí bylo vizuálně
prohlédnuto. Bylo zkontrolováno čitelné dopsání bublin, viditelnost značek ✓/✗ a vystředění
obsahu na telefonu skutečným tlačítkem aplikace. Mobilní stránka neměla horizontální přetečení.
Všech deset videosouborů prošlo úplným dekódováním ve ffmpeg.

Automatická kontrola `ailook.py docs/media --json` nahlásila „AI v nadpisu“ na prvním řádku
tohoto katalogu. Jde o falešný nález parseru, který spojil nadpis s následujícím odstavcem;
skutečný nadpis je „Prezentační média OpenMathTutor“. Nejde o potvrzení úplného UI/a11y auditu
aplikace; tato práce kontroluje věrnost a použitelnost záznamů.
