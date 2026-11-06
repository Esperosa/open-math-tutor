# Contributing

(English version follows the Czech one.)

## Jak přispívat

1. `npm install` v kořeni repozitáře (workspaces), `cd verifier && python -m venv .venv && .venv/bin/pip install -r requirements.txt` pro verifikátor.
2. Před PR: `npm run lint`, `npm run typecheck`, `npm run test:unit`, `npm run test:verifier`.
3. Nový typ úlohy v matematickém rozsahu MVP (aritmetika, zlomky, procenta, závorky, lineární rovnice) vždy doplňte o unit testy v `verifier/tests` *i* o odpovídající testovací případ v `packages/shared/src/mathAst.test.ts`, pokud se dotýká grafu/grammatiky.
4. Nové `board_actions` musí mít validaci v `packages/shared/src/boardActions.ts` (typ, meze, revize) dřív, než se použijí v UI.
5. Netvrďte u žádné funkce "hotovo", pokud neprošla reálným testem (ne mockem) alespoň jednou — a pokud jde o cestu vyžadující přihlášení, nahlaste to jako `requires credentials`, ne jako zelený test.
6. Komerční fonty se nesmí commitovat. Cizí vizuální referenci zapište do `SOURCES.md`.

## How to contribute

1. `npm install` at the repo root (workspaces); for the verifier run
   `cd verifier && python -m venv .venv && .venv/bin/pip install -r requirements.txt`.
2. Before opening a PR: `npm run lint`, `npm run typecheck`,
   `npm run test:unit`, `npm run test:verifier`.
3. Any new MVP-scope problem type (arithmetic, fractions, percentages,
   parentheses, linear equations) needs unit tests in `verifier/tests` *and*
   a matching case in `packages/shared/src/mathAst.test.ts` if it touches the
   grammar.
4. New `board_actions` need validation in
   `packages/shared/src/boardActions.ts` (type, bounds, revision) before
   being wired into the UI.
5. Never claim a feature "done" without it passing a real test (not a mock)
   at least once — a credential-gated path is reported as
   `requires credentials`, not as a green test.
6. Never commit commercial fonts. Record any third-party visual reference in
   `SOURCES.md`.
