# PLAN 2 — z nástroje na mentora

Cíl: student jen píše na tabuli. Appka sama sleduje, kontroluje, vede a komentuje jako
reálný doučující, pamatuje si studenta a ukazuje cestu s procenty. Fáze se dělají v pořadí
a každá končí testy, živým ověřením a commitem. Konec: smyčka nezávislých agentů.

## 0. NEJVYŠŠÍ PRIORITA: čtení rukopisu z tabule (viz REQUIREMENTS.md sekce 0)
- Lokální model nad tahy Excalidraw (freedraw): seskupení do řádků, rozdělení na symboly, malá síť (MNIST + syntetické operátory), skladba do výrazu (zlomky, mocniny), kandidáti a oprava klepnutím.
- Řádek z rukopisu se stane krokem jako psaný text; stav „AI nepřipojena“ a návod k připojení; AI s obrazem jen doplněk.
- Měřená testovací matice místo domněnek; úspěšnost se publikuje v README.

## A. Tabule jako jediné vstupní místo, HUD bez překryvů
- Žádná textová pole: zmizí dolní lišta s řádkem klávesnicí a akčními tlačítky; zadání je
  karta jen ke čtení (úprava přes tužku). U volné tabule je zadáním první napsaný řádek.
- Výchozí nástroj je psaní textu přímo na tabuli (klik a psát); ruční kresba a guma zůstávají.
- Maskot je jediný ovládací prvek: klik otevře jeho nabídku (režim, akce, hlas, mikrofon).
- Pravidla rozložení: každý panel má vlastní kout, pravé horní ikony nepřekrývají Excalidraw
  (knihovna skrytá), kalkulačka a nastavení se navzájem zavírají, bublina maskota nad ním.

## B. Autonomní trenér (lokální, bez AI kde to jde)
- Režimy: Průběžně (kontrola každého řádku po ustálení), Až na konec (kontrola, když student
  napíše výsledek), Vypnuto. Přepínač v nabídce maskota, uložený v nastavení.
- `coach.ts`: čistá logika, která z řádků, očekávané odpovědi a režimu rozhodne o události
  (špatný řádek, správný výsledek, špatný výsledek, nejasné) a o krátké vřelé větě (cs/en).
- Očekávaná odpověď se počítá programově (výraz, lineární rovnice, `answerTemplate` u úloh
  z fyziky a chemie). Řádky, které lokálně nejdou posoudit, se předají AI jen pokud je zapnutá.
- Mastery se mění automaticky podle prvního posouzení hotové úlohy; správný výsledek nabídne
  další příklad.

## C. Maskot mluví
- Řeč přes speechSynthesis (výchozí zapnuto), animace pusy při mluvení, bublina s krátkým textem.
- Živý vlastní SVG/CSS učitel: mrkání, jemné dýchání a houpání, občasné mávnutí a pohled;
  radostný poskok, ustarané obočí a tečky při přemýšlení. Při postupném psaní komentáře se hýbe tužka.
- Komentář nese ID konkrétního řádku (i uvnitř víceřádkového textu). `Board.stepViewportRect`
  čte živé souřadnice Excalidrawu včetně posunu a zoomu, nikdy nemění studentskou scénu.
- `tutorPosition.ts` + `useTutorVisit.ts`: overlay přes CSS transform dojde vedle řádku a po
  cca 3–9 s se vrátí. Cíl i trasa z aktuální polohy musí minout HUD a Excalidraw ovládání
  a vejít se do viewportu. Neznámý, smazaný, otočený či neviditelný řádek / nedostatek místa
  znamená bublinu v rohu. Změna viewportu nebo nová překážka návštěvu bezpečně ukončí.
- Mimo roh je celý učitel průchozí pro pointer a jeho akce jsou zakázané až do dokončení návratu.
  V rohu zůstávají původní nabídka a akce, dlouhou odpověď lze rozbalit a posouvat.
- Bublina má neprůsvitný podklad, rukopisný text a typewriter s rezervovanou výškou;
  čtečka dostane celou větu jednou. `prefers-reduced-motion` vypíná pohyb i postupné odhalování.
- Lokální přivítání je viditelné po přeskočení onboardingu i při startu lekce, bez volání AI;
  čas zobrazení neběží pod onboardingem či otevřeným panelem. Nová tabule ruší starý komentář.
- Ověření: unit testy typování a kolizí, e2e návštěva/návrat, click-through, neměnná revize,
  pan mimo řádek, nové cvičení, přivítání a reduced-motion na telefonu.
  Celý frontend: 69 unit a 25 e2e testů prošlo; lint a produkční build také (jen upozornění na velikost chunků).
- Mikrofon: push-to-talk přes Web Speech API (cs/en), přepis jde do "Zeptej se". Lokální
  Whisper je vědomě mimo (stahování modelu); mikrofon se skryje, když prohlížeč řeč nezná.

## D. Paměť o studentovi a styl vysvětlování
- `learnerProfile.ts` + `profileStorage.ts` (localStorage): chyby podle typu a dovednosti, historie dnů, úspěšnost stylů
  vysvětlení (nápověda, vzorový příklad, analogie, obrázek).
- Výběr stylu: skóre úspěšnosti s malou průzkumnou složkou; výsledek se zapíše podle toho, zda
  další řádek po vysvětlení vyšel. Student se na nic neptá.
- Souhrn profilu jde AI jako `learnerContext` (nový, ověřený parametr kontraktu).

## E. Plán a procenta
- Zásuvka "Plán": cesta kurzem (témata, dovednosti, kde jsem, co mě čeká), procenta za
  dovednost i kurz z mastery, horní lišta ukazuje procenta; mění se s každou vyřešenou úlohou.

## F. Testy a materiály
- Z tématu nebo kurzu vznikne test (programově z katalogu) a stáhne se jako PDF/tisk s volným
  místem a klíčem správných odpovědí na zvláštní stránce. Vyfocení a nahrání řešení zpět jde
  jen s modelem, který umí obrázky; appka to říká na rovinu.

## G. Fyzika a chemie
- Nové kurzy: Fyzika (mechanika, elektřina), Chemie (látkové množství, roztoky). Číselné úlohy
  mají programově spočtenou odpověď (včetně jednotky), takže se kontrolují bez AI. Dovednosti
  s kresbou (schéma obvodu, síly, vzorec) jsou označené: kresby zatím AI nevidí.

## H. Ověření
- Nezávislý tester prochází appku jako uživatel i programově proti tomuto plánu; opravuje se,
  dokud neřekne "top". Pak dva kritici; námitky opravuje jeden agent; commit a push po každém
  kole. Na konci push a appka zůstane spuštěná.
