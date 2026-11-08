# Nezávislá kritická recenze projektu OpenMathTutor (Kritik 1 – Kolo 9)

**Datum:** 7. listopadu 2026  
**Revize / Větev:** `main` (commit `8bbce6d`)  
**Testovací prostředí:** Windows 11, Node.js v20+, Python 3.12+, Playwright port 5380

---

## 1. Shrnutí a celkové zhodnocení

Tato revize hodnotí naplnění klíčových cílů projektu dle specifikace v `REQUIREMENTS.md` (sekce 0 a 7) a `PLAN2.md`:
1. Lokální rozpoznávání rukopisu a česká matematická notace (`:`, `÷`, `/`, `·`, `×`, `*`, desetinná čárka `,`, závorky, indexy).
2. Poctivá kalibrace, gating nejistoty bez obviňování uživatele.
3. Kontextová predikce, která zásadně nepoužívá matematickou pravdivost jako prior.
4. Ochrana před hodnocením rozepsaného / nedokončeného řádku.
5. Učitelské zásahy a anotace na tabuli (kroužkování, škrtání, šipky, psaní).
6. Informování o stavu AI („AI není připojená a jak ji připojit“).
7. Věrnost testů se skutečnými tahy.

### Klíčová zjištění
- **Kladné stránky:** Architektonické principy pro gating nejistoty, zákaz matematické pravdivosti v kontextovém prioru (`packages/frontend/src/handwriting/context.ts`), odklad evaluace během psaní (`PEN_PAUSE_MS = 2400` a `PEN_QUICK_MS = 450`) a učitelské nástroje fungují dle specifikace.
- **Závažné problémy:**
  1. `npm run test:unit` selhává na timeoutu v `catalog-probe.test.ts`, navíc obsahuje pád na chybějících znacích v `templates.json` a neshoduje se s tvrzením v `ACCURACY.md`.
  2. Commit `caaee50` způsobil regresi v mobilním rozvržení CSS (`.hud-top-left, .hud-top-right { top: 116px; }`), což rozbilo 3 existující Playwright testy (`phone-layout.spec.ts`, `audit6.spec.ts`, `tutor.spec.ts`).
  3. `npm run test:verifier` selhává na Windows v `test_security.py` kvůli překročení Win32 limitu délky proměnné prostředí (32 767 znaků) v pytestu.

---

## 2. Seznam konkrétních námitek

### [Major] 1. Selhání `npm run test:unit` – timeout a neošetřené znaky v `catalog-probe.test.ts`
- **Soubor a řádek:** `packages/frontend/src/handwriting/catalog-probe.test.ts:28`
- **Závažnost:** **Major**
- **Popis a reprodukce:**
  Spuštěním `npm run test:unit` test selže na výchozím Vitest timeoutu 5000 ms:
  ```
  FAIL packages/frontend/src/handwriting/catalog-probe.test.ts > catalog probe > probe every auto-check skill through the real recognizer
  Error: Test timed out in 5000ms.
  ```
  Test iteruje přes 212 testovacích vzorků ze všech dovedností katalogu a provádí inferenci neuronové sítě bez navýšeného timeoutu testu (trvá ~5180 ms).
  Zároveň test odhalil dvě faktické vady:
  1. **Neošetřená výjimka pro text s diakritikou / neznámé znaky:**
     Pro úlohu `proportion` (`12 dní`) dochází k neošetřenému pádu:
     `TypeError: Cannot read properties of undefined (reading 'strokes')`, protože v šablonách `templates.json` chybí písmena `d`, `n`, `í`.
  2. **Chyby v rozpoznávání:**
     - `arithmetic-integers`: očekáváno `-5*(3+4)=-35`, rozpoznáno `-5*(34)=-35` (vypadlo znaménko `+`).
     - `proportion`: očekáváno `60 Kc`, rozpoznáno `6oKc` (zaměněna nula za malé písmeno o).
     - `pythagoras`: očekáváno `80 m^2`, rozpoznáno `8om^2`.
     - `fy-electric-power`: očekáváno `1380 W`, rozpoznáno `13804`.
- **Rozpor s dokumentací:**
  V `tools/handwriting/ACCURACY.md` je v tabulce tvrzeno:
  `| Catalog text checks, 23 skills (not UI uncertainty gating) | 69 / 69 | 100.00 % | 100.00 % | >= 90 % | pass |`.
  Ve skutečnosti test v kódu testuje 212 případů s úspěšností 208/212 (98.11 %) a pádovými stavy.

---

### [Major] 2. Regrese mobilního layoutu z commitu `caaee50` rozbíjející Playwright testy
- **Soubor a řádek:** `packages/frontend/src/styles.css:1283`
- **Závažnost:** **Major**
- **Popis a reprodukce:**
  V commitu `caaee50` byla přidána úprava pro mobilní zobrazení:
  ```css
  @media (max-width: 700px) {
    .hud-top-left, .hud-top-right {
      top: 116px;
    }
  }
  ```
  Posunutí HUD prvků dolů z původní pozice mělo uvolnit prostor pro ovládací prvky kreslení, ale způsobilo dominový efekt a rozbilo 3 integrační testy:
  1. `packages/frontend/tests/phone-layout.spec.ts:48`:
     Očekává `expect(hudRightBox!.y).toBeLessThan(100)`, ale reálná hodnota je nyní `116`.
  2. `packages/frontend/tests/audit6.spec.ts:32`:
     Protože `.hud-top-right` byl posunut na `top: 116px`, rozbalené okno nastavení (`.settings-pop`) je tlačeno příliš nízko a přetéká spodní okraj obrazovky na mobilních rozlišeních 390×844 i 360×640 (`expect(r.bottom <= innerHeight).toBe(true)` selže s `bottom: 864px` při výšce 844px).
  3. `packages/frontend/tests/tutor.spec.ts:86`:
     V mobilním zobrazení s redukovaným pohybem koliduje box mentora s patičkou (`expect(clearsFooter).toBe(true)` selže, protože `teacher.bottom <= footer.top` neplatí).

---

### [Major] 3. Selhání `npm run test:verifier` na Windows OS
- **Soubor a řádek:** `verifier/tests/test_security.py` (`test_malformed_and_oversized_json`)
- **Závažnost:** **Major**
- **Popis a reprodukce:**
  Při spuštění integračních testů Python verifikátoru na Windows:
  ```powershell
  npm run test:verifier
  ```
  Testovací běh končí se 2 chybami:
  ```
  ERROR tests/test_security.py::test_malformed_and_oversized_json[...] - ValueError: the environment variable is longer than 32767 characters
  ```
  Příčina: Pytest na Windows vkládá hodnoty testovacích parametrů do proměnné prostředí `PYTEST_CURRENT_TEST`. Test předává 40KB payload přímo jako parametr, což překračuje pevný limit Win32 API pro délku proměnných prostředí (32 767 znaků) a způsobí selhání v `os.putenv`.
  Projekt deklaruje multiplatformnost a v `REQUIREMENTS.md` uvádí 161 testů bez zmínky o selhání na Windows.

---

### [Minor] 4. Zavádějící obsah sekce „Pokročilé: jak připojit AI“ v nastavení
- **Soubor a řádek:** `packages/frontend/src/App.tsx:929-933`
- **Závažnost:** **Minor**
- **Popis:**
  V rozbalovacím panelu `<details className="settings-advanced-details">` s nadpisem `t.settingsAdvanced` („Pokročilé: jak připojit AI“) je namísto instrukcí k připojení AI modelu vyrenderován obsah `{t.controlsHelp}`:
  *„Posun: kolečko, mezerník + tah nebo šipky. Zoom: Ctrl + kolečko nebo + / −. Podržení na tabuli otevře nabídku...“*.
  Uživatel hledající návod, jak rozběhnout lokální AI (např. Ollama / LM Studio nebo verifier bridge), dostane pouze instrukce k posunu a zoomování tabule. Návod k AI je dostupný v odkazované dokumentaci, ale přímo v UI je zavádějící text.

---

### [Minor] 5. Nekonzistence popisu velikosti sady testů v `tools/handwriting/ACCURACY.md`
- **Soubor a řádek:** `tools/handwriting/ACCURACY.md:83`
- **Závažnost:** **Minor**
- **Popis:**
  Dokumentace tvrdí, že `Catalog text checks` pokrývá 69 testů pro 23 dovedností (poměr 3 testy na skill). Ve zdrojovém kódu `catalog-probe.test.ts` je však generováno 212 testů. Dokumentace nebyla zaktualizována po rozšíření testovací sady o reálné tahy.

---

## 3. Ověření klíčových požadavků (Requirements Checklist)

| Požadavek | Stav | Poznámka |
|---|---|---|
| **Lokální čtení rukopisu** | **SPLNĚNO** | Model běží v prohlížeči přes ONNX Runtime Web / tfjs, 58 tříd, podpora pro české symboly `:`, `÷`, `/`, `·`, `×`, `*`, čárku `,` i závorky. |
| **Kontextová predikce bez prioru pravdivosti** | **SPLNĚNO** | Ověřeno v `packages/frontend/src/handwriting/context.ts` (řádek 43: kontroluje se pouze syntaktická platnost operátorů, nikdy matematický výsledek rovnosti; např. `5+2=15` zůstává `15`). |
| **Nehodnocení rozepsaného řádku** | **SPLNĚNO** | Ověřeno v `packages/frontend/src/activity.ts` (`PEN_PAUSE_MS = 2400`, `PEN_QUICK_MS = 450`, při `penDown` se evaluace pozastavuje). |
| **Poctivé hlášení nejistoty** | **SPLNĚNO** | Komponenta `UncertaintyGuides.tsx` používá empatii a neobviňuje žáka (*„Nejsem si jistý, jak jsem to přečetl...“*). |
| **Učitelské zásahy na tabuli** | **SPLNĚNO** | Ověřeno v `teacher.spec.ts` – učitel kreslí červeně/tyrkysově, kroužkuje, škrtá a vpisuje texty fontem Virgil. |
| **Zpráva o nepřipojené AI** | **SPLNĚNO ČÁSTEČNĚ** | V HUD se správně zobrazuje stav offline AI a tlačítko, ale vnitřní nápověda v dialogu nastavení obsahuje text ovládání tabule namísto návodu k AI. |
| **Testy se skutečnými tahy** | **SPLNĚNO** | E2E i unit testy načítají a přehrávají skutečné zachycené tahy žáků z fixtures / katalogu. |

---

## 4. Závěrečný verdikt

Projekt má velmi solidní matematicko-technický základ a věrně plní stěžejní didaktické principy (lokální inference, žádné falšování výsledků matematickým priorem, gating nejistoty, podpora české notace). 

V projektu se však nacházejí **3 závažné nedostatky (Major)**:
1. `npm run test:unit` selhává kvůli timeoutu a chybějícím znakům v `catalog-probe.test.ts`.
2. Regrese mobilního rozvržení v `styles.css` způsobená nedávným commitem `caaee50`, která rozbíjí 3 Playwright testy (`phone-layout.spec.ts`, `audit6.spec.ts`, `tutor.spec.ts`).
3. Selhání testovací sady verifikátoru na Windows OS kvůli 32KB limitu v pytestu.

Z důvodu přítomnosti výše uvedených Major vad nemůže být uděleno nejvyšší hodnocení.

**VERDIKT: NENÍ TOP**
