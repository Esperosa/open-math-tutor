# OpenMathTutor

*English version: [README.en.md](README.en.md)*

Interaktivní matematický doučovatel s digitální tabulí. Žák píše postup
rukou (prst/pero/myš), aplikace rozpozná jednotlivé kroky, najde **první**
chybu v postupu, vysvětlí ji česky textem i hlasem a **sama napíše
nápovědu přímo na tabuli** — ne jen do chatové bubliny.

Pracovní název projektu, open-source, MIT.

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
  tabulí, lokální bridge s adaptéry Codex/Claude, 4 předpřipravené kurzy
  s původními úlohami (`packages/content`), adaptivní obtížnost per
  dovednost (`packages/shared/src/mastery.ts`), volný dotaz ("Zeptej se"),
  interaktivní vykreslování funkcí (`plot_function`, bezpečný numerický
  evaluátor bez `eval`), vlastní kurz z nahraných `.txt`/`.pdf` materiálů
  (lokální TF-IDF vyhledávání, žádné embeddings, žádné API volání navíc) —
  vše s automatickými testy (shared, content, frontend, bridge, verifier)
  a CI.
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
  "Sign in with ChatGPT", skutečná animace psaní perem tah po tahu (místo
  postupného vykreslení KaTeX), geometrie/kvadratické rovnice/odmocniny
  (verifikátor zatím podporuje jen aritmetiku, zlomky, procenta, závorky
  a lineární rovnice).

## Licence

MIT pro vlastní kód tohoto projektu. Licence použitých komponent (Excalidraw,
SymPy, KaTeX, Electron, oficiální CLI nástroje poskytovatelů) jsou
zdokumentované v [ARCHITECTURE.md](ARCHITECTURE.md) a `NOTICE.md`.
