# Zpráva z testování aplikace OpenMathTutor (Kolo 9)

**Datum testování:** 7. listopadu 2026  
**Testovací prostředí:** Headless Chromium (Playwright), rozlišení Desktop 1440×900, Tablet 1024×768, Mobil 390×844 (dotyk)  
**Adresa aplikace:** `http://localhost:5173` (lokální bridge `127.0.0.1:4178`)  
**Metodika:** Nezávislý UX test z pohledu neznalého studenta, skutečné simulované tahy myší/perem po bodech číslic a symbolů (včetně šumu a pauz dle inkFixture/inkDriver).

---

## 1. Kritické vady (Critical)
*Žádné kritické vady nebyly nalezeny.* Aplikace nepadá, nezpůsobuje ztrátu dat a základní běh tabule i rozpoznávání rukopisu fungují spolehlivě.

---

## 2. Vážné vady (Major)

### Vada M-1: Nefunkční přepínač jazyka na úvodní obrazovce Onboardingu (`D6-onboarding-lang-broken`)
- **Závažnost:** Major
- **Screenshot:** [01-onboarding-desktop.png](file:///C:/Users/Creator/Desktop/Math-tutor/docs/tester-round9/01-onboarding-desktop.png), [83-en-ui.png](file:///C:/Users/Creator/Desktop/Math-tutor/docs/tester-round9/83-en-ui.png)
- **Popis:** Na úvodní onboardingové obrazovce („Vítej v OpenMathTutor“) je v pravém horním rohu přepínač jazyka („Čeština“ / „English“). Kliknutí na volbu „English“ (ani zpět na „Čeština“) nijak nezmění jazyk rozhraní. Student, který nemluví česky, si tak nemůže při prvním spuštění přepnout aplikaci do angličtiny.
- **Kroky k reprodukci:**
  1. Otevřít aplikaci na čistém profilu (např. anonymní okno nebo po vymazání úložiště prohlížeče) na `http://localhost:5173`.
  2. Zobrazí se úvodní obrazovka Onboardingu.
  3. Vpravo nahoře kliknout na přepínač „English“.
  4. *Očekávaný výsledek:* Rozhraní se okamžitě přeloží do angličtiny („Welcome to OpenMathTutor…“).
  5. *Skutečný výsledek:* Rozhraní zůstává v češtině, stav přepínače se v aplikaci neprojeví.
- **Technická příčina:** V souboru `packages/frontend/src/App.tsx` (řádek 834) je komponenta `<Onboarding ... />` vykreslena bez předání callbacku `onLocaleChange={loc => configure({ locale: loc })}`.

---

### Vada M-2: Kolize spodní HUD lišty na telefonu 390×844 blokující ovládání plátna (`D5-phone-hud-overlap`)
- **Závažnost:** Major
- **Screenshot:** [30-phone-hud-overlap.png](file:///C:/Users/Creator/Desktop/Math-tutor/docs/tester-round9/30-phone-hud-overlap.png), [02-board-phone.png](file:///C:/Users/Creator/Desktop/Math-tutor/docs/tester-round9/02-board-phone.png)
- **Popis:** Na mobilním displeji (390×844) se spodní HUD lišta aplikace (`.rail` s tlačítky „Zápisky a pokrok“ a „Vlastní materiály“) vykresluje v oblasti `y ≈ 778–844 px` přímo přes spodní ovládací prvky kreslicího plátna Excalidraw (tlačítka *Edit*, *Zpět* a *Vpřed / Redo*). Uživatel na telefonu nemůže klepnout na tlačítko Redo ani spolehlivě ovládat editační režim plátna, protože všechny dotyky zachytí překrývající tlačítko HUD railu.
- **Kroky k reprodukci:**
  1. Spustit aplikaci ve viewportu 390×844 s dotykovým režimem (emulace mobilu).
  2. Přejít na tabuli (přeskočit onboarding nebo zvolit libovolný kurz).
  3. Pokusit se klepnout na tlačítko *Redo* (Vpřed) nebo *Edit* ve spodní liště plátna.
  4. *Očekávaný výsledek:* Tlačítko na plátně zareaguje na dotyk.
  5. *Skutečný výsledek:* Dotyk je zachycen tlačítkem HUD lišty („Zápisky a pokrok“), nástrojové tlačítko plátna nelze použít.
- **Doporučení:** Na displejích s šířkou pod 600 px spodní HUD lištu automaticky sbalit do plovoucího menu nebo umístit mimo oblast plátna.

---

## 3. Drobné vady (Minor)

### Vada m-1: Uříznutá nabídka drah a chybějící indikátor skrolování na mobilním onboardingu
- **Závažnost:** Minor
- **Screenshot:** [01-onboarding-phone.png](file:///C:/Users/Creator/Desktop/Math-tutor/docs/tester-round9/01-onboarding-phone.png)
- **Popis:** Na displeji 390×844 jsou karty výběru drah na onboardingu uříznuty ve spodní třetině obrazovky. Student zpočátku nevidí tlačítko „Přeskočit, chci jen volnou tabuli“, které je umístěno až pod spodním okrajem, a chybí vizuální indikátor (např. šipka či fade efekt) napovídající možnost scrollování.

---

## 4. Ověřené funkce a regresní testy (Kolo 9)

| Oblast testu | Výsledek | Screenshot | Poznámka |
| :--- | :---: | :---: | :--- |
| **Pauzy v psaní (0,5 s a 1,8 s)** | **V POŘÁDKU** | [40-pause-500ms.png](file:///C:/Users/Creator/Desktop/Math-tutor/docs/tester-round9/40-pause-500ms.png), [41-pause-1800ms.png](file:///C:/Users/Creator/Desktop/Math-tutor/docs/tester-round9/41-pause-1800ms.png) | Přirozené pauzy mezi číslicemi 0,4–2 s nevyvolávají falešné ✗. |
| **Odvolání ✗ při dalším tahu** | **V POŘÁDKU** | [42-revocation.png](file:///C:/Users/Creator/Desktop/Math-tutor/docs/tester-round9/42-revocation.png) | Červená chybová hláška se okamžitě odvolá při započetí nového tahu studenta. |
| **Neztrácení tahů (číslo 10)** | **V POŘÁDKU** | [43-dropped-stroke-test.png](file:///C:/Users/Creator/Desktop/Math-tutor/docs/tester-round9/43-dropped-stroke-test.png) | Nula ani navazující tahy po animacích se neztrácí, výpočet `5+5=10` je bezchybně zapsán. |
| **Desetinná čárka (2,5 + 1,5 = 4)** | **V POŘÁDKU** | [50-decimal-comma.png](file:///C:/Users/Creator/Desktop/Math-tutor/docs/tester-round9/50-decimal-comma.png) | Desetinná čárka je správně přečtena i spočtena. |
| **Dělení dvojtečkou (12 : 3 = 4)** | **V POŘÁDKU** | [51-div-colon.png](file:///C:/Users/Creator/Desktop/Math-tutor/docs/tester-round9/51-div-colon.png) | Dvojtečka je správně vyhodnocena jako operátor dělení. |
| **Dělení lomítkem (12 / 3 = 4)** | **V POŘÁDKU** | [53-div-slash.png](file:///C:/Users/Creator/Desktop/Math-tutor/docs/tester-round9/53-div-slash.png) | Lomítko `/` se již nezaměňuje za `l` nebo `1`. |
| **Násobení křížkem i tečkou (3 × 4 = 12, 3 · 4 = 12)** | **V POŘÁDKU** | [54-mul-cross.png](file:///C:/Users/Creator/Desktop/Math-tutor/docs/tester-round9/54-mul-cross.png), [55-mul-dot.png](file:///C:/Users/Creator/Desktop/Math-tutor/docs/tester-round9/55-mul-dot.png) | Oba symboly násobení fungují bezchybně. |
| **Svislé zlomky ((1)/(2) + (1)/(3) = (5)/(6))** | **V POŘÁDKU** | [57-standing-fraction.png](file:///C:/Users/Creator/Desktop/Math-tutor/docs/tester-round9/57-standing-fraction.png) | Svislý zápis zlomků s vodorovnou zlomkovou čarou je plně rozpoznán a validován. |
| **Deduplikace „Další příklad“ (Matematika)** | **V POŘÁDKU** | [71-dedup-math.png](file:///C:/Users/Creator/Desktop/Math-tutor/docs/tester-round9/71-dedup-math.png) | 5 z 5 stisknutí vygenerovalo unikátní úlohu bez opakování. |
| **Deduplikace „Další příklad“ (Fyzika)** | **V POŘÁDKU** | [72-dedup-physics.png](file:///C:/Users/Creator/Desktop/Math-tutor/docs/tester-round9/72-dedup-physics.png) | 5 z 5 stisknutí vygenerovalo unikátní úlohu bez opakování. |
| **Deduplikace „Další příklad“ (Chemie)** | **V POŘÁDKU** | [70-dedup-chem.png](file:///C:/Users/Creator/Desktop/Math-tutor/docs/tester-round9/70-dedup-chem.png) | 5 z 5 stisknutí vygenerovalo unikátní úlohu bez opakování. |
| **Nejisté čtení a legenda barev** | **V POŘÁDKU** | [60-uncertain-popover.png](file:///C:/Users/Creator/Desktop/Math-tutor/docs/tester-round9/60-uncertain-popover.png), [62-color-legend.png](file:///C:/Users/Creator/Desktop/Math-tutor/docs/tester-round9/62-color-legend.png) | Popover nabízí stránkování symbolů, vysvětlení čísla v rohu a přátelský tón bez obviňování studenta. |
| **Rozhovor s učitelem (Chat)** | **V POŘÁDKU** | [80-chat-open.png](file:///C:/Users/Creator/Desktop/Math-tutor/docs/tester-round9/80-chat-open.png), [81-chat-response.png](file:///C:/Users/Creator/Desktop/Math-tutor/docs/tester-round9/81-chat-response.png) | Chatovací okno se otevírá, umožňuje psaní dotazů i interakci s učitelem. |
| **Odpojené AI / offline bridge** | **V POŘÁDKU** | [82-ai-disconnected.png](file:///C:/Users/Creator/Desktop/Math-tutor/docs/tester-round9/82-ai-disconnected.png), [82b-settings-ai-guide.png](file:///C:/Users/Creator/Desktop/Math-tutor/docs/tester-round9/82b-settings-ai-guide.png) | Zobrazuje se zřetelný alert „Lokální bridge není dostupný…“ a v Nastavení je srozumitelný návod, jak AI připojit. |
| **Umístění zadání (obstacle-aware)** | **V POŘÁDKU** | [20-physics-statement.png](file:///C:/Users/Creator/Desktop/Math-tutor/docs/tester-round9/20-physics-statement.png), [30-chem1-statement.png](file:///C:/Users/Creator/Desktop/Math-tutor/docs/tester-round9/30-chem1-statement.png) | Text zadání se vyhýbá HUD prvkům a je plně čitelný. |
| **Vzory papíru a nastavení** | **V POŘÁDKU** | [04-settings-desktop.png](file:///C:/Users/Creator/Desktop/Math-tutor/docs/tester-round9/04-settings-desktop.png), [05-board-grid.png](file:///C:/Users/Creator/Desktop/Math-tutor/docs/tester-round9/05-board-grid.png) | Změna vzoru na čtverečkovaný papír a volba Piper hlasů fungují korektně. |

---

## 5. Shrnutí a verdikt
Aplikace OpenMathTutor v 9. kole vykazuje výbornou stabilitu lokálního rozpoznávání rukopisu, matematického aparátu (zlomky, desetinné čárky, všechny druhy násobení i dělení), časování kontrol i generování úloh.  
Nicméně z důvodu přítomnosti **2 vad kategorie Major** (nefunkční přepínač jazyka na úvodní obrazovce Onboardingu a kolize spodní HUD lišty na telefonech blokující tlačítka plátna) nemůže být verdikt TOP.

VERDIKT: NENÍ TOP
