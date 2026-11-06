# PLAN 2 — z nástroje na mentora

Cíl: student jen píše na tabuli. Appka sama sleduje, kontroluje, vede a komentuje jako
reálný doučující, pamatuje si studenta a ukazuje cestu s procenty. Fáze se dělají v pořadí
a každá končí testy, živým ověřením a commitem. Konec: smyčka nezávislých agentů.

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
- Mikrofon: push-to-talk přes Web Speech API (cs/en), přepis jde do "Zeptej se". Lokální
  Whisper je vědomě mimo (stahování modelu); mikrofon se skryje, když prohlížeč řeč nezná.

## D. Paměť o studentovi a styl vysvětlování
- `profile.ts` (localStorage): chyby podle typu a dovednosti, historie dnů, úspěšnost stylů
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
