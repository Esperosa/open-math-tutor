<p align="center"><a href="https://jirkapelikan.cz"><img src="docs/brand/pelikan-logo.png" alt="Jiří Pelikán logo" width="96"></a></p>

# OpenMathTutor

*Česká verze: [README.md](README.md)*

> Created and copyrighted by **[Jiří Pelikán](https://jirkapelikan.cz)**. A source-available project for **non-commercial** use ([PolyForm Noncommercial 1.0.0](LICENSE)); credit to the author must be kept when sharing or modifying it. Details in [Rights and license](#rights-and-license).

An interactive math tutor with a digital whiteboard. The student writes a
solution by hand (finger/stylus/mouse), the app recognizes the individual
steps, finds the **first** causal error in the work, explains it (text and
voice), and **writes the hint directly onto the board itself** — not just in
a chat bubble.

Working project name, source-available, non-commercial license.

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

Google (Gemini): your own API key from Google AI Studio (free tier) or Vertex - set `GEMINI_API_KEY` / `GOOGLE_API_KEY`.

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
- **Handwriting on the board is read by a local model**: mouse, pen and
  touch strokes are grouped into lines and symbols in the browser, turned
  into an expression and checked exactly like typed text. Uncertain symbols
  offer candidates and a one-tap fix; the AI receives structured hints, not
  just an image. Measured accuracy and the e2e matrix are in
  [`docs/handwriting-e2e-report.md`](docs/handwriting-e2e-report.md).
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

## Rights and license

**Author:** Jiří Pelikán, <https://jirkapelikan.cz>. Copyright © 2026 Jiří Pelikán. All rights not expressly granted by the license are reserved.

**License for code and text:** [PolyForm Noncommercial License 1.0.0](LICENSE). In plain words (only the license text is binding):

- **You may:** use, study, copy and modify the project for **non-commercial** purposes: personal learning, teaching, research, hobby work, schools, non-profits and public institutions.
- **You may not:** use the project or parts of it **commercially**: sell it, offer it as a paid service, build it into a paid product, use it in a for-profit business or otherwise monetize it.
- **You must:** when redistributing, pass on the license text and the `Required Notice` lines (author name Jiří Pelikán and the link <https://jirkapelikan.cz>). The attribution may not be removed or passed off as your own.
- **Changes and derivative works** are allowed only under the same terms and without commercial use.
- **Commercial license** on request: contact via <https://jirkapelikan.cz>.
- The software is provided "as is", without warranty. The author is not liable for teaching errors or AI output (see the unverified-answer notices in the app).

**Important:** earlier versions of this repository were published under the MIT license. Anyone who lawfully obtained those specific versions may keep them under MIT. From this commit on, all new versions are under PolyForm Noncommercial. The license is no longer "open source" in the OSI sense; it is "source-available".

**Logo and name:** the pelican logo ([`docs/brand/pelikan-logo.png`](docs/brand/pelikan-logo.png)) and the name Jiří Pelikán are **not covered by the code license**. All rights reserved; use outside this repository requires the author's permission.

**Contributions:** by submitting a contribution (pull request) you agree it may be distributed under this license and that the project author may change the license or add a commercial license in the future.

**Third parties:** the components used (Excalidraw, SymPy, KaTeX, Electron, pdf.js, React, Vite) keep their own licenses, listed in [NOTICE.md](NOTICE.md) and [ARCHITECTURE.md](ARCHITECTURE.md). The `codex` and `claude` tools are installed by the user and governed by their providers' terms. "Claude", "Claude Code", "Codex" and "OpenAI" are trademarks of their owners; the project is not affiliated with them.

**AI use disclosure:** part of the code was written with AI tools (OpenAI Codex, Anthropic Claude) and reviewed and tested; see [ai-disclosure.md](ai-disclosure.md). The logo, the author texts and the licensing provisions are the author's own human work.

This overview is not legal advice.


## Mentor mode (how the app teaches)

- **Board only:** the student clicks on the board and writes; the task card is read-only.
- **Local coach:** every written line is checked in the browser (`packages/shared/src/coach.ts`, `stepCheck.ts`, `answers.ts`) without AI. Modes: as I go / at the end / off (the mascot's menu).
- **AI only as a tool:** called on explicit request (mascot menu, "Explain"); for a result that cannot be checked locally only when Settings allow it. Starting a lesson never calls the AI.
- **Memory of the student:** `learnerProfile.ts` quietly records mistake types and which explanation styles work; a short summary goes to the AI as `learnerContext`.
- **Plan and tests:** a "Plan and path" drawer (percentages from mastery) and a take-home test with an answer key (print / PDF).
- **Subjects:** mathematics, university subjects, physics and chemistry; drawing tasks are labelled and the AI cannot see drawings yet.

### Handwriting on the board

The student writes directly on the board and does not switch tools. A stroke
line is read locally, without the network; the reading is shown beside it and
uncertain symbols offer candidates. A one-tap fix recomputes only that line
and keeps the step. When the AI is offline the HUD says so, but reading and
✓/✗ still work. The AI optionally receives the reading, candidates, stroke
order and confidence; an image is only a supplement because neither provider
can read one in non-interactive mode yet.

Measured on held-out data: **98.99%** MNIST, **97.57%** pendigits,
**92.08%** unseen fonts, **100%** whole lines in the tested grid and **91%**
lines with unseen digits. Median line reading is around **20–22 ms** (p95
25–26 ms). Known confusions (`x`/`×`, occasional `4`/`7` in other fonts) are handled by
candidates and correction; details and open gaps are in
[`docs/handwriting-e2e-report.md`](docs/handwriting-e2e-report.md).

### Precision and first assessment

Local checking has no blanket 1% tolerance: values must match exactly or be an actual rounding to the written precision. Measurement rounding is capped at 1e-3 relative error; explicit school fractions have an exception at two or more decimal places (including 7/8 → 0.88), and recurring fractions also permit truncation (2/3 → 0.66). Decimal arithmetic supports commas and dots, including equalities with trailing units. Unit aliases include g cm^-3 / g·cm⁻³ / g/cm3 and M / mol/l; omitted units are still tolerated.

A differing apparent word-problem result gets a soft check-in. “This is my result” submits that line as final; “I could not solve it” records a failure. No click means no failed attempt. Given data and intermediate results are not automatically judged as wrong finals. Off mode does not check. Mastery and the learner profile count only the first final assessment per problem; a later correction is praised without adding a second success. Rounded course percentages need not change on every attempt. Local checks ignore lines longer than 400 characters without changing the board.
