import json
import multiprocessing
import re
import time
from pathlib import Path

import pytest
from fastapi.testclient import TestClient

from verifier import app as app_module
from verifier.limits import MAX_REQUEST_BYTES, run_limited
from verifier.parser import parse_math_statement


@pytest.fixture
def client():
    with TestClient(app_module.app) as instance:
        yield instance


def payload(current=None):
    return {"topic": "linear_equation", "task_statement": None,
            "previous_step": parse_math_statement("2(x+3)=14"),
            "current_step": parse_math_statement("2x+3=14") if current is None else current}


def no_worker(*_args, **_kwargs):
    pytest.fail("Invalid input reached the SymPy worker")


@pytest.mark.parametrize("attack", ["__import__('os')", "; import os", "lambda: 1", "x; DROP TABLE",
                                    "open('owned','w')", "x.__class__", "[x for x in y]", "x[0]",
                                    "import os", "{x:1}", "`id`", "$(id)"])
def test_injection_text_rejected_by_parser_before_worker(client, monkeypatch, attack):
    monkeypatch.setattr(app_module, "run_verification", no_worker)
    response = client.post("/verify-step", json=payload(attack))
    assert response.status_code == 200
    body = response.json()
    assert body["status"] == "invalid"
    assert "unexpected character" in body["detail"] or "too many distinct symbols" in body["detail"]
    assert body["counterexample"] is None


@pytest.mark.parametrize("node", [
    {"kind": "call", "name": "sin", "args": []},
    {"kind": "symbol", "name": "__import__"},
    {"kind": "symbol", "name": "xx"},
    {"kind": "symbol", "name": "π"},
    {"kind": "symbol", "name": ["x"]},
    {"kind": "num", "value": "1+1"},
    {"kind": "num", "value": True},
    {"kind": "num", "value": 1.5},
    {"kind": "num", "value": -1},
    {"kind": "num", "value": 10 ** 400},
    {"kind": "num", "value": 1, "code": "untrusted"},
    {"kind": "frac", "numerator": 1},
    {"kind": "frac", "numerator": 1, "denominator": "2"},
    {"kind": "mul", "left": None, "right": None},
    {"kind": ["num"], "value": 1},
    None, [], 1,
])
def test_malicious_or_malformed_ast_never_reaches_math(client, monkeypatch, node):
    monkeypatch.setattr(app_module, "run_verification", no_worker)
    response = client.post("/verify-step", json=payload({"form": "expression", "value": node}))
    assert response.status_code == 200
    assert response.json()["status"] == "invalid"


def test_invalid_relations_and_envelopes(client, monkeypatch):
    monkeypatch.setattr(app_module, "run_verification", no_worker)
    bad_relation = {"form": "relation", "value": {"op": "ne", "lhs": {"kind": "num", "value": 1},
                                                  "rhs": {"kind": "num", "value": 2}}}
    invalid = [None, [], {}, {**payload(), "topic": "calculus"},
               {**payload(), "topic": []}, {**payload(), "current_step": bad_relation},
               {**payload(), "current_step": {"form": "call", "value": {}}},
               {**payload(), "previous_step": None},
               {**payload(), "current_step": None}, {**payload(), "extra": True}]
    for body in invalid:
        response = client.post("/verify-step", content=json.dumps(body), headers={"content-type": "application/json"})
        assert response.status_code == 200
        assert response.json()["status"] == "invalid"


def test_plain_valid_text_is_not_the_http_ast_contract(client, monkeypatch):
    monkeypatch.setattr(app_module, "run_verification", no_worker)
    assert client.post("/verify-step", json=payload("x=4")).json()["status"] == "invalid"


def test_limits_fail_structurally_at_http_boundary(client, monkeypatch):
    monkeypatch.setattr(app_module, "run_verification", no_worker)
    node = {"kind": "num", "value": 1}
    for _ in range(200):
        node = {"kind": "neg", "operand": node}
    sources = ["1" * 401, "-" * 200 + "1", "abcdefg", {"form": "expression", "value": node}]
    for source in sources:
        response = client.post("/verify-step", json=payload(source))
        assert response.status_code == 200
        assert response.json()["status"] == "invalid"
        assert response.json()["reason"] == "invalid_input"


@pytest.mark.parametrize("body", [b"{", b"null", b"{\"x\":NaN}", b"{\"x\":Infinity}", b"{\"x\":1,\"x\":2}",
                                  b"\xff", b"[" * 1500, b" " * (MAX_REQUEST_BYTES + 1)],
                         ids=["open-brace", "null", "nan", "infinity", "duplicate-key", "bad-utf8", "deep-nesting", "oversized"])
def test_malformed_and_oversized_json(client, body):
    response = client.post("/verify-step", content=body, headers={"content-type": "application/json"})
    assert response.status_code == 200
    assert response.json()["status"] == "invalid"


def test_http_normal_request_and_health(client):
    assert client.get("/health").json() == {"status": "ok"}
    response = client.post("/verify-step", json=payload())
    assert response.status_code == 200
    assert response.json()["status"] == "not_equivalent", response.json()
    assert set(response.json()) == {"status", "reason", "detail", "counterexample"}
    body = payload(parse_math_statement("x=4"))
    body["task_statement"], body["previous_step"] = body["previous_step"], None
    assert client.post("/verify-step", json=body).json()["status"] == "equivalent"


@pytest.mark.parametrize("exponent", [21, 23])
def test_js_exponent_notation_integer_json_is_accepted(client, exponent):
    statement = {"form": "expression", "value": {"kind": "num", "value": float(f"1e{exponent}")}}
    body = payload(statement)
    body["previous_step"] = parse_math_statement(f"10^{exponent}")
    assert client.post("/verify-step", json=body).json()["status"] == "equivalent"
    body["previous_step"] = parse_math_statement(str(int(statement["value"]["value"]) - 1))
    assert client.post("/verify-step", json=body).json()["status"] == "not_equivalent"
    if exponent == 23:
        body["previous_step"] = parse_math_statement(str(int(statement["value"]["value"])))
        assert client.post("/verify-step", json=body).json()["status"] == "not_equivalent"


def test_only_requested_routes_and_no_browser_origin(client):
    for route in ("/docs", "/redoc", "/openapi.json", "/verify-step/", "/unknown"):
        assert client.get(route, follow_redirects=False).status_code == 404
    assert client.get("/verify-step").status_code == 405
    assert client.post("/verify-step", json=payload(), headers={"origin": "https://evil.example"}).status_code == 403
    assert client.post("/verify-step", content="x=1").json()["status"] == "invalid"


def test_invalid_configuration_and_worker_capacity(client, monkeypatch):
    monkeypatch.setenv("OMT_VERIFIER_TIMEOUT_SECONDS", "6")
    assert client.post("/verify-step", json=payload()).json()["reason"] == "invalid_configuration"
    monkeypatch.setenv("OMT_VERIFIER_TIMEOUT_SECONDS", "not-a-number")
    assert client.post("/verify-step", json=payload()).json()["reason"] == "invalid_configuration"
    app_module._workers.acquire()
    app_module._workers.acquire()
    try:
        assert client.post("/verify-step", json=payload()).json()["reason"] == "verifier_busy"
    finally:
        app_module._workers.release()
        app_module._workers.release()


def _sleep_worker():
    time.sleep(10)
    return {"status": "should_not_arrive"}


def _memory_worker():
    allocation = bytearray(256 * 1024 * 1024)
    return {"status": "should_not_arrive", "size": len(allocation)}


def test_worker_timeout_kills_and_reaps_child():
    before = {p.pid for p in multiprocessing.active_children()}
    started = time.monotonic()
    response = run_limited(_sleep_worker, timeout_seconds=0.3)
    assert response["status"] == "invalid"
    assert response["reason"] == "timeout"
    assert time.monotonic() - started < 2
    assert {p.pid for p in multiprocessing.active_children()} == before


def test_worker_os_memory_ceiling_is_enforced():
    response = run_limited(_memory_worker, timeout_seconds=5, memory_bytes=128 * 1024 * 1024)
    assert response["status"] == "invalid", response
    assert response["reason"] in {"memory_limit", "worker_failed"}, response


def test_resource_configuration_cannot_exceed_hard_caps():
    for timeout in (0, -1, 5.01, float("nan"), float("inf")):
        with pytest.raises(ValueError):
            run_limited(_sleep_worker, timeout_seconds=timeout)
    with pytest.raises(ValueError):
        run_limited(_sleep_worker, memory_bytes=1024 ** 3)


def test_hostile_power_cannot_escape_worker_limits(client):
    body = payload(parse_math_statement("9^(9^9)"))
    body["previous_step"] = parse_math_statement("1")
    start = time.monotonic()
    response = client.post("/verify-step", json=body).json()
    assert response["status"] == "invalid", response
    assert time.monotonic() - start < 5
    assert client.get("/health").json() == {"status": "ok"}


def test_no_forbidden_calls_in_verifier_sources():
    pattern = re.compile(r"\b(?:eval|exec|sympify|parse_expr)\s*\(")
    for path in Path(__file__).resolve().parents[1].rglob("*.py"):
        assert not pattern.search(path.read_text(encoding="utf-8")), str(path)


def test_validation_precedes_sympy_construction(monkeypatch):
    from verifier import ast_builder

    monkeypatch.setattr(ast_builder._Builder, "node", no_worker)
    body = payload({"form": "expression", "value": {"kind": "symbol", "name": "bad"}})
    assert ast_builder.verify_step(body)["status"] == "invalid"
