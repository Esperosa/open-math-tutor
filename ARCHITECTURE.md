# Architecture

## Bring-your-own-subscription model

OpenMathTutor never stores, proxies, or resells AI usage. The end user installs
and authenticates an official provider CLI themselves, outside this app:

- OpenAI Codex CLI: `codex login`
- Anthropic Claude Code CLI: `claude auth login` (or `claude /login`)

The local bridge (`packages/bridge`) only *spawns the already-authenticated,
unmodified binary as a subprocess* and talks to it over its own supported
protocol. It never reads, stores, or forwards the CLI's credential/session
storage.

### Why this is the only legally workable model (verified 2026-11-06)

Anthropic's Claude Code legal page (https://code.claude.com/docs/en/legal-and-compliance)
states developers may **not** "offer Claude.ai login into their own
applications, or route requests through Free, Pro, Max, or Ultra plan
credentials on behalf of their users," and may not "collect, store, or
intermediate Claude.ai credentials or session tokens." It also explicitly
carves out the model this project uses: it does **not** prevent "an end user
from signing in to the unmodified Claude Code binary with their own Claude
subscription." The binary must stay unmodified and its own auth methods must
not be disabled.

Consequently:

- We never implement our own Claude.ai OAuth flow.
- We never read `~/.claude` credential storage.
- We only invoke the documented `claude -p` non-interactive mode with
  `--bare --tools ""` (no MCP, no coding tools) on an already-logged-in
  installation, as described in Anthropic's own CLI docs.
- We may not call the product "Claude" anything, imply endorsement, or use
  Anthropic's logos (see LICENSE / NOTICE.md).

For OpenAI, the equivalent pattern is `codex login` + the officially
documented `codex app-server` JSON-RPC protocol (`initialize`, `thread/start`,
`turn/start`, streamed events). "Sign in with ChatGPT"
(https://developers.openai.com/siwc/quickstart) is a *separate, optional*
future mode: it lets an approved app spend the user's ChatGPT plan allowance
via the Responses API through OAuth/PKCE, which is a real inference
entitlement, not "no API at all" — it is **not** implemented in this MVP
(requires OpenAI partner approval for the sign-in trial) and must never be
described as equivalent to plain CLI usage.

**Both providers must independently fail closed**: if a provider's CLI is
missing, not logged in, rate-limited, or its multimodal path is unverified,
`authStatus()`/`detect()` report that precisely — the app never silently
falls back to the other provider or fabricates a response.

## Trust boundaries

```
[Excalidraw board, React UI]
        │ image crop + step history (IPC, contextIsolation, narrow preload)
        ▼
[Electron/bridge: TutorProvider adapters] ──spawn──▶ [codex CLI / claude CLI]
        │ board_actions (validated, schema + bounds + revision-checked)
        │ recognized LaTeX → plain-grammar text
        ▼
[Python verifier process] parses with hand-written recursive-descent parser
        │ (packages/shared/src/mathAst.ts port) into an allowlisted AST —
        │ NEVER eval/exec/sympify/parse_expr on a raw string
        ▼
[SymPy objects built node-by-node from the AST] → equivalence/correctness verdict
```

Two independent validation layers sit between "whatever the model said" and
anything that reaches the board or the verifier:

1. `packages/shared/src/boardActions.ts` — schema, length, count, and
   coordinate-bounds validation of `board_actions`, plus a hard
   `boardRevision` equality check (stale responses are dropped, never
   applied, matching the "Čekám na dokončení zápisu" requirement).
2. `packages/shared/src/mathAst.ts` and its Python port in `verifier/` — a
   constrained grammar (single-letter symbols, integers/fractions, `+-*/^`,
   parentheses, `= < <= > >=`) parsed by hand into a tagged AST. The verifier
   only ever constructs `sympy` objects by switching on the AST's `kind`
   field; it never calls `sympify`/`parse_expr`/`eval`/`exec` on text that
   originated from the model or the student.

## Monorepo layout

- `packages/shared` — TypeScript contracts: `TutorProvider`, `BoardAction`,
  math AST + parser. Single source of truth both the frontend and the bridge
  import; also the spec the Python verifier's grammar must match exactly.
- `packages/frontend` — Vite + React + TS PWA. Excalidraw board, KaTeX
  rendering layer, i18n (cs default, en), stroke-settle debounce, manual
  controls, local history/settings storage.
- `packages/bridge` — Node process: provider adapters (Codex, Claude),
  Electron main/preload (contextIsolation, no nodeIntegration, narrow typed
  IPC), HTTP client to the Python verifier.
- `verifier/` — isolated Python 3 process (own venv), SymPy-based step
  verification behind a small HTTP/JSON contract, with process-level CPU
  time, memory, and input-size limits.
- `electron/` — Windows-first desktop packaging (first platform actually
  built and tested; macOS/Linux only added once independently verified).

## Known, disclosed limitations (MVP)

See README.md "Co je hotové a co ne" / "What's done and what isn't" for the
full, honest acceptance-checklist-style status — this file only tracks the
architectural *reasons*. In short: Android/Capacitor wrapper, iOS, "Sign in
with ChatGPT", and true per-stroke pen-animation (vs. incremental KaTeX
reveal) are scaffolded or specified but not shipped as working in this pass;
each is called out explicitly rather than silently assumed done.
