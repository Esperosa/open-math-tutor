# Rukopis na tabuli — implementace, měření a e2e důkazy

Stav: 2026-11-06. Tento dokument shrnuje, co je hotové, co je změřené a kde
jsou vědomé mezery. Čísla nejsou odhady; pocházejí z testů v repozitáři.

## Co se změnilo

Ručně psané tahy z Excalidraw (`freedraw`) se čtou **lokálně v prohlížeči**.
Bez sítě, bez AI a bez nové runtime závislosti.

1. `packages/frontend/src/handwriting/` seskupí tahy do řádků, rozdělí je na
   symboly, spustí malou síť (MNIST + syntetické operátory) a složí výraz
   včetně zlomků a mocnin.
2. Rozpoznaný řádek se stane běžným krokem (`origin: 'ink'`) a projde stejnou
   lokální kontrolou jako psaný text: ✓/✗, trenér, mastery i procenta.
3. Řádek má viditelný přepis („Přečetl jsem: …“), kandidáty pro nejisté
   symboly a opravu jedním klepnutím. Oprava přepočítá jen změněný řádek,
   zachová jeho `stepId` a znovu vyhodnotí `parserCompatible`.
4. Nejistý rukopis jde do AI jako strukturované hinty (`handwriting`): přepis,
   kandidáti, pořadí tahů, jistota a ohraničení. Hinty jsou neověřená data,
   nikdy instrukce. Volitelný `imageCrop` nese jen změněnou oblast.
5. Když AI není připojená, HUD to řekne (`data-testid="ai-status"`), ale
   lokální čtení i kontrola fungují dál.

## Měřená úspěšnost

Všechny hodnoty jsou z `packages/frontend/src/handwriting/accuracy.test.ts`.
Spuštění:

```powershell
npm run build -w packages/shared
cd packages/frontend
npx vitest run src/handwriting/accuracy.test.ts --reporter=verbose
```

| Sada | Výsledek | Podíl |
| --- | ---: | ---: |
| Oficiální held-out MNIST (10 000 obrázků) | 9 899 / 10 000 | **98,99 %** |
| Syntetické šumové tahy, číslice + operátory | 1 434 / 1 440 | **99,58 %** |
| Syntetické šumové tahy, všechny třídy | 4 036 / 4 080 | **98,92 %** |
| UCI pendigits, pisatele mimo trénink | 3 413 / 3 498 | **97,57 %** |
| Hershey rodiny neviděné v tréninku | 1 105 / 1 200 | **92,08 %** |
| Celé řádky (různá měřítka, posun, zkosení, zoom) | 270 / 270 | **100 %** |
| Symboly v těchto řádcích | 1 470 / 1 470 | **100 %** |
| Celé řádky s held-out číslicemi | 182 / 200 | **91 %** |

Rychlost čtení typického řádku (15 symbolů, 40 běhů se studenou cache):
medián přibližně **20–22 ms**, p95 přibližně **25–26 ms**, maximum pod 28 ms
napříč běhy. To je hluboko pod hranicí 50 ms, kterou hlídá test.

### Známé záměny

- `x` → `×` (38 případů) a naopak; `x` jako proměnná je nejslabší místo.
- `/` → `1` a `×` → `x` v některých syntetických variantách.
- V neviděných fontech `4` → `7` a `8` → `2`.
- Varianta desetinné tečky byla ve 0/50 případech přečtena jako středová
  tečka; čárka i běžná tečka fungují.
- `x` z Hershey varianty „variable-x“: 21/50.

Tyto záměny jsou důvod, proč zůstává požadavek 0.8 ve stavu 🟡. UI je řeší
kandidáty a opravou klepnutím; netvrdíme, že rozpoznávání je bezchybné.

## E2E matice

Skutečné tahy se v Playwrightu kreslí přes vstupní vrstvu prohlížeče. Fixtury
jsou Hershey tahy načtené z `tools/handwriting/` v `tests/inkFixture.ts`.

| Scénář | Test | Stav |
| --- | --- | --- |
| Myš, volná tabule, špatný výsledek | `tests/ink.spec.ts` „freehand writing…“ | ✅ |
| Myš, správný výsledek | „a correct handwritten calculation…“ | ✅ |
| Pero, 200% zoom, posunutá tabule | „pen input is read at 200% zoom…“ | ✅ |
| Výchozí nástroj text + klávesnice | „typing still works…“ | ✅ |
| Telefon 390×844, dotyk | „touch input is read on a phone-sized board“ | ✅ |
| Bridge nedostupný | všechny ink testy abortují `127.0.0.1:4178`; HUD `offline` | ✅ |
| Pomalé/rychlé psaní | stejná fixtura s `delay = 0` a `delay = 3 ms` | ✅ částečně |
| 50% zoom | — | ❌ chybí |
| Světlý/tmavý motiv | — | ❌ chybí |
| `localhost` vs `127.0.0.1` | e2e běží na jednom originu, bridge je mockovaný | ❌ chybí |
| AI dostupná + hinty z rukopisu | unit testy bridge (validace, prompt), ne živé AI e2e | 🟡 |

Matice tedy není uzavřená. Požadavek 0.6 zůstává 🟡, dokud výše uvedené
chybějící řádky nebudou mít test.

## Ověřovací příkazy

```powershell
npm run lint
npm run typecheck
npm run test:unit
cd packages/frontend
npx playwright test
```

Poslední běhy před sepsáním tohoto dokumentu:

- lint: prošel ve všech balíčcích,
- typecheck: prošel (shared, content, frontend, bridge, electron),
- unit: 461 prošlo, 7 přeskočeno (shared 121, content 34, frontend 119,
  bridge 187; živé bridge testy bez přihlášení se přeskakují),
- e2e: 38/38 prošlo.

## Vědomé limity

- Rozpoznávání je malý lokální model, ne univerzální OCR. Kresby, grafy a
  volný text mimo matematický zápis se nečtou.
- AI zatím nemůže přijmout obrázek (`multimodal_unsupported` u obou
  providerů), takže „AI s obrazem“ je připravená cesta, ne hotová funkce.
  Strukturované hinty bez obrázku fungují.
- Oprava klepnutím pokrývá kandidáty symbolů; složitější přepis zlomku nebo
  mocniny se řeší opravou řádku, ne editací jednotlivého symbolu.
- Tmavý motiv a 50% zoom nejsou pro ink vrstvu e2e pokryté.

## Verdikt

Požadavky 0.1, 0.2, 0.3, 0.4, 0.7 a 0.9 mají implementaci i důkaz. Požadavky
0.5, 0.6, 0.8, 0.10 a 0.11 zůstávají 🟡 s konkrétními mezerami výše. Nic
z toho není označené jako hotové jen proto, že to „vypadá dobře“.


## Opravy po nezávislém testu — kolo 7 (2026-11-06)

Výchozí commit: `faf4292`. Screenshoty testera nebyly v této worktree;
prohlédnuty v hlavním checkoutu ve složce `docs/tester-round7/`
(zadání, desetinné čárky, zlomky/rovnice, šum, kandidáti, fyzika, škrtnutí).
Váhy, `model.ts` ani `tools/handwriting/train.py` se v této práci neměnily.

### Příčiny a důkazy

- **D1:** `editTask` ponechával původní `expected` z vygenerované úlohy.
  Změna zadání nyní odvodí novou odpověď, zahodí výsledek a potvrzení staré
  úlohy a neuděluje mastery původní dovednosti za vlastní zadání. Bezpečný
  parser podporuje i aritmetické zadání s výsledkem, prázdným `=` a známým
  povelem „Vypočítej“. Pět e2e scénářů opravdu vybere kurz, upraví zadání
  přes tužku a píše perem `12+7=19` / `5+2=7`.
- **D2:** malá spodní čárka mezi plnohodnotnými číslicemi se posuzuje
  geometricky, nikoli jen klasifikací zvětšeného izolovaného symbolu.
  Tečka, šikmý tah i háček jsou pokryté skutečnými tahy. Přepis do racionálu
  `(25/10)+(15/10)=4` není oprava studentovy aritmetiky.
  `localTeacherActions` i hranice `applyResponse` blokují aritmetické opravy
  a hodnocení nejistého inkoustu, včetně neukotvené akce providera. Explicitní
  nezávislá chatová vysvětlení bez akcí a bez hodnocení mohou zůstat dostupná.
- **D3:** zlomková čára se už nezahazuje jako podtržení čitatele ani
  neslepuje se serifem číslice. Úplná rovnost se třemi stojícími zlomky
  vytvoří jeden řádek `(1)/(2)+(1)/(3)=(5)/(6)`.
- **D4:** symbolická první řádka volné tabule je zadání bez značky. Následná
  `x=4` i samotná `4` se kontrolují proti původní rovnici, ne proti
  případnému předchozímu chybnému pokusu. `x=5` je chyba. `2x` se normalizuje
  na `2*x`, nikoli na číselné násobení. `y=4` není potvrzením řešení pro x.
- **D5:** nejistota jednotlivého symbolu se neztratí v průměrné jistotě
  celého řádku. Štítek obsahuje „NEJISTÝ — Zkontroluj, jestli jsem to přečetl
  správně“. Kandidáti mají nejméně 44 × 44 CSS px, přístupný název s pozicí
  znaku, modelové top-3 a běžné záměny 1/7, 4/9, x/× a čárka/tečka. Neplatný klíč
  nebo nepodporovaný kandidát je no-op; klepnutí nesmí změnit čitelnou
  syntaxi na nečitelnou. Dvojice širokých tahů nabízí i `=` mimo modelové
  top-3; e2e tím opravdu opraví zašuměné `424` na `4=4` a získá ✓.
  Explicitní potvrzení člověka nemění surové
  pravděpodobnosti modelu. E2e používá výšku 70 a šum 15; jde o novou
  reprodukovatelnou fixturu, nikoli přesné tahy ze screenshotu `4^14`.
- **D6:** značky a kouč sdílejí `judgeLines`. Samotné pravdivé `72/12=6`
  není správnou odpovědí na 77 m za 7 s. Požaduje se očekávaná hodnota i
  jednotka; rozepsaný výpočet nesmí obsahovat nesouvisející operandy ani
  obejít kontrolu závorkami. Jednotkové převody času/délky mají explicitní
  faktory odvozené ze zadání; samotné `60+60` není převodem úlohy 20 km / 10 min.
  Kontextové návrhy `*n1/2` → `m/s` ponechávají nejistotu a nemohou samy
  vytvořit ✓. `J` má test s rozpoznávačem, `kg` test kompozice parseru.
- **D10:** štítek má `pointer-events: none`, nemění rozvržení plátna;
  interaktivní jsou pouze kandidáti nejistých symbolů. Další nalezená
  příčina: tranzitivní shlukování spojovalo tečky dvojteček dvou blízkých
  řádků. Párují se nyní vzájemně nejbližší tečky. Unit i pen e2e zachovají
  obě celé `12:4=3` s mezerou přibližně 18 px pod předchozí spodní linií.
- **D13:** osamocená tečka nebo tah do 6 scénových px mimo skutečný řádek
  se nečte jako číslice. Velké jednoznačné přeškrtnutí ignoruje původní
  znak; krátké nejednoznačné přeškrtnutí zachová nejistotu a kouč poradí
  „použij gumu“. Potvrzení jiného symbolu tuto nejistotu nesmí odstranit.

Testy přidávají reprodukci před opravou. Nezávislá recenze navíc odhalila
ztrátu nejistoty po korektuře a při opakovaném čtení, odmítnutí běžného
převodu a holého kořene i nebezpečný fallback `4/0` → `4`; všechny mají
regresní test. Chybné dělení se už nehodnotí podle prvního čísla. Poslední
nezávislá recenze ověřila i typografické operátory ÷/×/·, živý/finalní
režim a potvrzení výsledku: bez blokující připomínky v kontrolované změně.

Hlavní nové důkazy: `handwriting/round7.test.ts`, `boardState.test.ts`,
`localTeacher.test.ts`, shared `judgement.test.ts` a pen replay
`tests/ink-round7.spec.ts` (vše bez nahrazování vstupu rozpoznaným textem).

### Rozsah a zbývající limity

- **D6 není celé uzavřené:** stávající model nemá třídu `k`. Kompozice a
  kontext jednotek jsou připravené, ale spolehlivé end-to-end čtení `kg`
  závisí na paralelní práci na třídách/váhách. Tato větev ji nepředstírá.
- Kontextová oprava jednotky je návrh, ne potvrzená odpověď. Nejasný suffix
  je třeba přepsat či opravit; celoslovné potvrzovací tlačítko zde není.
- Kontrola operandů slovní úlohy je konzervativní, nikoli plný důkaz fyziky:
  složité odvozené mezivýsledky a další převody mohou zůstat neověřené.
- Ze screenshotu nelze zpětně získat přesné tahy ani garantovat detekci
  každého chybně, ale sebejistě přečteného symbolu. Rozšířená přesnost modelu
  a nezávislý lidský retest zůstávají nutné. Verdikt „TOP“ se zde neuděluje.
- Starší mezery testovací matice (50% zoom, kompletní motivy/originy a živé
  multimodální AI) zůstávají otevřené.

### Finální ověření této větve

Ověřeno po kódovém commitu `6ac284d`:

- `npm run lint`: prošel (shared, content, frontend, bridge a electron).
- `npm run typecheck`: prošel.
- `npm run test:unit`: **571 prošlo**, **7 přeskočeno** — shared 131,
  content 34, frontend 217, bridge 189; přeskočeny pouze živé CLI testy.
- `cd packages/frontend && npx playwright test`: **70/70 prošlo**, včetně
  17 nových scénářů kola 7 a původních ink/teacher/latency/chat/replay testů.
  Běžná konfigurace neobsahuje samostatnou PWA sadu.
- Žádný test přesnosti nebyl odstraněn ani snížen jeho práh.
- Snímky `test-results/round7-uncertain.png` a `round7-close-rows.png`
  byly také prohlédnuty; jsou reprodukovatelné spuštěním pen e2e.

E2e používá vlastní Vite na portu **5320** a abortovaný/mockovaný bridge;
porty 5173, 4178 a 4179 se pro služby této práce nepoužívaly. Jediná změna
starého e2e kontraktu: výchozí `main` commit `faf4292` úmyslně otevírá
chatový vstup, zatímco test ještě očekával jeho nepřítomnost. Test nyní
vyžaduje fokus v poli; aplikace ani její záměr nebyly kvůli testu vráceny zpět.
Výstup `npm install` oznámil 24 zranitelností závislostí; jejich aktualizace
nebyla součástí této opravy a žádná nová závislost nepřibyla.
