# Math verifier

From the repository root, in a dedicated Python 3.10+ environment:

```sh
python -m pip install -r verifier/requirements.txt
python -m verifier.app
python -m pytest verifier -q
```

The service binds to `127.0.0.1:4179`. Only `GET /health` and
`POST /verify-step` are exposed. The latter accepts the exact tagged
`MathStatement` JSON envelopes in `SPEC.md`, not raw text or LaTeX.
`parser.parse_math_statement` is available to trusted bridge/test callers
that need to turn constrained text into that JSON. There are no function
nodes: `sin(x)` means `s*i*n*(x)`.

All request fields are validated, including an unused task statement.
`previous_step` takes precedence over `task_statement`; at least one is
required. Percentages use normalized fractions, such as `25/100*80`, not
a percent-sign extension to the grammar. Symbols denote real numbers.

## Isolation and safety

HTTP validation precedes math construction. Body size is limited to 64 KiB;
ASTs are capped at 200 nodes and six distinct single-letter symbols per
statement; text is capped at 400 characters. ASTs also have a conservative
400-character lower-bound source budget, so large numeric leaves cannot
bypass text limits.
Numeric AST leaves must be finite nonnegative integers (including integral
JSON exponent notation). The internal endpoint
rejects browser Origin headers; the bridge owns frontend CORS/authentication.

Each request's math runs in a fresh spawned process with a 512 MiB ceiling:
POSIX uses `RLIMIT_AS`; Windows 8+ uses a per-process Job Object memory
limit. A host policy that disallows nested jobs fails closed. SymPy loads
only after these limits are set. The default deadline is two seconds,
including process startup. `OMT_VERIFIER_TIMEOUT_SECONDS` may set a positive
timeout up to five seconds. A 0.2-second cleanup grace is reserved within
the hard five-second cap. At most two math workers run concurrently;
additional requests receive `invalid` / `verifier_busy` and may retry.

`limits.run_verification` is the production entry point for non-HTTP
callers. `ast_builder.verify_step`, `verify_pair`, and `build_statement`
are synchronous core/test helpers, not isolation boundaries; do not use
them directly on untrusted input in a long-lived process.

Equations and inequalities are compared by real solution sets, not by
whether both happen to be true for one assignment. Multivariate relations
also support proven nonzero constant rescaling. Expression equivalence
requires a symbolic proof. Sampled assignments establish counterexamples
only, never equivalence. A counterexample is optional; when present its
values are exact integers.

Potentially zero symbolic denominators, zero-to-zero powers, noninteger
or symbolic powers, and unsupported proofs conservatively return
`ambiguous_domain` with an explanation. Identically zero denominators
return `invalid`. Domain hazards are tracked before simplification, even
inside terms that would otherwise cancel. Explicit domain assumptions
are not part of the request contract, so this service does not guess them.

The Python text parser preserves exact integer literals. The existing
TypeScript parser uses JavaScript Numbers, which may already have rounded
integers beyond the safe-integer range before JSON reaches this service.
Lost upstream precision cannot be recovered here; the bridge should reject
such literals or adopt an exact-integer wire representation in a future
contract revision. This component does not emulate that lossy rounding.
JSON decimal/exponent numbers are decoded exactly, without binary floats.

Timeout, memory, malformed-input, and worker-failure responses use the same
four-field response envelope as mathematical verdicts. They never report
an unproved `equivalent` result or expose a traceback.
