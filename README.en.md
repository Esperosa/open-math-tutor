# OpenMathTutor

*Česká verze: [README.md](README.md)*

An interactive math tutor with a digital whiteboard. The student writes a
solution by hand (finger/stylus/mouse), the app recognizes the individual
steps, finds the **first** causal error in the work, explains it (text and
voice), and **writes the hint directly onto the board itself** — not just in
a chat bubble.

Working project name, open source, MIT.

## Bring your own subscription

The app never requires, sells, or relays API keys. You connect your **own**,
already-authenticated AI tool:

- OpenAI Codex CLI (`codex login`), or
- Anthropic Claude Code CLI (`claude auth login`)

The app only spawns these tools as subprocesses in their officially
supported mode — it never reads, stores, or forwards their credentials. See
[ARCHITECTURE.md](ARCHITECTURE.md) for details and quotes from both
providers' legal terms.

## Three main open-source building blocks

- [Excalidraw](https://github.com/excalidraw/excalidraw) (MIT) — the board
- [SymPy](https://www.sympy.org/) (BSD-3-Clause) — step verification
- [KaTeX](https://katex.org/) (MIT) — math rendering

## Install and develop

```bash
npm install
npm run dev:frontend     # frontend at http://localhost:5173
npm run dev:bridge       # local bridge (provider adapters)

cd verifier
python -m venv .venv
.venv/Scripts/pip install -r requirements.txt   # Windows; macOS/Linux: .venv/bin/pip
.venv/Scripts/python -m uvicorn app:app --port 4179
```

Provider login happens outside this app:

```bash
codex login
# or
claude auth login
```

The app never stores the output of these commands or the tokens they create.

## Tests

```bash
npm run lint
npm run typecheck
npm run test:unit
npm run test:verifier
npm run test:e2e
```

## What's done and what isn't (status as of this README's last update)

This is a large project; also check `ARCHITECTURE.md` and the in-app
`requires credentials` / "unavailable" states for anything that needs your
own login.

- **Done and actually tested**: the safe math AST parser
  (`packages/shared/src/mathAst.ts`) and its Python port in the verifier,
  `board_actions` validation (schema, bounds, revision), the
  Excalidraw-based frontend, the local bridge with Codex/Claude adapters,
  four pre-built course tracks with original problems
  (`packages/content`), per-skill adaptive difficulty
  (`packages/shared/src/mastery.ts`), a free-text "Ask" panel, interactive
  function plotting (`plot_function`, a safe `eval`-free numeric
  evaluator), and a NotebookLM-style custom course built from uploaded
  `.txt`/`.pdf` sources (local TF-IDF retrieval, no embeddings, no extra
  API calls) — all covered by automated tests (shared, content, frontend,
  bridge, verifier) and CI.
- **Actually exercised against a live Claude Max subscription in this
  session**: text-based tutoring (Check/Hint/Next step/Explain
  differently/Ask) via `claude -p` without `--bare`, preserving
  subscription login.
- **Knowingly unavailable, not faked**: no documented way was found to
  fully disable Codex's built-in shell/filesystem tools in the app-server
  protocol — until one exists, Codex tutoring reports
  `provider_unavailable` rather than sandbox the tools and call it safe.
  Claude's non-interactive mode has no documented way to read an image at
  all — uploading a scan/photo currently returns `multimodal_unsupported`
  from both providers; the UI is wired and will light up automatically
  once either provider documents a real path.
- **Knowingly out of scope for this phase**: the Android/Capacitor wrapper,
  iOS build, "Sign in with ChatGPT" mode, true stroke-by-stroke pen
  animation (as opposed to incremental KaTeX reveal), and
  geometry/quadratics/radicals (the verifier currently covers arithmetic,
  fractions, percentages, parentheses, and linear equations only).

## License

MIT for this project's own code. Licenses of the components it uses
(Excalidraw, SymPy, KaTeX, Electron, the providers' official CLIs) are
documented in [ARCHITECTURE.md](ARCHITECTURE.md) and `NOTICE.md`.
