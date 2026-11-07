# Tester kolo 8 – VERDIKT: NENÍ TOP (zkrácená zpráva, screenshoty ve stejné složce)

Jádro funguje: čtení čísel, ✓/✗, rovnice, zlomky, desetinná čárka, chat a AI učitel (rychlé, vřelé, kontext). Brání „TOP":

## Major
- **D1** Zadání napsané na tabuli není vidět: píše se drobně na ~(340–400, 80) PO kartou s kurzem/horní lištou, oříznuté (04-assignment-12s-desktop.png vs 04-assignment-hudhidden-desktop.png; 21-course4-first.png, 21-course7-first.png). Musí se napsat do volného viditelného místa tabule (mimo HUD) čitelně.
- **D2** Text slovních úloh se v kartě zadání (KaTeX) vykreslí jako matematika bez mezer: „*ujede44mza4s.Jakoumáprůměrnourychlost*“ (Fyzika, Chemie, VŠ analýza, lineární algebra) – 21-course4-first.png, 21-course7-first.png, 41-physics-plain.png. Slovní text sázet normálně, matematiku v $…$ jen pro výrazy.
- **D3** Předčasné ✗ uprostřed řádku a ztráta tahu při plynulém psaní. A) `12+7=1`, pauza 400 ms, `9`: mezitím červený ✗ a rozzlobený maskot, po dopsání ✓ (28-pause400-mid.png vs -end.png). Pauza 0,4–2 s mezi číslicemi je běžná → nesmí se hodnotit rozepsaný řádek. B) `5+5=10` s pauzami 30–60 ms, nula elipsou ~450 ms: 8/8 pokusů poslední „0“ chybí, čte se `5+5=1`, ✗ a teal poznámka `5+5=10` (27-lost-0.png); při pauze ≥100 ms před nulou OK → race podmínka: vyhodnocení částečného řádku dorazí během kreslení dalšího tahu a tah zahodí.
- **D4** Prozrazení řešení: A) při ✗ se hned napíše teal správná verze řádku: zadání (✎) `15-9=7` → `15-9=6`, `1+1=3` → `1+1=2`, `2+2=5` → `2+2=4` (16-menu-Poradit.png, 37-mode-end.png); u `12+7=18`, `x=5` se to nestalo (nekonzistentní). B) „Nápověda“ u jednokrokové úlohy (`12+7`, špatně `12+7=18`) hned napíše hotové `12+7=19` a AI až za 6–8 s říká „Kolik je 2+7?“ (09-hint-1500ms.png). U rovnice správně naváděcí.
- **D5** Telefon 390×844: karta kurzu a „AI je připojená“ leží přes horní lištu nástrojů (Selection/Draw/Eraser zakryté → guma nedosažitelná); Undo/Redo zakryté spodní lištou; zadání ořezané u pravého okraje (30-phone-start.png); popover nejistého čtení a bublina učitele se překrývají (30-phone-written.png); popover pod psaným řádkem zachytí další tah (označení textu místo kreslení).
- **D6** EN: zadání zůstávají česky (Fyzika, Chemie, Diskrétní, LA, Analýza, Statistika; 35-en-*.png); úvodní bublina „Pojďme na…“ česky i po přepnutí; onboarding bez přepínače jazyka.
- **D7** Lomítko `/` se čte jako `l`/`1` (`12/3=4` → `1213=4`/`12l3=4`, 4/4 „NEJISTÝ“; 07-div-slash-desktop.png). `:` funguje.
- **D8** Fyzika: správný holý výsledek (`6`, `V=19`, `130/10=13`) nedostane 3–11 s žádný verdikt (41-physics-plain.png); špatný dostane aspoň „Je to mezivýsledek…“.
- **D9** Falešné ✗ u nedbalého čitelného písma: `13+8=21` při šumu 6 px čteno `13+8=28` s ✗; šum 9 px `83^18=21` ✗ a kontextové čtení `6348121` + „Skoro…“ (46-contextual.png). ✗ na nesmyslném čtení s vysokou jistotou nesmí být; nesmyslný řádek (nevalidní výraz) → „nejisté čtení“.
- **D10** „Další příklad“: Chemie se točí jen mezi 2 zadáními (H₂O ↔ CO₂), Analýza/Diskrétní/Statistika opakují stejné zadání po 3–5 klicích; pool je malý.

## Minor
- m1 Maturita/Přijímačky VŠ: kvadratiky bez pěkných kořenů (`x²+5x+12=0` nemá reálný kořen, `4x²+7x=10` D=209) – generátor má dávat pěkné kořeny.
- m2 `98 m/7 s` čtení „98n7/7s…“.
- m3 Popover u hodně nejistého čtení = zeď 24 chipů (13-uncertain.png); malé číslo v rohu chipu není vysvětlené a poloha znaku se na tabuli nezvýrazní.
- m4 „Vzor a možnosti“ přetéká (3. karta oříznutá pod tlačítkem), zasahuje do patičky, technická věta „Vybraný model nepodporuje obrázky. Zvol jiný model…“ (14-pattern.png).
- m5 Legenda říká „Šedá ?“, UI ukazuje oranžový přerušovaný rámeček „NEJISTÝ“; vstup do legendy (16×16 px v rohu) částečně pod Undo/Redo (31-legend-corner.png).
- m6 ✗ badge a teal křížek „Smazat poznámku“ se překrývají (08-wrong-5000ms.png, 16-Vysvtlijinak-done.png); bublina při ✗ velká a opakuje celou legendu barev.
- m7 Panel nastavení vyšší než viewport (1272 px) – useknutý; návod pro vývojáře `$env:GEMINI_API_KEY=…` a „codex – omezená podpora“ v textu.
- m8 Test na doma: „…na poslední stránce. (36)“ nevysvětlené číslo.
- m9 Po zrušení chatu „Kontrola zastavena.“ (chat není kontrola).
- m10 Přeškrtnutí číslice se nepozná (čte se dál `12+7=18`).
- m11 `Zpět` na onboardingu 44×19 px; konzole: CSP chyby k fontům z esm.sh, „Permissions policy violation: unload“.
- m12 Nula `0` se u nedbalého písma často značí „NEJISTÝ“, × skoro vždy; student klepe na chipy i u čitelného zápisu.
- Piper hlasy v nastavení nenalezeny (jen systémové a online); ověř, že skupina „Kvalitní hlasy (Piper, offline)“ je viditelná a funkční.

## Opravy z kola 7 – stav
Opraveno: desetinná čárka, správný řádek u upraveného zadání, stojící zlomky, rovnice s x, klepnutí na kartu zadání napíše zadání znovu. Částečně/stále vadí: jednotky (D7/D8), bublina na telefonu (D5), prozrazení řešení (D4), pool zadání (D10), HUD překryvy (D1, D5, m5, m6).

Doporučené pořadí: D1, D3, D4 → D5, D2, D8 → ostatní.
