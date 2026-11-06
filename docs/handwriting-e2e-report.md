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
