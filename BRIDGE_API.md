# Local bridge HTTP API (pinned contract)

The frontend talks **only** to this local bridge (default
`http://127.0.0.1:4178`, see `.env.example`'s `OMT_BRIDGE_PORT`). The bridge
is the only thing that spawns provider CLIs and the only thing that calls
the Python verifier (`http://127.0.0.1:4179`, internal — the frontend never
calls it directly). Binds to loopback only unless the explicit LAN-pairing
opt-in (`OMT_BRIDGE_ALLOW_LAN`) is set, per `SECURITY.md`.

All request/response bodies are JSON and match the TypeScript types in
`packages/shared/src/tutorProvider.ts` exactly (import the package, do not
redeclare the shapes).

## `GET /providers`

Returns detection + auth + model status for every known provider, so the UI
can render per-provider state without the user initiating anything:

```jsonc
{
  "providers": [
    {
      "id": "codex",
      "detect": { "installed": true, "version": "..." },
      "authStatus": { "providerId": "codex", "authenticated": true, "accountLabel": "..." },
      "models": [{ "id": "...", "label": "...", "supportsImageInput": true }]
    },
    { "id": "claude", "detect": { "installed": false }, "authStatus": { "providerId": "claude", "authenticated": false, "error": "cli_missing" }, "models": [] },
    {
      "id": "google",
      "detect": { "installed": true },
      "authStatus": { "providerId": "google", "authenticated": true, "tutoringAvailable": true, "keyPresent": true },
      "models": [{ "id": "gemini-2.0-flash", "label": "Gemini 2.0 Flash", "supportsImageInput": true }]
    }
  ]
}
```

Never auto-selects or falls back between providers; this just reports state.

## `POST /providers/:id/analyze-board`

Body: `AnalyzeBoardRequest`. Response: `AnalyzeBoardResponse`. `:id` is
`codex`, `claude`, or `google`. 404 with `{ "error": "unknown_provider" }` for anything
else. On provider failure, respond `502` with
`{ "error": ProviderErrorCode, "detail": string }` using the exact codes
from `tutorProvider.ts` (`cli_missing`, `not_authenticated`, `rate_limited`,
`provider_unavailable`, `multimodal_unsupported`, `tos_restricted`,
`cancelled`, `timeout`, `invalid_response`, `unknown`) — the frontend
switches UI state on these codes, so they must be exact string matches.

## `boardActions`: the tutor writes on the board

`pedagogicalResponse` is only a short companion comment (the mascot bubble).
The teaching itself is `boardActions`, written by the client in a separate,
deletable teacher layer (handwriting font, red pen for corrections, teal for
explanations). The model **never supplies coordinates**: every position is a
relative anchor `placement = { relativeToStepId, symbolIndex?, side, offsetEm }`
with `side` one of `right | below | above | left | over` and `offsetEm` 0..12.
The client resolves it to scene space and avoids collisions with the student's
writing.

| `type` | fields |
| --- | --- |
| `circle`, `underline`, `highlight`, `strike_through` | `targetStepId`, optional `targetSymbolIndex` |
| `write_text`, `show_hint` | `text` (<= 500 chars, no HTML), `placement` |
| `write_math` | `latex` (<= 300 chars, safe subset: `frac`, `cdot`, `times`, `div`, `left`/`right`, `le`/`ge`), `placement` |
| `draw_arrow` | `from`, `to` (both `placement`) |

Every action carries `id` (unique within the response) and `boardRevision`
(must equal the request revision). At most 12 actions per response. Bridge
validation rejects the whole response when an action has an absolute `x`/`y`
anchor, an unknown step ID (only IDs from `stepHistory` are accepted), a
target other than `firstErrorStepId` (when one is set), `erase_own_annotation`,
extra fields, HTML or an unsafe math grammar. Absolute anchors and
`erase_own_annotation` remain valid only in client-saved boards, never as
provider output. Intended order: mark the first error (`circle` or
`strike_through`), then a short guiding label (about 12 words) beside or below
it, optionally an arrow; a worked next step (`write_math` below) only for mode
`next_step`. The response schema is the same for the `claude` and `codex`
providers.

## `POST /providers/:id/continue-lesson`

Body: `ContinueLessonRequest`. Response: `AnalyzeBoardResponse`. Same error
contract as above. Used for the manual "Zkontrolovat" (`check`), "Poradit"
(`hint`), "Ukaž další krok" (`next_step`), "Vysvětli jinak"
(`explain_differently`) buttons via `mode`, plus two curriculum-era modes:

- `"ask"` — free-text student question (`studentMessage`), e.g. "nechápu
  proč se mění znaménko". May carry `retrievedContext` (top-k chunks from
  the student's own uploaded sources, for the NotebookLM-style custom
  track) — these are untrusted document text, never treated as verified
  math fact; any mathematical claim in the response still only becomes
  "correct" via the independent `/verify-step` call, never via retrieval
  alone.
- `"next_problem"` — proactive lesson-mode step: the request carries
  `curriculumContext` (`trackId`/`topicId`/`skillId`/`difficultyLevel`) so
  the provider can introduce or continue teaching that skill rather than
  only reacting to the board.

## `POST /providers/:id/cancel`

Body: `{ "requestId": string }`. Always `204` (idempotent even if the
request already finished or was unknown).

## `POST /verify-step`

Forwards to the Python verifier's `/verify-step` (see `verifier/SPEC.md`)
with the same request/response shape, unchanged. This is how the bridge (or
the frontend, through the bridge) gets a trusted correctness verdict
independent of what the model claimed in `verifierStatus`.

## `GET /health`

`{ "status": "ok", "verifier": "ok" | "unreachable" }`.

## Streaming (optional for MVP)

If implemented, `GET /providers/:id/stream?requestId=...` as Server-Sent
Events, one event per `ProviderStreamEvent` JSON line. If not implemented in
this pass, `analyze-board`/`continue-lesson` must still work as plain
request/response — streaming is a progressive enhancement, not a
requirement for the core loop.

## CORS / origin

Only accepts requests with `Origin` matching the dev server
(`http://localhost:5173`) or the packaged Electron app's origin; reject
everything else per `SECURITY.md`'s CSRF/origin-check requirement.


## Optional `learnerContext` (continue-lesson)

`learnerContext?: string` (at most 800 characters) is an app-generated, advisory summary of how the student learns (frequent mistake types, explanation styles that worked). The bridge validates its length and passes it to the model as clearly labelled advisory data, never as instructions.
