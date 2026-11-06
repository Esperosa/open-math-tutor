# Verifier service contract

Isolated Python 3 process. SymPy is the only math engine. **No `eval`,
`exec`, `sympy.sympify`, or `sympy.parse_expr` anywhere in this directory**
— this is enforced by a CI grep gate (`.github/workflows/ci.yml`) and is a
hard requirement, not a style preference.

## Why / what instead

Input never arrives as a free-form string to be parsed by a general
expression evaluator. It arrives as the tagged AST defined in
`../packages/shared/src/mathAst.ts`. Port that exact grammar to a Python
recursive-descent parser (`verifier/parser.py`) that tokenizes and parses
plain-grammar text (not LaTeX — LaTeX-to-plain-grammar normalization happens
in the Node bridge before this service is called) into the same node shape,
serialized as JSON:

```jsonc
{"kind": "num", "value": 2}
{"kind": "frac", "numerator": 1, "denominator": 2}
{"kind": "symbol", "name": "x"}
{"kind": "neg", "operand": <node>}
{"kind": "add", "left": <node>, "right": <node>}
{"kind": "sub", "left": <node>, "right": <node>}
{"kind": "mul", "left": <node>, "right": <node>}
{"kind": "div", "left": <node>, "right": <node>}
{"kind": "pow", "base": <node>, "exponent": <node>}
{"kind": "paren", "inner": <node>}
```

A relation wraps two such nodes: `{"op": "eq"|"lt"|"le"|"gt"|"ge", "lhs": <node>, "rhs": <node>}`.

`verifier/ast_builder.py` converts this JSON tree into real `sympy` objects
by switching on `kind`/`op` and recursing — `Symbol(name)` for `symbol`,
`Rational(numerator, denominator)` for `frac`, `Integer(value)` for `num`,
`sympy.Add`/`Mul`/`Pow`/`Eq`/etc. built directly from already-constructed
sympy objects. It never passes a string into any sympy parsing function.

Enforce before building: input length ≤ 400 chars, AST node count ≤ 200,
distinct symbol count ≤ 6 (mirrors `MAX_INPUT_LENGTH`/`MAX_AST_NODES`/
`MAX_SYMBOLS` in the TS contract). Reject anything over those limits with a
structured `invalid` response, not a 500.

## Resource limits

Each verification request must run under:

- a wall-clock timeout (recommend 2s; configurable, hard cap 5s),
- a memory ceiling for the worker process/subinterpreter,
- the node/symbol/length caps above, enforced *before* any sympy call.

Implementation approach is open (e.g. `resource.setrlimit` + `signal.alarm`
on POSIX, a `multiprocessing` worker with `terminate()` + timeout on
Windows, or a small process pool) — pick what is testable and works on the
CI runner (ubuntu-latest) and document the Windows caveat if the mechanism
differs there.

## HTTP contract

`POST /verify-step`

Request:

```jsonc
{
  "topic": "arithmetic" | "fractions" | "percentages" | "linear_equation",
  "task_statement": <MathStatement JSON or null>,   // the original problem, if applicable
  "previous_step": <MathStatement JSON or null>,
  "current_step": <MathStatement JSON>
}
```

Response:

```jsonc
{
  "status": "equivalent" | "not_equivalent" | "ambiguous_domain" | "invalid",
  "reason": "short machine-usable reason code, e.g. 'sign_lost_on_distribution'",
  "detail": "free text (not shown to student directly; the pedagogical phrasing is the Node/LLM layer's job)",
  "counterexample": { "symbol_values": {"x": 5} } | null
}
```

`GET /health` → `{"status": "ok"}`.

## Required test coverage (`verifier/tests/`, pytest)

Cover at least, with both a correct and an incorrect transformation per
bug class named in the task spec:

- Arithmetic, negative numbers, fractions, percentages, parentheses,
  linear equations (the MVP scope).
- Lost sign on distribution: `2(x+3)=14` → `2x+3=14` must be
  `not_equivalent`.
- Unused distributivity / wrong cancellation.
- Division by zero (must be `invalid` or `ambiguous_domain`, never a crash
  or a silent wrong answer).
- Sign flip omitted when multiplying/dividing an inequality by a negative
  number.
- Undefined expression forms / missing domain restriction →
  `ambiguous_domain` with an explanation, not a false `equivalent`.
- Parser-level: inputs exceeding length/node/symbol limits are rejected
  structurally (`invalid`), not by a timeout or exception leaking a stack
  trace.
- Security: attempt a handful of injection-shaped strings (e.g.
  `__import__('os')`, `; import os`, `lambda: 1`) through the HTTP endpoint
  and assert they are rejected as `invalid` by the parser, not executed.

## Files expected

```
verifier/
  app.py            # HTTP server (FastAPI or stdlib http.server — keep deps minimal)
  parser.py         # tokenizer + recursive-descent parser → tagged dict/AST
  ast_builder.py     # tagged AST → sympy objects (the only place sympy symbol/number
                      # construction happens); verification logic (equivalence,
                      # domain checks, sign tracking) also lives here or in verify.py
  limits.py         # shared constants + enforcement helpers
  requirements.txt
  tests/
    test_parser.py
    test_verify.py
    test_security.py
  SPEC.md           # this file
```

Keep dependencies minimal: `sympy`, one small HTTP framework (FastAPI +
uvicorn is fine, or stdlib `http.server` if you'd rather avoid the extra
dependency — either is acceptable), `pytest`, `httpx` or `requests` for
tests. No ORM, no database, no unrelated tooling.
