<p align="center"><a href="https://jirkapelikan.cz"><img src="docs/brand/pelikan-logo.png" alt="Logo Jiřího Pelikána" width="96"></a></p>

# OpenMathTutor

*English version: [README.en.md](README.en.md)*

> Vytvořil a autorsky vlastní **[Jiří Pelikán](https://jirkapelikan.cz)**. Zdrojově dostupný projekt pro **nekomerční** užití ([PolyForm Noncommercial 1.0.0](LICENSE)); při sdílení nebo úpravě musí zůstat uvedeno autorství. Podrobnosti v sekci [Práva a licence](#práva-a-licence).

Interaktivní matematický doučovatel s digitální tabulí. Žák píše postup
rukou (prst/pero/myš), aplikace rozpozná jednotlivé kroky, najde **první**
chybu v postupu, vysvětlí ji česky textem i hlasem a **sama napíše
nápovědu přímo na tabuli** — ne jen do chatové bubliny.

Pracovní název projektu, zdrojově dostupný, nekomerční licence.

## Bring your own subscription

Aplikace nevyžaduje, neprodává ani nepřeposílá žádné API klíče. Připojíte
svůj **vlastní** už přihlášený AI nástroj:

- OpenAI Codex CLI (`codex login`), nebo
- Anthropic Claude Code CLI (`claude auth login`)

Aplikace tyto nástroje pouze spouští jako podprocesy v jejich oficiálně
podporovaném režimu — nikdy nečte, neukládá ani nepřeposílá jejich
přihlašovací údaje. Podrobnosti a citace z právních podmínek obou poskytovatelů
jsou v [ARCHITECTURE.md](ARCHITECTURE.md).

## Tři hlavní stavební kameny

- [Excalidraw](https://github.com/excalidraw/excalidraw) (MIT) — tabule
- [SymPy](https://www.sympy.org/) (BSD-3-Clause) — ověřování matematických kroků
- [KaTeX](https://katex.org/) (MIT) — zobrazení matematického zápisu

## Instalace a vývoj

```bash
npm install
npm run dev:frontend     # frontend na http://localhost:5173
npm run dev:bridge       # lokální bridge (provider adaptéry)

cd verifier
python -m venv .venv
.venv/Scripts/pip install -r requirements.txt   # Windows; na macOS/Linux .venv/bin/pip
.venv/Scripts/python -m uvicorn app:app --port 4179
```

Ověření přihlášení providerů probíhá mimo tuto appku:

```bash
codex login
# nebo
claude auth login
```

Google (Gemini): vlastni API klic z Google AI Studio (volne casti) nebo Vertexu - nastav `GEMINI_API_KEY` / `GOOGLE_API_KEY`.

Aplikace nikdy neukládá výstup těchto příkazů ani tokeny, které vytvoří.

## Testy

```bash
npm run lint
npm run typecheck
npm run test:unit
npm run test:verifier
npm run test:e2e
```

## Co je hotové a co ne (stav k poslední aktualizaci tohoto README)

Tento projekt je rozsáhlý; řiďte se také konkrétním stavem v
`ARCHITECTURE.md` a hláškami `requires credentials` / "nedostupné" přímo v
UI pro cokoliv, co vyžaduje vaše vlastní přihlášení.

- **Hotovo a reálně otestováno**: bezpečný matematický AST parser
  (`packages/shared/src/mathAst.ts`) a jeho Python port ve verifikátoru,
  validace `board_actions` (schéma, meze, revize), frontend s Excalidraw
  tabulí, lokální bridge s adaptéry Codex/Claude, 10 předpřipravených kurzů (matematika, vysokoškolské předměty, fyzika, chemie)
  s původními úlohami (`packages/content`), adaptivní obtížnost per
  dovednost (`packages/shared/src/mastery.ts`), volný dotaz ("Zeptej se"),
  interaktivní vykreslování funkcí (`plot_function`, bezpečný numerický
  evaluátor bez `eval`), vlastní kurz z nahraných `.txt`/`.pdf` materiálů
  (lokální TF-IDF vyhledávání, žádné embeddings, žádné API volání navíc) —
  vše s automatickými testy (shared, content, frontend, bridge, verifier)
  a CI.
- **Rukopis na tabuli čte lokální model**: tahy myší, perem i prstem se
  v prohlížeči seskupí do řádků a symbolů, přepíšou na výraz a projdou
  stejnou kontrolou jako psaný text. Nejisté symboly mají kandidáty a opravu
  jedním klepnutím; AI dostane strukturované hinty, ne jen obrázek. Měřená
  úspěšnost a e2e matice jsou v
  [`docs/handwriting-e2e-report.md`](docs/handwriting-e2e-report.md).
- **Reálně odzkoušeno na živém Claude Max předplatném v této session**:
  textové doučování (Zkontrolovat/Poradit/Další krok/Vysvětli
  jinak/Zeptej se) přes `claude -p` bez `--bare`, se zachovaným
  přihlášením předplatným.
- **Vědomě nedostupné, ne předstírané**: Codex nemá v CLI zjištěný
  dokumentovaný způsob, jak mu úplně zakázat shell/filesystem nástroje —
  dokud takový způsob neexistuje, appka pro Codex tutoring hlásí
  `provider_unavailable`, místo aby mu nástroje "jen" sandboxovala a
  předstírala bezpečnost. Claude neumí v neinteraktivním režimu přečíst
  obrázek (žádný dokumentovaný flag) — nahrání skenu/fota proto zatím
  vždy vrátí `multimodal_unsupported` od obou providerů; UI je připravené
  a rozsvítí se automaticky, jakmile některý provider tuto cestu doloží.
- **Vědomě mimo tuto fázi**: Android/Capacitor obálka, iOS build, režim
  "Sign in with ChatGPT", skutečná animace psaní perem tah po tahu (místo postupného odhalení)
- Geometrie, kvadratické rovnice a vyšší matematika jsou v katalogu jako dovednosti, ale bez automatické kontroly kroků (SymPy verifikátor zatím zná jen aritmetiku, zlomky, procenta a lineární rovnice); výsledky číselných úloh se kontrolují programově.
  (verifikátor zatím podporuje jen aritmetiku, zlomky, procenta, závorky
  a lineární rovnice).

## Práva a licence

**Autor:** Jiří Pelikán, <https://jirkapelikan.cz>. Copyright © 2026 Jiří Pelikán. Všechna práva, která tato licence výslovně neuděluje, jsou vyhrazena.

**Licence kódu a textů:** [PolyForm Noncommercial License 1.0.0](LICENSE). Zjednodušeně (závazný je pouze text licence):

- **Smíte:** používat, studovat, kopírovat a upravovat projekt pro **nekomerční** účely: osobní učení, výuka, výzkum, hobby, školy, neziskové organizace a veřejné instituce.
- **Nesmíte:** použít projekt nebo jeho části **komerčně**: prodávat ho, nabízet jako placenou službu, zabudovat do placeného produktu, používat pro výdělečnou firmu nebo ho jinak monetizovat.
- **Musíte:** při dalším šíření předat text licence a řádky `Required Notice` (jméno autora Jiří Pelikán a odkaz na <https://jirkapelikan.cz>). Autorství nelze odstranit ani vydávat za vlastní.
- **Úpravy a odvozeniny** smějí vzniknout jen pod stejnými podmínkami a bez komerčního užití.
- **Komerční licence** na vyžádání: kontakt přes <https://jirkapelikan.cz>.
- Software je poskytován „tak, jak je“, bez záruky. Autor neodpovídá za chyby ve výuce ani za výsledky AI (viz upozornění o neověřených odpovědích v aplikaci).

**Důležité upřesnění:** dřívější verze tohoto repozitáře byly zveřejněny pod licencí MIT. Kdo je v té době legálně získal, smí si tyto konkrétní verze ponechat pod MIT. Od tohoto commitu platí pro všechny nové verze PolyForm Noncommercial. Licence už není „open source“ ve smyslu definice OSI, ale „zdrojově dostupná“.

**Logo a značka:** logo pelikána ([`docs/brand/pelikan-logo.png`](docs/brand/pelikan-logo.png)) a jméno Jiří Pelikán **nespadají pod licenci kódu**. Všechna práva vyhrazena; použití mimo tento repozitář vyžaduje svolení autora.

**Příspěvky:** zasláním příspěvku (pull request) souhlasíte, že je možné ho šířit pod touto licencí a že autor projektu smí licenci v budoucnu změnit nebo doplnit komerční licencí.

**Třetí strany:** použité komponenty (Excalidraw, SymPy, KaTeX, Electron, pdf.js, React, Vite) mají vlastní licence uvedené v [NOTICE.md](NOTICE.md) a [ARCHITECTURE.md](ARCHITECTURE.md); jejich podmínky platí dál. Nástroje `codex` a `claude` si uživatel instaluje sám a řídí se podmínkami jejich poskytovatelů. „Claude“, „Claude Code“, „Codex“ a „OpenAI“ jsou ochranné známky svých vlastníků; projekt s nimi není nijak spojen.

**Offline hlasy:** kvalitní hlasy Piper se stahují na přání uživatele z Hugging Face a ukládají se jen v prohlížeči — v repozitáři ani v instalaci nejsou. Všechny čtyři jsou dotrénované z výzkumného hlasu Lessac, jehož licenční podmínky (nekomerční, s ručním ověřením) jsou rozepsané v [NOTICE.md](NOTICE.md).

**Evidence použití AI:** část kódu vznikla s pomocí AI nástrojů (OpenAI Codex, Anthropic Claude) a prošla kontrolou a testy; podrobnosti v [ai-disclosure.md](ai-disclosure.md). Logo, texty o autorovi a licenční ustanovení jsou lidskou prací autora.

Tento přehled není právní poradenství.


## Mentor mode (jak appka učí)

- **Jen tabule:** student klikne na tabuli a píše; zadání je karta jen ke čtení.
- **Lokální trenér:** každý napsaný řádek se kontroluje v prohlížeči (`packages/shared/src/coach.ts`, `stepCheck.ts`, `answers.ts`) bez AI. Režimy: průběžně / až na konec / vypnuto (nabídka maskota).
- **AI jen jako nástroj:** volá se na výslovnou žádost (nabídka maskota, "Vysvětli"), u neověřitelného výsledku jen s povolením v Nastavení. Start lekce AI nevolá.
- **Paměť o studentovi:** `learnerProfile.ts` si tiše pamatuje typy chyb a které styly vysvětlení fungují; stručný souhrn jde AI jako `learnerContext`.
- **Rychlá odezva:** značka ✓/✗ se objeví do ~20 ms po dopsání řádku, komentář učitele do ~250 ms po Escape (psaný řádek) nebo ~450 ms po zvednutí pera (rukou psaný řádek nikdy nekomentujeme uprostřed psaní). Maskot se při psaní „dívá“ za posledním tahem a po zvednutí pera ukáže, že kontroluje. Naměřené časy: [`docs/latency-report.md`](docs/latency-report.md).
- **Rozhovor s učitelem:** tlačítko vedle maskota otevře sbalitelné okno s historií (ukládá se zvlášť pro každou tabuli). Odpovídáš klepnutím na rychlé odpovědi podle situace („Vysvětli jinak“, „Ukaž další krok“, „Chápu“, „Nechápu“, „Příklad“), hlasem (mikrofon) nebo volitelně napsanou zprávou. Běžné otázky k appce (co znamená ✓/✗, jak přepnout hlídání, jak smazat řádek) se zodpovědí lokálně bez AI; ostatní jdou AI i s krátkým kontextem konverzace. Bez připojené AI to appka řekne a nabídne místní pomoc.
- **Živý maskot:** čeká, sleduje pero, kontroluje, přemýšlí (tečky), raduje se (konfety u správného výsledku), mračí se u chyby, ukáže na řádek a pro mluvení otevírá pusu; při uvítání mává. Při omezeném pohybu (`prefers-reduced-motion`) se všechno ukáže bez animací.
- **Plán a testy:** zásuvka "Plán a cesta" (procenta z mastery) a sestavení testu na doma s klíčem odpovědí (tisk / PDF).
- **Předměty:** matematika, VŠ předměty, fyzika a chemie; úlohy s kresbou jsou označené a AI kresby zatím nevidí.

### Rukopis na tabuli

Student píše přímo na tabuli a nemusí nic přepínat. Řádek z tahů se čte
lokálně, bez sítě; u řádku je vidět přepis a u nejistých symbolů kandidáti.
Oprava jedním klepnutím přepočítá jen dotčený řádek a zachová krok. Když AI
není připojená, HUD to řekne, ale čtení i ✓/✗ fungují dál. AI volitelně
dostane přepis, kandidáty, pořadí tahů a jistotu; obrázek jen jako doplněk,
protože ho oba provideři zatím v neinteraktivním režimu neumí přečíst.

Naměřeno na held-out datech: **98,99 %** MNIST, **97,57 %** pendigits,
**92,08 %** neviděné fonty, **100 %** celých řádků v testované mřížce a
**91 %** řádků s neviděnými číslicemi. Medián čtení řádku je kolem **20–22 ms**
(p95 25–26 ms). Známé záměny (`x`/`×`, ojedinělé `4`/`7` v cizích fontech)
řeší kandidáti a oprava; podrobnosti a otevřené mezery jsou v
[`docs/handwriting-e2e-report.md`](docs/handwriting-e2e-report.md).

### Přesnost a první posouzení

Lokální kontrola nemá plošnou 1% toleranci: porovnává hodnotu a skutečné zaokrouhlení na zapsaný počet míst. Zaokrouhlení měřených hodnot je omezené relativně na 1e-3; výslovné školní zlomky mají výjimku pro dvě a více desetinných míst a dovolují i zkrácení (2/3 → 0,66); desetinná aritmetika funguje s čárkou i tečkou. Jednotky mají aliasy (např. g cm^-3 / g·cm⁻³ / g/cm3 a M / mol/l); vynechaná jednotka je nadále tolerovaná.

Odlišné číslo podobné výsledku slovní úlohy vyvolá jen měkký dotaz. „Je to výsledek“ ho posoudí jako finální, „Nevyšlo mi to“ zapíše neúspěch; bez kliknutí se neúspěch nezapočítá. Opsaná data a mezivýsledky se za chybný výsledek neoznačují. Režim Vypnuto nekontroluje. Mastery a profil započítají jen první finální posouzení úlohy, pozdější správná oprava nepřidá druhý úspěch. Procenta kurzu jsou zaokrouhlená a nemusí se změnit po každém pokusu. Lokální kontrola zpracuje nejvýš 400 znaků na řádek, tabule zůstává beze změny.
