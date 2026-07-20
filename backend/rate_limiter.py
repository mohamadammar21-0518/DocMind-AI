"""
rate_limiter.py — Per-IP sliding-window rate limiting middleware for DocMind AI.

Uses an in-memory sliding window with a collections.deque of timestamps per IP.
No external dependencies (no Redis).  All counter operations are wrapped in
try/except so a rate-limiter failure never takes down the application.
"""

from __future__ import annotations

import logging
import time
from collections import defaultdict, deque
from typing import Any

from fastapi import Request
from fastapi.responses import JSONResponse
from starlette.middleware.base import BaseHTTPMiddleware, RequestResponseEndpoint
from starlette.responses import Response

logger = logging.getLogger(__name__)


# ── IP extraction ──────────────────────────────────────────────────────────────


def extract_client_ip(request: Request) -> str:
    """
    Return the client IP address for rate-limit tracking.

    Uses the leftmost token in the ``X-Forwarded-For`` header when present
    (Cloud Run load balancer sets this header).  Falls back to the direct
    connection IP otherwise.
    """
    forwarded_for = request.headers.get("X-Forwarded-For")
    if forwarded_for:
        # Take the leftmost (original client) IP, strip whitespace
        return forwarded_for.split(",")[0].strip()
    # Direct connection fallback
    if request.client:
        return request.client.host
    return "unknown"


# ── Sliding-window limiter ────────────────────────────────────────────────────


class SlidingWindowRateLimiter:
    """
    In-memory sliding-window rate limiter.

    Usage::

        limiter = SlidingWindowRateLimiter(limit=10, window_seconds=60)
        allowed, retry_after = limiter.check("192.168.1.1")
    """

    def __init__(self, limit: int, window_seconds: int) -> None:
        self.limit = limit
        self.window_seconds = window_seconds
        # ip -> deque of float timestamps (epoch seconds)
        self._windows: dict[str, deque] = defaultdict(deque)

    def check(self, ip: str) -> tuple[bool, int]:
        """
        Check whether *ip* is within its rate limit.

        Evicts timestamps outside the window, then:
        - If count >= limit: returns ``(False, seconds_until_reset)``
        - Else: records the current timestamp and returns ``(True, 0)``

        All internal operations are wrapped in try/except.  On any error the
        request is allowed and a warning is logged.
        """
        try:
            now = time.time()
            window_start = now - self.window_seconds
            dq = self._windows[ip]

            # Evict timestamps that have fallen outside the window
            while dq and dq[0] < window_start:
                dq.popleft()

            if len(dq) >= self.limit:
                # Seconds until the oldest request falls out of the window
                retry_after = int(dq[0] - window_start) + 1
                return False, retry_after

            # Record this request
            dq.append(now)
            return True, 0

        except Exception as exc:
            logger.warning("RateLimiter.check error for ip=%s: %s", ip, exc)
            # Fail open — never block a request due to limiter internals
            return True, 0


# ── Middleware ─────────────────────────────────────────────────────────────────


class RateLimitMiddleware(BaseHTTPMiddleware):
    """
    FastAPI/Starlette middleware that enforces per-IP rate limits on
    ``/upload`` (10 req / 60 s) and ``/chat`` + ``/chat/stream``
    (30 req / 60 s).

    On rejection returns::

        HTTP 429 {"error": "Rate limit exceeded", "retry_after_seconds": N}

    On any internal error the request is allowed and a warning is logged.
    """

    # Limits defined as class attributes for easy testing / subclassing
    UPLOAD_LIMIT: int = 10
    CHAT_LIMIT: int = 30
    WINDOW_SECONDS: int = 60

    def __init__(self, app: Any) -> None:
        super().__init__(app)
        self._upload_limiter = SlidingWindowRateLimiter(
            limit=self.UPLOAD_LIMIT,
            window_seconds=self.WINDOW_SECONDS,
        )
        self._chat_limiter = SlidingWindowRateLimiter(
            limit=self.CHAT_LIMIT,
            window_seconds=self.WINDOW_SECONDS,
        )

    async def dispatch(
        self, request: Request, call_next: RequestResponseEndpoint
    ) -> Response:
        try:
            path = request.url.path

            # Determine which limiter applies (if any)
            if path == "/upload":
                limiter = self._upload_limiter
            elif path in ("/chat", "/chat/stream"):
                limiter = self._chat_limiter
            else:
                # Not a rate-limited route — pass through immediately
                return await call_next(request)

            ip = extract_client_ip(request)
            allowed, retry_after = limiter.check(ip)

            if not allowed:
                logger.warning(
                    "Rate limit exceeded: ip=%s path=%s retry_after=%ds",
                    ip, path, retry_after,
                )
                return JSONResponse(
                    status_code=429,
                    content={
                        "error": "Rate limit exceeded",
                        "retry_after_seconds": retry_after,
                    },
                    headers={"Retry-After": str(retry_after)},
                )

        except Exception as exc:
            logger.warning("RateLimitMiddleware error: %s", exc)
            # Fail open — never block legitimate traffic due to middleware errors

        return await call_next(request)
