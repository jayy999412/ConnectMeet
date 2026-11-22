"""Reusable route decorators: JSON body handling and in-memory rate limiting.

Rate limiting is deliberately dependency-free (no Redis/paid service) and is
best-effort per-process — enough to blunt credential-stuffing on a single free
web-service instance without introducing any paid infrastructure.
"""

from __future__ import annotations

import threading
import time
from collections import defaultdict, deque
from functools import wraps

from flask import current_app, jsonify, request

from .responses import err

_lock = threading.Lock()
_buckets: dict[str, deque] = defaultdict(deque)


def client_ip() -> str:
    forwarded = request.headers.get("X-Forwarded-For", "")
    if forwarded:
        return forwarded.split(",")[0].strip()
    return request.remote_addr or "unknown"


def json_payload() -> dict:
    """Return the JSON body (or an empty dict) without raising."""
    data = request.get_json(silent=True)
    return data if isinstance(data, dict) else {}


def rate_limit(max_requests: int = 30, window_seconds: int = 60, key_prefix: str | None = None):
    """Allow at most `max_requests` per `window_seconds` per client IP."""

    def decorator(view):
        @wraps(view)
        def wrapper(*args, **kwargs):
            if current_app.config.get("RATE_LIMIT_ENABLED", True):
                bucket_key = f"{key_prefix or view.__module__}.{view.__name__}:{client_ip()}"
                now = time.monotonic()
                with _lock:
                    queue = _buckets[bucket_key]
                    while queue and now - queue[0] > window_seconds:
                        queue.popleft()
                    if len(queue) >= max_requests:
                        retry_in = int(window_seconds - (now - queue[0])) + 1
                        payload, status = err(
                            "Too many attempts. Please wait a moment and try again.",
                            429,
                            code="rate_limited",
                        )
                        payload.headers["Retry-After"] = str(retry_in)
                        return payload, status
                    queue.append(now)
            return view(*args, **kwargs)

        return wrapper

    return decorator


def success(data=None, status: int = 200, message: str | None = None):  # pragma: no cover
    from .responses import ok

    return ok(data, status, message)
