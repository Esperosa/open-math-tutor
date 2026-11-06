"""Input caps and disposable workers with OS memory and wall-clock limits."""

import json
import math
import multiprocessing
import os
import time

MAX_INPUT_LENGTH = 400
MAX_AST_NODES = 200
MAX_SYMBOLS = 6
DEFAULT_TIMEOUT_SECONDS = 2.0
HARD_TIMEOUT_SECONDS = 5.0
WORKER_MEMORY_BYTES = 512 * 1024 * 1024
MAX_REQUEST_BYTES = 64 * 1024


def result(status, reason, detail, counterexample=None):
    return {"status": status, "reason": reason, "detail": detail, "counterexample": counterexample}


def _windows_memory_limit(memory_bytes):
    """Windows fallback for POSIX RLIMIT_AS: a per-process Job Object cap.

    Nested jobs require Windows 8 or newer. Fail closed if the host job
    policy forbids assignment; never silently run an unrestricted worker.
    """
    import ctypes
    from ctypes import wintypes

    class BasicLimits(ctypes.Structure):
        _fields_ = [("process_time", ctypes.c_longlong), ("job_time", ctypes.c_longlong),
                    ("flags", wintypes.DWORD), ("min_working_set", ctypes.c_size_t),
                    ("max_working_set", ctypes.c_size_t), ("active_processes", wintypes.DWORD),
                    ("affinity", ctypes.c_size_t), ("priority", wintypes.DWORD),
                    ("scheduling", wintypes.DWORD)]

    class IoCounters(ctypes.Structure):
        _fields_ = [(name, ctypes.c_ulonglong) for name in
                    ("read_ops", "write_ops", "other_ops", "read_bytes", "write_bytes", "other_bytes")]

    class ExtendedLimits(ctypes.Structure):
        _fields_ = [("basic", BasicLimits), ("io", IoCounters),
                    ("process_memory", ctypes.c_size_t), ("job_memory", ctypes.c_size_t),
                    ("peak_process_memory", ctypes.c_size_t), ("peak_job_memory", ctypes.c_size_t)]

    kernel = ctypes.WinDLL("kernel32", use_last_error=True)
    kernel.CreateJobObjectW.argtypes = [ctypes.c_void_p, wintypes.LPCWSTR]
    kernel.CreateJobObjectW.restype = wintypes.HANDLE
    kernel.SetInformationJobObject.argtypes = [wintypes.HANDLE, ctypes.c_int, ctypes.c_void_p, wintypes.DWORD]
    kernel.SetInformationJobObject.restype = wintypes.BOOL
    kernel.AssignProcessToJobObject.argtypes = [wintypes.HANDLE, wintypes.HANDLE]
    kernel.AssignProcessToJobObject.restype = wintypes.BOOL
    kernel.GetCurrentProcess.restype = wintypes.HANDLE
    kernel.CloseHandle.argtypes = [wintypes.HANDLE]
    handle = kernel.CreateJobObjectW(None, None)
    if not handle:
        raise ctypes.WinError(ctypes.get_last_error())
    info = ExtendedLimits()
    info.basic.flags = 0x100  # JOB_OBJECT_LIMIT_PROCESS_MEMORY
    info.process_memory = memory_bytes
    if not kernel.SetInformationJobObject(handle, 9, ctypes.byref(info), ctypes.sizeof(info)):
        error = ctypes.WinError(ctypes.get_last_error())
        kernel.CloseHandle(handle)
        raise error
    if not kernel.AssignProcessToJobObject(handle, kernel.GetCurrentProcess()):
        error = ctypes.WinError(ctypes.get_last_error())
        kernel.CloseHandle(handle)
        raise error
    return kernel, handle


def _set_memory_limit(memory_bytes):
    if os.name == "nt":
        return _windows_memory_limit(memory_bytes)
    # RLIMIT_AS is POSIX-only. Windows uses the Job Object above. No signal
    # timers or thread cancellation: the parent kills the entire worker on
    # both platforms, including while SymPy/native code is busy.
    import resource

    _, hard = resource.getrlimit(resource.RLIMIT_AS)
    ceiling = memory_bytes if hard == resource.RLIM_INFINITY else min(memory_bytes, hard)
    resource.setrlimit(resource.RLIMIT_AS, (ceiling, ceiling))
    return None


def _worker(connection, function, args, memory_bytes):
    job = None
    try:
        job = _set_memory_limit(memory_bytes)
        response = function(*args)
    except MemoryError:
        response = result("invalid", "memory_limit", "Worker memory ceiling exceeded.")
    except OSError:
        response = result("invalid", "resource_limit", "Worker resource isolation failed.")
    except Exception:
        response = result("invalid", "verification_failed", "Verification could not be completed safely.")
    try:
        connection.send_bytes(json.dumps(response, allow_nan=False).encode("utf-8"))
    finally:
        connection.close()
        if job is not None:
            kernel, handle = job
            kernel.CloseHandle(handle)


def run_limited(function, args=(), *, timeout_seconds=DEFAULT_TIMEOUT_SECONDS,
                memory_bytes=WORKER_MEMORY_BYTES):
    """Run a trusted callable in a fresh spawned process, never a raw string.

    The deadline includes process startup/imports; all waits share it.
    Cleanup has a bounded 0.2s grace; reserve it inside the 5s hard cap.
    """
    if not math.isfinite(timeout_seconds) or timeout_seconds <= 0 or timeout_seconds > HARD_TIMEOUT_SECONDS:
        raise ValueError("timeout must be positive and at most 5 seconds")
    if type(memory_bytes) is not int or memory_bytes <= 0 or memory_bytes > WORKER_MEMORY_BYTES:
        raise ValueError("memory ceiling must be positive and at most 512 MiB")
    context = multiprocessing.get_context("spawn")
    receiver, sender = context.Pipe(duplex=False)
    worker = context.Process(target=_worker, args=(sender, function, args, memory_bytes), daemon=True)
    deadline = time.monotonic() + min(timeout_seconds, HARD_TIMEOUT_SECONDS - 0.2)
    started = False
    try:
        worker.start()
        started = True
        sender.close()
        if not receiver.poll(max(0, deadline - time.monotonic())):
            return result("invalid", "timeout", "Verification exceeded the wall-clock deadline.")
        try:
            response = json.loads(receiver.recv_bytes(8192))
        except (EOFError, OSError, ValueError):
            return result("invalid", "worker_failed", "Worker exited without a bounded result (possibly a memory limit).")
        worker.join(max(0, deadline - time.monotonic()))
        if worker.is_alive():
            return result("invalid", "timeout", "Verification exceeded the wall-clock deadline.")
        return response
    except (OSError, RuntimeError):
        return result("invalid", "worker_failed", "Unable to start isolated verification.")
    finally:
        sender.close()
        receiver.close()
        if started:
            if worker.is_alive():
                worker.kill()
                worker.join(0.2)
            if not worker.is_alive():
                worker.close()


def _verify_payload(payload):
    # Import the math engine only after OS limits are active in the worker.
    from .ast_builder import verify_step

    return verify_step(payload)


def run_verification(payload, *, timeout_seconds=DEFAULT_TIMEOUT_SECONDS):
    return run_limited(_verify_payload, (payload,), timeout_seconds=timeout_seconds)
