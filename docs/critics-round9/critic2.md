# Nezávislá kritická recenze projektu OpenMathTutor (Kritik 2 – Kolo 9)

**Datum:** 8. listopadu 2026  
**Revize / Větev:** `main`, commit `7149261` („Merge pause test“)  
**Testovací prostředí:** Windows 11, Node.js 20+, Chromium přes Playwright, vývojový server `http://127.0.0.1:5390`  
**Rozsah:** UX a layout na pěti viewportech, česká a anglická lokalizace, obsah a verifikace, testovací sady, licence a hygiena repozitáře. AI bridge na portu 4178 nebyl v době revize dostupný; jeho CORS whitelist cílí na port 5173, takže end-to-end ověření AI odpovědí nebylo možné. To nepovažuji za vadu aplikace, ale za omezení testovacího prostředí.

---

## 1. Shrnutí a celkové zhodnocení

Projekt má solidní základ. Lokální rozpoznávání rukopisu, česká notace, deduplikace příkladů, překlady, první chyba bez prozrazení řešení i samotné testovací sady působí promyšleně. Obsah je až na dvě formulační vady věcně správný a obě sady unit/integration testů procházejí.

Nejzávažnější problém je ale v layoutu krátkého landscape displeje **844 × 390 px**. V tomto režimu se bublina učitele překryje s oběma HUD sloupci a znepřístupní nastavení, obnovení připojení i úpravu zadání. Protože jde o blokaci běžných ovládacích prvků, nejde o kosmetický detail.

Další nálezy jsou méně závažné: poddimenzované dotykové cíle, chybějící lokální Excalidraw fonty, oříznutí karty na 360 × 740, zastaralá česká bublina po přepnutí do angličtiny, dvě nevyhodnocené aritmetické výrazy v zadáních, nepřenosné absolutní odkazy v dokumentaci, neuklizené pomocné větve a právní nejistota u committed MNIST fixture.

### Co funguje dobře

- **Layout na běžných viewportech:** 1440 × 900, 1024 × 768, 390 × 844 i 360 × 740 nemají měřený překryv karty, railu a bubliny. Karta úlohy je na 360 × 740 oříznutá jen o 23 px, viz samostatný nález.
- **Onboarding:** na 844 × 390 a 360 × 740 se karta nevejde do viewportu, ale overlay má `overflow: auto`; všechny kroky jsou dosažitelné. Nejde o blokující vadu.
- **Deduplikace:** v českém režimu jsem přes menu učitele prošel 13 příkladů za sebou a všech 13 bylo unikátních. Anglické „Next problem“ také vygenerovalo nové zadání.
- **Lokalizace obsahu:** všech 579 šablon má anglickou variantu a české texty neobsahují českou diakritiku v anglické větvi. Ve vzorku 40 šablon nebyly nevyplněné placeholdery, `NaN` ani nečíselné expected hodnoty.
- **Obsah:** namátkou jsem ověřil geometrii kruhu, Ohmův zákon, hustotu a tlak, výkon, rezistory, stoichiometrii a molární hmotnosti (18, 44, 98, 58,5, 40, 36,5, 100, 17, 16, 180, 56, 101). Odpovědi byly správné.
- **První chyba:** `packages/frontend/src/localTeacher.ts:27` prozradí řešení až při `attemptCount >= 2` nebo explicitním hintu. `App.tsx:680` předává počet pokusů. Chování je v pořádku.
- **Testy:** `npm run test:unit` prošel: shared 132, content 43, frontend 302, bridge 190 (+ 7 přeskočených live CLI testů). `npm run test:verifier` prošel: 161 testů. Ruční Playwright audit je nad rámec těchto sad.

---

## 2. Seznam konkrétních námitek

### [Major] 1. Bublina učitele v landscape 844 × 390 blokuje nastavení, reconnect i úpravu zadání

- **Soubory a řádky:** `packages/frontend/src/styles.css:248`, `:275`, `:312`, `:470`, `:473`, `:1310`, `:1312–1316`; `packages/frontend/src/TutorHud.tsx:117`; `packages/frontend/src/App.tsx:876–887`
- **Závažnost:** **Major**
- **Reprodukce:**
  1. Otevřít `http://127.0.0.1:5390/` s viewportem **844 × 390**.
  2. Dokončit onboarding, nechat vykreslit bublinu učitele a otevřít tabuli.
  3. Změřit `getBoundingClientRect()` pro `.task-card`, `.hud-top-right` a `.tutor-bubble`.
- **Naměřené hodnoty:**
  - `.task-card`: `x=72, y=149, width=694, height=75`
  - `.hud-top-right`: `x=572, y=72, width=260, height=150`
  - `.tutor-bubble`: `x=508, y=91, width=320, height=115`
  - překryv `taskCard × hudRight`: **14 162 px²**
  - překryv `hudLeft × hudRight`: **29 100 px²**
  - překryv `taskCard × tutorBubble`: **14 706 px²**
  - překryv `hudRight × tutorBubble`: **29 448 px²**
- **Dopad:**
  - Tlačítko nastavení má `x=788, y=72, 44 × 44`; bublina pokrývá jeho střed. `elementFromPoint(810, 94)` vrací bublinu, nikoli tlačítko.
  - Tlačítko „Zkusit připojení“ má `x=593, y=181, 100 × 32`; bublina pokrývá jeho střed.
  - Tužka pro úpravu zadání má `x=731, y=156, 28 × 28` a je pod bublinou celá.
  - Playwright klik na nastavení v tomto stavu vypršel po **3 s**. Bublina zůstává viditelná i po **8 s** a nemá vlastní zavírací tlačítko.
  - I po obejití překryvu má panel nastavení jen `320 × 150` px při `scrollHeight 1514 / clientHeight 148`, tedy přibližně deset vnitřních obrazovek.
- **Příčina:** `.hud-top-left` dostává na šířce 844 px šířku `calc(100vw - 150px)` (`styles.css:312`), zatímco `.hud-top-right` je posunutý na `top: 72px` (`styles.css:1310`) a bublina má šířku 320 px (`styles.css:275`). Pro pásmo `min-width: 701px` a `max-height: 500px` existuje pouze pravidlo pro Excalidraw nástroje (`styles.css:1312–1316`), žádné pravidlo pro kolizi bubliny s HUD.
- **Doporučená náprava:** přidat landscape breakpoint pro nízkou výšku, který bublinu přesune do spodního pásu nebo ji zmenší, a otestovat `elementFromPoint` pro nastavení, reconnect i editaci. Zároveň omezit šířku `.hud-top-left` tak, aby v 844 × 390 nezasahovala do pravého sloupce.

---

### [Minor] 2. Několik dotykových cílů je výrazně menší než 44 × 44 px

- **Soubory a řádky:** `packages/frontend/src/styles.css:113`, `:147`, `:270`, `:579`, `:615`, `:701–708`; `packages/frontend/src/App.tsx:843`
- **Závažnost:** **Minor**
- **Naměřené cíle:**
  - „Co znamenají barvy?“: **16 × 16 px** — nesplňuje ani minimální WCAG 2.5.8 (24 × 24 px).
  - „Upravit zadání“: **28 × 28 px**
  - zavření nastavení: **28 × 28 px**
  - smazání učitelské poznámky: **32 × 32 px**
  - „Změnit kurz“: **85 × 30 px**
  - „Zkusit připojení“: **100 × 32 px**
  - patičkový credit: **236 × 32 px**
- **Dopad:** na telefonu nebo trackpadu se tyto cíle ovládají výrazně hůře; u legendy jde o prokazatelné selhání minima 24 × 24 px. Nejde o blokaci, protože většina akcí má alternativní cestu, ale je to zbytečná překážka.
- **Doporučená náprava:** sjednotit minimální velikost na 44 × 44 px u primárních akcí a alespoň 24 × 24 px u pomocných; zvětšit klikací plochu bez zvětšení vizuální ikony.

---

### [Minor] 3. Většina Excalidraw fontů se načítá z `esm.sh` a CSP je blokuje

- **Soubory a řádky:** `packages/frontend/index.html:7`; `packages/frontend/src/main.tsx:8`; `packages/frontend/vite.config.ts` (plugin `serve-excalidraw-fonts`)
- **Závažnost:** **Minor**
- **Popis a reprodukce:**
  - Při otevření tabule se v konzoli objeví CSP chyby pro fonty typu `https://esm.sh/@excalidraw/excalidraw@0.18.1/dist/prod/fonts/...`.
  - V jednom běhu jsem zachytil **236 požadavků na fonty**: **230** mířilo na `esm.sh` a bylo zablokováno CSP; lokálních požadavků bylo **6** (1 přes `/excalidraw-assets/`, 5 přes `/@fs/`).
  - `main.tsx:8` nastavuje `EXCALIDRAW_ASSET_PATH = '/excalidraw-assets/'` a Vite plugin lokální fonty servíruje, takže záměr je správný; část Excalidraw fontů však používá absolutní CDN URL a lokální cesta se na ně nevztahuje.
- **Dopad:** textové prvky Excalidraw mohou používat fallback font místo zvoleného fontu, konzole je zaplavená chybami a „offline“ aplikace se zbytečně pokouší o síťové požadavky. Matematické psaní a české tahy fungují, proto hodnotím jako Minor.
- **Doporučená náprava:** namapovat všechny Excalidraw fonty na lokální `/excalidraw-assets/`, nebo absolutní CDN URL v balíčku nahradit lokálními; přidat test, který po otevření tabule nevidí žádnou CSP chybu na font.

---

### [Minor] 4. Na 360 × 740 je spodních 23 px karty úlohy oříznuto

- **Soubor a řádek:** `packages/frontend/src/styles.css:1317–1318`; související `:1283`
- **Závažnost:** **Minor**
- **Naměřené hodnoty:** `.hud-top-left` má na 360 × 740 `x=8, y=116, width=200, height=200`; `.task-card` má `y=264, height=75`, takže její spodní hrana je na 339 px, zatímco scrollovaný HUD končí na 316 px. Oříznutá je spodní část včetně popisku tématu.
- **Dopad:** žák na malém telefonu nevidí celý popisek tématu, dokud kartu nescrolluje. Obsah je dostupný, ale působí to jako nedokončený layout.
- **Doporučená náprava:** zmenšit `top` nebo `max-height` HUD kontejneru, případně zmenšit padding karty tak, aby se celá vešla do 200px pásma.

---

### [Minor] 5. Po přepnutí do angličtiny zůstává existující bublina česky

- **Soubor a řádek:** `packages/frontend/src/App.tsx:893–897`
- **Závažnost:** **Minor**
- **Reprodukce:** na 1440 × 900, 1024 × 768, 390 × 844 nebo 360 × 740 otevřít nastavení, přepnout jazyk na English a zavřít nastavení bez další akce.
- **Výsledek:** v českém znění zůstává text „Pojďme na: Počítání se zápornými čísly. Piš řešení rovnou na tabuli, já ti ho pohlídám.“ nebo jeho část. Kód při změně locale nahrazuje pouze `welcome` zprávu (`App.tsx:896`); ostatní typy zpráv zůstávají ve starém jazyce do další akce.
- **Dopad:** krátkodobě smíšená čeština a angličtina v UI. Patičkový text „Created by Jiří Pelikán“ je vlastní jméno, nikoli vada překladu.
- **Doporučená náprava:** při změně locale znovu vytvořit text aktuální zprávy podle jejího `id` a `kind`, nebo zprávu dočasně skrýt a znovu zobrazit v novém jazyce.

---

### [Minor] 6. Dvě zadání zobrazují nevyhodnocený součin místo čísla

- **Soubory a řádky:** `packages/content/src/extra.ts:996` a `:1007` (`pythagoras-7`); `packages/content/src/extra.ts:7318` a `:7325` (`ch-stoichiometry-7`)
- **Závažnost:** **Minor**
- **Popis:**
  - Kosočtverec: „Kosočtverec má úhlopříčky délek **2*5 cm** a **2*2 cm**…“ / „A rhombus has diagonals of lengths **2*5 cm** and **2*2 cm**…“.
  - Chemie: „…na reakci s **2*1 moly** vodíku?“ / „…react with **2*1 moles** of H2?“.
- **Dopad:** výsledná odpověď je správná, ale žák musí sám luštit, zda jde o násobení, nebo o textovou chybu. To je v matematickém zadání nežádoucí.
- **Doporučená náprava:** buď placeholdery předvyplnit skutečným součinem, nebo použít jeden parametr s hodnotou `2a`/`2b` a srozumitelný zápis (`2 · 5`, případně `2a` s definicí).

---

### [Minor] 7. Dokumentace testera používá nepřenosné absolutní odkazy

- **Soubor a řádky:** `docs/tester-round9/REPORT.md:19`, `:33`, `:49` a další; celkem **19** výskytů `file:///`
- **Závažnost:** **Minor**
- **Popis:** odkazy typu `file:///C:/Users/Creator/...` fungují jen na autorově počítači. Všechny odkazované screenshoty v `docs/tester-round9/` existují, takže nejde o chybějící artefakty, jen o nepřenosnost.
- **Doporučená náprava:** používat relativní odkazy `./01-onboarding-desktop.png` apod.

---

### [Minor] 8. Repozitář obsahuje velké množství pomocných T3 větví a jeden neuklizený skript

- **Zjištění:** `git log --all` obsahuje **235** commitů s autorem `T3 Code`; na `main` jich je **0**. Lokálně existuje **27** větví `t3/*` a **235** refs v `refs/t3/*`. `git status` dále ukazuje netrackovaný `_addi18n.py` v kořeni.
- **Závažnost:** **Minor**
- **Dopad:** riziko omylu při pushi nebo při výběru větve; pomocný skript může být omylem přidán do commitu. Na `main` ani na `origin/main` se tyto větve nenacházejí.
- **Doporučená náprava:** po záloze odstranit nepotřebné `refs/t3/*` a lokální `t3/*` větve; `_addi18n.py` buď odstranit, nebo přesunout mimo repo a přidat do `.gitignore`.

---

### [Minor] 9. Právní nejistota u committed MNIST fixtures a chybějící odkaz u pendigits

- **Soubory a řádky:** `NOTICE.md:14–15`; `packages/frontend/src/handwriting/__fixtures__/t10k-images-idx3-ubyte.gz` (1 648 877 B), `t10k-labels-idx1-ubyte.gz` (4 542 B), `pendigits.json`
- **Závažnost:** **Minor** (právní riziko, nikoli prokázané porušení)
- **Popis:** NOTICE u MNIST uvádí „No formal licence; commonly listed as CC BY-SA 3.0“, přesto je v repozitáři committed test split. U pendigits je uvedena licence CC BY 4.0, ale chybí přímý odkaz na licenční text a popis změn. Projekt je nekomerční, což riziko snižuje, ale neodstraňuje.
- **Doporučená náprava:** doložit oprávnění k redistribuci MNIST fixtures, nebo je nahradit vlastními/vygenerovanými daty; u pendigits doplnit odkaz na licenci a změny.

---

## 3. Ověření klíčových požadavků

| Požadavek | Stav | Poznámka |
|---|---|---|
| Layout na desktopu a na běžném telefonu | **SPLNĚNO** | 1440 × 900, 1024 × 768, 390 × 844 bez měřeného překryvu. |
| Layout na krátkém landscape telefonu | **NESPLNĚNO** | 844 × 390: Major překryv a blokace nastavení/reconnectu/editace. |
| Onboarding bez zaseknutí | **SPLNĚNO** | Karta se na 844 × 390 a 360 × 740 scrolluje; všechny kroky jsou dostupné. |
| Česká a anglická lokalizace obsahu | **SPLNĚNO** | 579 šablon má EN variantu, bez české diakritiky v EN větvi. |
| Přepnutí jazyka za běhu | **ČÁSTEČNĚ** | Stávající bublina zůstává v původním jazyce do další akce. |
| Deduplikace příkladů | **SPLNĚNO** | 13/13 unikátních v CS; EN „Next problem“ také nové. |
| První chyba bez prozrazení řešení | **SPLNĚNO** | `localTeacher.ts:27`, `App.tsx:680`; testy potvrzují. |
| Lokální rozpoznávání a kalibrace | **SPLNĚNO s rizikem** | MNIST 99,09 %, pendigits 96,51 %, ale stress test hlásí 7/360 silent errors (3,74 %). |
| Formátování zadání | **ČÁSTEČNĚ** | Dvě zadání zobrazují `2*{a}` bez vyhodnocení. |
| Přístupnost dotykových cílů | **NESPLNĚNO** | 16 × 16 legend a několik cílů pod 44 × 44. |
| Testy unit/integration | **SPLNĚNO** | shared 132, content 43, frontend 302, bridge 190; verifier 161. |
| Offline chování fontů | **ČÁSTEČNĚ** | 230 požadavků na `esm.sh` blokováno CSP; lokálně funguje jen Virgil. |
| Hygiena repozitáře | **ČÁSTEČNĚ** | 235 T3 refs, 27 t3 větví, netrackovaný `_addi18n.py`. |
| Licence a atribuce | **ČÁSTEČNĚ** | NOTICE je kvalitní, ale MNIST a pendigits mají právní nejistotu. |

---

## 4. Závěrečný verdikt

Projekt má dobrý funkční základ a většina didaktických i obsahových požadavků je splněna. Přesto v něm zůstává **jedna Major vada**, která v krátkém landscape režimu znepřístupňuje nastavení, reconnect a úpravu zadání, a řada Minor vad v přístupnosti, lokalizaci, formátování a hygieně.

Vzhledem k přítomnosti Major nálezu nelze udělit nejvyšší hodnocení.

**VERDIKT: NENÍ TOP**
