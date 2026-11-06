# Security

## Threat model summary

- **Untrusted inputs**: handwritten strokes (via OCR-by-model), the model's
  own text/JSON output, and anything an end user pastes into the UI. None of
  these are trusted to run code, reach a shell, or be parsed by a
  general-purpose math-expression evaluator.
- **No `eval`/`exec`/`sympify`/`parse_expr` on untrusted text, anywhere.**
  Math text is parsed by the hand-written recursive-descent grammar in
  `packages/shared/src/mathAst.ts` (TS side) and its Python port in
  `verifier/` into a tagged AST with a fixed, small node set. SymPy objects
  are built by switching on that tag, never by re-parsing a string. This is
  enforced by a CI grep gate (see `.github/workflows/ci.yml`) that fails the
  build if those four identifiers appear anywhere under `verifier/` outside
  of the explicitly-reviewed construction module and its tests.
- **Resource limits on the verifier**: input length, AST node count, and
  distinct-symbol count are capped before anything reaches SymPy
  (`MAX_INPUT_LENGTH`, `MAX_AST_NODES`, `MAX_SYMBOLS`). The Python process
  additionally enforces a wall-clock timeout and a memory ceiling per
  request and runs as a separate OS process from the bridge.
- **Model capabilities are narrowed, not trusted**: providers are only ever
  asked for handwriting interpretation, pedagogical text, and declarative
  `board_actions` — never given shell, filesystem, network, or arbitrary
  code execution tools. Coding-agent tool access is explicitly disabled
  (`--tools ""` for Claude Code; Codex app-server is driven in a mode that
  exposes no filesystem/exec tool to the tutoring turn).
- **`board_actions` are schema-, bounds-, and revision-validated**
  (`packages/shared/src/boardActions.ts`) before anything is rendered.
  Coordinates outside the current board bounds, malformed/oversized LaTeX,
  too many actions per response, and actions computed against a stale
  `boardRevision` are all rejected rather than applied.
- **Electron hardening**: `contextIsolation: true`, `nodeIntegration: false`,
  `sandbox: true` where supported, a narrow typed `preload` bridge (no
  generic `ipcRenderer.invoke` passthrough), and a restrictive CSP in the
  renderer (no `unsafe-eval`, no remote script origins beyond the provider
  CLIs' own local I/O).
- **Local bridge network exposure**: binds to `127.0.0.1` by default. Remote
  (e.g. phone-to-desktop) access requires an explicit pairing step
  (short-lived pairing code + token, origin/CSRF checks) and is never
  exposed on all interfaces without that explicit opt-in.
- **No credentials in the repo, logs, exports, or telemetry.** Telemetry is
  opt-in (default off); `.env.example` documents configuration shape only,
  never real secrets.

## Reporting a vulnerability

Open a private security advisory on the GitHub repository (or see
`CONTRIBUTING.md` for the current contact path). Do not open a public issue
for undisclosed vulnerabilities.
