# OpenMathTutor frontend

Vite, React, TypeScript, Excalidraw 0.18.1 and KaTeX. All implementation in this
package; no provider implementation, credentials, verifier process or production
mock. MIT application code; dependency/font licenses remain their respective licenses.

## Run

From the repository root, with Node >=22.12:

```sh
npm install
npm run dev -w packages/frontend
```

Open **http://localhost:5173** (the origin allowed by the pinned bridge contract).
The server binds loopback only. With no bridge running on `127.0.0.1:4178`, the
real application displays an unavailable banner and keeps drawing, keyboard
entry, exercise switching and local persistence working. Retry after starting
the separately owned bridge. Provider/model selection is explicit; never falls back.

Integration owner: regenerate the **root package-lock.json** with `npm install`.
This work deliberately does not change that file because its scope is only
`packages/frontend/`. During implementation dependencies were installed with
`--package-lock=false --ignore-scripts`. A clean root `npm ci` needs that lockfile
integration first. The dependency on `@openmathtutor/shared: 0.1.0` uses the normal
npm workspace link. TypeScript/Vite resolve that package's existing source entry
locally so an unbuilt shared package works without writing to `packages/shared`.

```sh
npm run typecheck -w packages/frontend
npm run lint -w packages/frontend
npm run test -w packages/frontend
npx playwright install chromium
npm run test:e2e -w packages/frontend
npm run build -w packages/frontend
npm run test:pwa -w packages/frontend
npm run preview -w packages/frontend
```

Build/dev copy Excalidraw's bundled open-source fonts into an ignored generated
directory; no commercial fonts or dependency assets are committed. Plain Vite
uses external ES modules, avoiding React-refresh's inline preamble. Script CSP
has neither `unsafe-inline` nor `unsafe-eval`. Inline **styles** are allowed for
Excalidraw and positioned KaTeX. Font/CDN fallbacks declared by Excalidraw are
blocked by CSP; local assets work. No remote font origin is allowlisted.

## Interaction and state

- Czech default, complete English application dictionary and Excalidraw locale;
  light/dark themes, focus outlines, 44px application controls, responsive layout.
- Draw with pointer/stylus/touch using Excalidraw, or add/correct a selected line
  with the keyboard form. Geometry groups nearby marks into ordered rows with
  stable IDs. This is a heuristic, not handwriting recognition. Providers must
  retain the supplied `stepId`s; unknown target IDs fail closed.
- The bridge's `continue-lesson` request has no image field. Thus **Přečíst zápis
  z tabule / Read writing from board** explicitly sends a bounded active-row PNG
  to `analyze-board`. The four required lesson buttons call `continue-lesson`
  with `check`, `hint`, `next_step`, `explain_differently` exactly, using the
  latest recognized/typed history. No fields/endpoints are invented.
- Automatic checks require explicit opt-in and a selected image-capable model.
  Two unchanged 900ms windows (1.8s total), no active pointer/text editing, and a
  complete-looking equation or multiple sufficiently wide handwritten marks
  are required. AI changes and pan/zoom/selection never trigger analysis.
- Student edits/task edits, AI annotation batches and individual annotation
  undo increment a monotonically increasing board revision. View-only layer
  hiding/theme/settings do not. New student edits clear outdated annotations,
  retain explanations and cancel the old request before scheduling a new check.
- Incoming response request ID and revision must match. Every incoming action
  passes the shared `validateBoardActions`. Stale actions are dropped with a
  waiting indicator; never rebased to masquerade as current input. Already
  validated retained annotations are rebased when a new AI batch commits. All
  retained actions are validated again before rendering/restoring. A response
  is capped by the shared validator; the total retained layer is bounded to
  the newest 64 annotations, validated individually at rendering.
- Excalidraw owns its live student scene. Annotation synchronization merges
  only the separate locked, orange `omt-ai-*` shapes into the **live** scene,
  including deletion tombstones. It must not echo lagging React snapshots back
  over a finalized stroke. Pointer-up commits next animation frame. Native
  student undo stays separate from application annotation undo.
- `write_math`: board-space KaTeX overlay following pan/zoom, with **incremental
  reveal of a KaTeX render, NOT stroke-by-stroke pen-path animation**. Respects
  reduced-motion. `write_text`/`show_hint`: Excalidraw text. Underline, ellipse,
  highlight: shapes around the recorded step box. Arrow: Excalidraw arrow.
  `erase_own_annotation` only removes state in the AI layer, never student data.
  Targeted marks are restricted to the reported first causal error.
- Stop cancels speech, aborts fetch/export continuation, and sends the pinned
  idempotent cancel request. Board edits, exercise/provider/model/locale changes
  also invalidate in-flight requests. Responses are ignored after cancellation.
- Exercises, snapshots (including image files), ordered steps, explanations,
  annotations and settings persist in localStorage. Save failures are visible;
  page-hide flushes the latest state. Delete exercise removes its local data.
  This is not encrypted storage; shared-device users should delete sensitive
  exercises. Large imported images can exceed browser storage quota.

## Voice and privacy

Text explanations are always shown. Speech is off by default, feature-detected,
and uses **local-service voices only**, so the browser cannot silently send the
explanation to a cloud TTS engine. Voice/rate are selectable; no Czech local
voice produces a specific `cs-CZ` installation warning instead of an English
fallback. Speech input is not implemented and is never required. Voice API
behavior is unit-tested; actual audible playback requires an OS/browser check.

No analytics, remote scripts, direct provider calls or credentials. Network
requests from the application client go only to the fixed loopback bridge.
Local CSP blocks external scripts, images, fonts and embedded frames. HTTP
credentials are omitted, redirects refused, responses validated as envelopes;
untrusted explanation text is React text, never HTML. KaTeX is configured with
`trust:false`, strict parsing, bounded expansion and output sizing. Its generated
HTML is the only `dangerouslySetInnerHTML` sink. Style/color instructions from
models are not used to inject CSS; annotations use fixed application colors.

The production build contains a web manifest and generated service worker
precaching local static assets, not bridge requests or exercise data. The
development server does not register a worker. Offline install support is a
PWA scaffold with a headlessly tested built offline shell; browser install prompts and packaged Electron origins require
integration testing. Service-worker updates take effect on the next session.

## Tests and verification boundaries

`tests/replay.spec.ts` is explicitly a **deterministic replay with test-only HTTP
mocks**, not real inference or an independent mathematics-verifier test. It
uses the real Excalidraw component and an actual pointer stroke, waits for the
settled image-crop request, returns a canned first-error response, renders math,
text, arrow and underline annotations, hides/shows the layer, corrects the same
stable step ID, and receives simulated success. It also checks all four manual
modes. A second delayed-response test verifies Stop/cancel. A third test uses
**no bridge mocks/server**: genuine bridge unavailability, persistence, English,
dark mode and a 390px viewport. Screenshots/traces are generated under ignored
`test-results/`.

`test:pwa` runs separately against the production build on port 5174, waits for
the real service worker to control the page, disables the entire browser
context's network, reloads, and adds a board line. This caught and fixed
cache misses caused by the static server's `Vary: Origin` response: only the
allowlisted same-origin immutable build files ignore that header on lookup.

Unit/RTL tests cover revisions, staleness, the actual shared validator, first
causal target filtering, safe erasure/undo, multi-batch annotation retention,
OCR invalidation, file persistence, locale coverage, fake-timer settling,
HTTP abort/error contracts, shell unavailability and local voice selection.

No real provider/CLI, Electron package, verifier implementation, physical
stylus, screen reader or audible voice has been tested here. The HTTP response
does not carry independent verifier evidence: the UI explicitly labels its
verdict as bridge-reported rather than inventing trusted verification.
`imageCrop` has no crop-origin field and step history carries no bounding boxes;
absolute anchors must follow the shared board-space convention. No extra
coordinate metadata is silently added to the pinned request.

## Review / integration cautions

Read-only independent code review found and fixed dark-mode crop contrast,
lost asynchronous image files, stale handwriting transcription, text-editor
busy-state leakage and per-response-vs-total annotation truncation. Real replay
then caught the stale-scene echo loop described above; the corrected replay
passed. All changes still require maintainer code review before release.

Security source scan flags the KaTeX-generated HTML sink; review confirms raw
model HTML never reaches it and trusted KaTeX commands are disabled. Its `.env`
warning is a scoped-scan false positive: repository `.gitignore` already ignores
secrets. Appearance scan flags a code comment and the annotation's left marker;
the first is not user copy, the second deliberately identifies the distinct AI
layer. Screenshots were visually inspected at desktop and mobile/dark sizes:
workbench + explanation rail, system type, no promotional hero/cards/gradients.
The native Excalidraw tool palette retains its upstream theme.

Dependency audit is **not clean**: Excalidraw pins transitive dependencies with
advisories (notably nanoid and the Mermaid/parser dependency chain); tooling
also reports minimatch advisories. No claim is made that every advisory is
reachable from this UI. Root audit uses the pre-existing lockfile and is not a
valid report for the newly installed frontend; a separate frontend-only
dependency-resolution audit was used too. Dependency upgrades/overrides and
the root lockfile need review by the integration owner before production.
The isolated resolution audit reported **19 advisories: 9 high, 8 moderate,
2 low, 0 critical** (including development dependencies; this is an automated
dependency advisory count, not a confirmed-exploit count).
KaTeX was updated to the patched 0.19 line. Vite also reports large upstream
Excalidraw/Mermaid/font chunks; lazy feature/bundle reduction remains work.

The original `open_math_tutor_agent_prompt.md` was absent. Implementation uses
the requested summary, `BRIDGE_API.md`, shared contracts, architecture/security
documents and the [Excalidraw API documentation](https://docs.excalidraw.com/docs/@excalidraw/excalidraw/api/props/excalidraw-api).
