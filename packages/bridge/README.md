# Local bridge and desktop shell
> Poznámka: počty testů v tomto souboru jsou historické záznamy z prvního sestavení; aktuální stav je v REQUIREMENTS.md.

**Status: Claude subscription-powered text tutoring verified; the full board-image
tutoring loop is still blocked.** Remaining provider limitations below are
intentional fail-closed behavior.
No credential files, OAuth flows, keys, or session tokens are implemented here.

## Run

Use Node 22.14+ and npm from the monorepo root:

```sh
npm install
npm run build -w packages/shared
npm run build -w packages/bridge
npm run dev:bridge
```

Root lockfile regeneration belongs to integration: this change is restricted to
`packages/bridge/` and `electron/`, so it deliberately does not update the root
`package-lock.json`. `npm ci` needs the integrator to update that file first.
An npm 10.9.2 peer-resolution crash (`edgesOut`) occurred while upgrading installed
dev dependencies in this checkout; `npm install --package-lock=false
--legacy-peer-deps` completed. No root manifests or lockfiles were changed.

The bridge reads the documented `OMT_BRIDGE_PORT` (4178),
`OMT_VERIFIER_PORT` (4179), and validates `OMT_DEFAULT_PROVIDER` if provided.
It never auto-selects/falls back to a provider. Supply environment variables using
your shell; `.env` is not automatically loaded. Start the Python verifier
separately. This package does not install or start Python environments.

Every HTTP request needs an allowed `Origin` (`http://localhost:5173` or
`app://openmathtutor`) and a loopback `Host` (`127.0.0.1:<port>`). Missing/null
origins are rejected too. POST requires `application/json`; browser preflight is
supported. All mandatory routes in `BRIDGE_API.md` exist; optional HTTP SSE is
not implemented. The provider `stream()` interface emits status/done/error, not
fabricated text deltas. Validation errors return 400, non-JSON 415, oversized
bodies 413, and rejected Origin/Host 403. Provider errors preserve the pinned
502 shape and exact error codes. Verifier upstream statuses/bodies are preserved;
unreachable/malformed upstream responses produce 502 `verifier_unavailable`.

LAN pairing is **not implemented**. `OMT_BRIDGE_ALLOW_LAN=true` refuses startup;
it never opens a public listener merely because an opt-in flag was set.

## Verified CLI capabilities (2026-11-06)

### Codex CLI 0.164.0

- Real `codex --version` and documented, non-destructive `codex login status`.
  Authentication is reported only on a successful status command with its
  logged-in indicator; no account/email/token text is returned.
- Real newline-delimited JSON-RPC `codex app-server`: `initialize`, `initialized`,
  `model/list`. Discovery succeeded on the installed, logged-in CLI.
- **No `thread/start` or `turn/start` is sent. No `localImage` inference is
  implemented.** The installed generated stable `ThreadStartParams` and
  `TurnStartParams`, plus the current official documentation, provide no verified
  all-tools-disabled control. `dynamicTools: []` removes no built-in tools;
  `sandbox=read-only` still permits file reads/commands; a prompt prohibition is
  not a capability boundary. Consequently both tutoring methods return
  `provider_unavailable` with this specific explanation after checking auth.
- Do not enable inference by guessing undocumented config keys or relying only
  on read-only/approval settings. A future official zero-tool surface needs a
  version-specific capability check and adversarial tool-isolation verification
  before thread/turn/localImage support can be completed.

Primary references: [app-server protocol](https://developers.openai.com/codex/app-server),
[official ThreadStartParams](https://github.com/openai/codex/blob/main/codex-rs/app-server-protocol/schema/json/v2/ThreadStartParams.json),
[official TurnStartParams](https://github.com/openai/codex/blob/main/codex-rs/app-server-protocol/schema/json/v2/TurnStartParams.json),
[configuration reference](https://developers.openai.com/codex/config-reference).
Locally checked: `codex app-server generate-json-schema --out <temporary-dir>`
(stable fields only), `codex app-server --help`, and `codex login --help`.

### Claude Code CLI 2.1.310

- Real `claude --version` and documented `claude auth status` (JSON `loggedIn`,
  exit 0 logged in / 1 logged out). Only the boolean/status code is exposed.
- Text transport invokes the unmodified CLI with `-p --restricted --tools ""`,
  `--disallowedTools "mcp__*"`,
  `--strict-mcp-config --mcp-config '{"mcpServers":{}}'`,
  `--disable-slash-commands --no-session-persistence`, `--output-format json`,
  `--json-schema`, and `--system-prompt`; student text travels via stdin.
  Structured data is read from `structured_output`, then manually validated.
- **Text-only `continueLesson` can use the official subscription login.** The
  previous `not_authenticated` result came from `--bare`: bare mode does not read
  subscription OAuth credentials or the system keychain. `--tools ""` independently
  disables built-in tools and does not require bare mode. The provider now omits
  `--bare`; `--restricted` excludes user/project settings (managed policy still
  applies), while the MCP deny rule and strict empty MCP configuration exclude
  MCP tools. The empty isolated working directory is retained. The app does not
  ask for or forward API keys, extract OAuth tokens, or substitute another provider.
  A real `continueLesson` hint returned validated `structured_output` using CLI
  2.1.310 with `authMethod: claude.ai`, `subscriptionType: max` on 2026-11-06.
  All four text modes (`check`, `hint`, `next_step`, `explain_differently`) share
  this invocation; deterministic tests cover each, not four separate live calls.
- No documented non-hidden, non-experimental **local-image flag** was verified
  for this mode in the official CLI reference or installed help. `--file` refers
  to provider-hosted file IDs, not uploading a local crop. `analyzeBoard` returns
  `multimodal_unsupported`, with no fake OCR/text-only degradation.
- Model aliases `sonnet`, `opus`, `haiku` are documented aliases, not a claim that
  the account is entitled to every model. All advertise image input as false.

Primary references: [CLI reference](https://code.claude.com/docs/en/cli-reference),
[bare mode and its authentication restriction](https://code.claude.com/docs/en/headless#start-faster-with-bare-mode),
[structured output](https://code.claude.com/docs/en/headless#get-structured-output).
Locally checked `claude --help`, `claude auth --help`, and real status/text calls.

## Model/board trust boundary

All response metadata, confidence, clarification, recognized steps, request ID,
and revisions are runtime-validated. `validateBoardActions` from the published
shared package is always called, and any error rejects the whole response.
Unknown action fields, unsafe style values, unknown step targets, duplicate IDs,
and stale revisions are rejected. Unknown response/step fields are not relayed.

The pinned request contract provides **no board bounds or crop-to-board
transform**. Crop pixel dimensions are not board-space bounds. Until that gap is
resolved, coordinate-bearing actions and annotation deletion are rejected rather
than assigned guessed bounds. Only underline/circle/highlight on known step IDs
or an empty action array are accepted. The frontend must still compare against
its *live* board revision before rendering. Model `verifierStatus` is never treated
as an independently proven mathematical verdict. `/verify-step` accepts bounded
shared `MathStatement` ASTs; it is not a raw LaTeX normalization endpoint.

### Continue-lesson context

The shared prompt supports `ask` (student questions) and `next_problem` (proactive
curriculum teaching), alongside the four existing modes. Optional context is
included whenever supplied, not just in a particular mode:

- `studentMessage`: preserved verbatim in a labeled untrusted-student-data block.
- `curriculumContext`: identifies the track, topic, skill and difficulty; asks for
  progressive teaching, checks for understanding and no unsolicited full solution.
- `retrievedContext`: serialized reference chunks with source metadata and citation
  labels `[sourceTitle | sourceId | chunk chunkIndex]`. Including `sourceId`
  distinguishes equally titled documents. The model must cite the exact label in
  `pedagogicalResponse` when using a chunk and explicitly acknowledge missing source
  coverage rather than inventing support. Sources and their metadata are untrusted
  data, never instructions or independently verified mathematical facts.

Input bounds (string lengths use JavaScript string length): student message 1–4000;
curriculum IDs 1–128; difficulty a nonnegative safe integer; at most 20 retrieved
chunks, each with source ID 1–128, title 1–500, text 1–8000, and a nonnegative safe
integer chunk index. An empty retrieval array is allowed and adds no prompt block.
All context fields remain optional.

No response fields or validation rules change: citations use the existing text
field, not a new `citedChunkIndexes` field. Source-backed math still requires the
independent `/verify-step` path; a model's `verifierStatus` remains untrusted.
Claude uses this prompt with its unchanged CLI restrictions. Codex remains
fail-closed before inference; this change does not enable a Codex tutoring turn.

## Desktop scaffold

```sh
npm exec -w packages/bridge -- tsc -p ../../electron/tsconfig.json
# Start the frontend separately on http://localhost:5173, then:
# PowerShell: $env:OMT_FRONTEND_DEV_URL='http://localhost:5173'
npm exec -w packages/bridge -- electron ../../electron
```

Without `OMT_FRONTEND_DEV_URL`, the shell serves `packages/frontend/dist` at the
privileged standard/secure `app://openmathtutor` origin (never `file:`/`Origin:null`).
Keep this monorepo-relative directory layout for the scaffold. Installer/ASAR
packaging is not supplied. Main starts the built bridge through Electron's
utility process, waits for its own ready marker (not somebody else's listener),
then loads the frontend. Exit/quit tears down the owned process tree on Windows.

`contextIsolation: true`, `nodeIntegration: false`, `sandbox: true`, restrictive
CSP without `unsafe-eval`, denied permissions/downloads/popups/webviews/navigation,
and sender/main-frame-checked `getBridgeUrl()` are enforced. There is no generic
IPC passthrough. Vite development alone allows inline scripts for its React
bootstrap; packaged scripts remain self-only. Inline styles support the whiteboard
and KaTeX. [Electron security guidance](https://www.electronjs.org/docs/latest/tutorial/security).

The shell and sandbox-compatible CJS preload were compiled/typechecked. A real
desktop GUI run was **not** performed: the frontend is absent in this component
worktree and no window was opened on the user's desktop. Windows-first code is
not a claim of verified Linux/macOS packaging.

## Tests and review

```sh
npm run lint -w packages/bridge
npm run typecheck -w packages/bridge
npm run test -w packages/bridge
# PowerShell opt-in for real installed CLI checks:
$env:RUN_CLI_SMOKE_TESTS='1'
$env:RUN_PROVIDER_INTEGRATION_TESTS='1'
npm run test -w packages/bridge
```

`RUN_CLI_SMOKE_TESTS` exercises real detection/status and Codex discovery, never
pretend inference. `RUN_PROVIDER_INTEGRATION_TESTS` is explicitly **requires
credentials**: it makes a real Claude text-only `continueLesson` request and
requires a successful, validated response with the official CLI logged in.
It consumes provider usage; it does not test image input. Deterministic Claude
invocation tests mock the CLI and inspect arguments, not model behavior.
Missing-CLI tests use a PATH without a binary. Logged-out tests use a deliberately
fake status-only CLI process; routing
tests inject fixed contract fixtures and never call that model inference.

The real verifier integration automatically skips with an explicit message if
`http://127.0.0.1:4179/health` is unreachable. Transport tests use an ephemeral
loopback HTTP server to check unchanged request/response/status forwarding, not
to claim mathematical correctness. The normal suite needs no provider credentials.

Security review scope: remote web page → loopback HTTP; untrusted student/model
JSON → validated declarations; renderer → narrow main-process IPC; CLI → bounded
process/protocol output; bridge → loopback-only verifier. Local processes able to
forge Origin/Host are not authenticated by CORS (no LAN pairing/token flow ships).
No secrets or provider output are logged. Fixed sanitized errors cross the
provider boundary. A production release still requires human code review and
resolution of the provider blockers above.

### Subscription-auth fix verification (Windows, 2026-11-06)

- Bridge lint and combined bridge/Electron typecheck: **exit 0**.
- Normal suite: **104 passed, 7 skipped, 0 failed** (111 tests).
- `RUN_PROVIDER_INTEGRATION_TESTS=1`, `tests/liveCli.test.ts` only:
  **1 passed, 5 skipped, 0 failed**. The real Claude text request succeeded;
  the five smoke checks were not enabled for this targeted run.
- Six new deterministic tests: **5 failed, 1 passed** before the fix;
  **6 passed** afterwards. The existing image restriction remains unchanged.
- Independent scoped code review: no blocking findings. Human code review is
  still required before production use.

### Earlier scaffold verification (Windows, 2026-11-06; before this fix)

- Bridge lint, combined bridge/Electron typecheck, bridge build and Electron
  compilation: **exit 0**.
- Normal suite: **98 passed, 7 skipped** (105 tests). Six opt-in CLI checks and
  the unreachable real verifier integration were skipped.
- With both CLI opt-in flags: **104 passed, 1 skipped**, **0 failed**. The only
  skip was the real verifier, which was not listening on port 4179.
- A real loopback HTTP test passed; a real 10.2-second request completed without
  socket disconnection. No successful provider inference or desktop GUI is claimed.
- Independent code review found three issues (10-second socket timeout, missing
  cancellation propagation during initial CLI checks, and coercive enum checks).
  Eight regression assertions failed before fixes and passed afterwards;
  independent follow-up confirmed all three resolved with no remaining scoped
  findings. Final tests also cover the official Windows npm/native CLI launcher.
- Static security scan: no confirmed findings; the single missing-`.env`-ignore
  warning is a false positive because the root `.gitignore` already ignores it.
  The pre-existing shared package still pins vulnerable older Vitest tooling;
  updating its manifest/root lockfile is outside this component's write scope.
  Bridge tooling uses Vitest 4.1.12 and ESLint 10.14.0 rather than adding another
  copy of the old vulnerable versions. This is not a claim of a clean global audit.
