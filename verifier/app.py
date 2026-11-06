"""Internal loopback HTTP service. Start with: python -m verifier.app."""

import asyncio
import json
import os
import threading

from fastapi import FastAPI, Request
from starlette.concurrency import run_in_threadpool
from starlette.responses import JSONResponse

from .limits import DEFAULT_TIMEOUT_SECONDS, MAX_REQUEST_BYTES, result, run_verification
from .parser import MathAstParseError, parse_json_integer, validate_request

app = FastAPI(openapi_url=None, docs_url=None, redoc_url=None, redirect_slashes=False)
_workers = threading.BoundedSemaphore(2)


def _reject_constant(_value):
    raise ValueError("nonfinite JSON number")


def _unique_object(pairs):
    value = {}
    for key, item in pairs:
        if key in value:
            raise ValueError("duplicate JSON key")
        value[key] = item
    return value


async def _read_body(request):
    body = bytearray()
    async for chunk in request.stream():
        if len(body) + len(chunk) > MAX_REQUEST_BYTES:
            raise ValueError("request body too large")
        body.extend(chunk)
    return body


@app.get("/health")
def health():
    return {"status": "ok"}


@app.post("/verify-step")
async def verify_step(request: Request):
    # Only the local Node bridge calls this service; browsers never call it
    # directly. Do not enable CORS or accept browser-origin requests here.
    if request.headers.get("origin") is not None:
        return JSONResponse(result("invalid", "origin_not_allowed", "Only backend requests are accepted."), status_code=403)
    if request.headers.get("content-type", "").split(";", 1)[0].strip().lower() != "application/json":
        return result("invalid", "invalid_input", "Expected an application/json body.")
    try:
        body = await asyncio.wait_for(_read_body(request), timeout=5)
        payload = json.loads(body, parse_float=parse_json_integer,
                             parse_constant=_reject_constant, object_pairs_hook=_unique_object)
        validate_request(payload)
    except MathAstParseError as error:
        return result("invalid", "invalid_input", f"{error} at position {error.position}.")
    except (ValueError, RecursionError, asyncio.TimeoutError):
        return result("invalid", "invalid_input", "Malformed, oversized, or incomplete JSON request.")
    if not _workers.acquire(blocking=False):
        return result("invalid", "verifier_busy", "Verifier worker capacity reached; retry later.")
    try:
        timeout = float(os.environ.get("OMT_VERIFIER_TIMEOUT_SECONDS", DEFAULT_TIMEOUT_SECONDS))
        return await run_in_threadpool(run_verification, payload, timeout_seconds=timeout)
    except ValueError:
        return result("invalid", "invalid_configuration", "Worker timeout must be positive and at most 5 seconds.")
    finally:
        _workers.release()


if __name__ == "__main__":
    import uvicorn

    uvicorn.run(app, host="127.0.0.1", port=4179, limit_concurrency=16)
