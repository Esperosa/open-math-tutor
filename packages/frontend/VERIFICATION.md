# Verification — 2026-11-06

> Superseded: the counts below are the first build. Current numbers (unit tests, Playwright scenarios) are tracked in the repository root `REQUIREMENTS.md`.

Actually executed in this worktree, scoped to this package:

- `npm run dev -w packages/frontend`: Vite listening on loopback port 5173;
  real absent bridge exercised, not replaced with a production mock.
- `npm run build -w packages/frontend`: exit 0, TypeScript + Vite production
  build succeeded. Last build: 10.56s Vite time. Large upstream bundle warnings
  remain (largest generated font chunk about 1.82MB before compression).
- `npm run typecheck -w packages/frontend`: exit 0.
- `npm run lint -w packages/frontend`: exit 0, zero warnings.
- `npm run test -w packages/frontend`: **8 test files, 22 tests passed**.
- `npm run test:e2e -w packages/frontend`: **3 tests passed**, headless Chromium
  installed and executed. Deterministic test-only response replay, cancellation,
  and genuine bridge-unavailable/persistence/mobile-dark/English path.
- `npm run test:pwa -w packages/frontend`: **1 test passed**, production build
  with real service worker, network disabled, reload and board edit succeeded.
- Source security and appearance scans executed; scoped false positives
  reviewed in README. Read-only independent code review completed; findings
  fixed and actual replay rerun.
- Frontend-only dependency-resolution audit: **19 advisory entries** including
  tooling: **9 high, 8 moderate, 2 low**. Not production-clean; see README.

The replay's success verdict is canned test data, not real mathematical
inference or independent verifier evidence. Production code contains no canned
provider response. KaTeX math uses incremental reveal, **not** per-stroke pen
animation. No audible speech, physical stylus, Electron package, actual CLI
inference, real verifier or install prompt was verified.

Only `packages/frontend/` is committed. Root lockfile integration remains with
the parent/integration owner. No shared, bridge, Electron or verifier files
were changed. No HTTP/shared-type contract changes were needed.
