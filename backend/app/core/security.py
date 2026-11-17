"""API key protection for privileged endpoints + a small in-memory rate limiter.

Public read-only dashboard endpoints stay unauthenticated. Ingestion,
simulator control, satellite sync, analytics execution and alert mutation
require the ``X-API-Key`` header.
"""

from __future__ import annotations

import secrets
import time
from collections import deque

from fastapi import Header, HTTPException, Request, status

from app.core.config import settings


def _valid_keys() -> list[str]:
    keys: list[str] = []
    if settings.api_secret_key:
        keys.append(settings.api_secret_key)
    if settings.demo_mode and settings.demo_api_key:
        keys.append(settings.demo_api_key)
    return keys


async def require_api_key(x_api_key: str | None = Header(default=None)) -> str:
    """FastAPI dependency. Fails closed when no key is configured."""
    valid = _valid_keys()
    if not valid:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="No API key configured on the server. Set API_SECRET_KEY.",
        )
    if not x_api_key:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Missing X-API-Key header.",
        )
    for key in valid:
        if secrets.compare_digest(x_api_key, key):
            return "demo" if settings.demo_mode and x_api_key == settings.demo_api_key else "operator"
    raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid API key.")


class SlidingWindowLimiter:
    """Per-process limiter. Documented limitation: not shared across workers."""

    def __init__(self, limit: int, window_seconds: float = 60.0) -> None:
        self.limit = max(limit, 1)
        self.window_seconds = window_seconds
        self._hits: dict[str, deque[float]] = {}

    def hit(self, key: str) -> None:
        now = time.monotonic()
        bucket = self._hits.setdefault(key, deque())
        while bucket and now - bucket[0] > self.window_seconds:
            bucket.popleft()
        if len(bucket) >= self.limit:
            retry_after = int(self.window_seconds - (now - bucket[0])) + 1
            raise HTTPException(
                status_code=status.HTTP_429_TOO_MANY_REQUESTS,
                detail="Rate limit exceeded for ingestion. Retry later.",
                headers={"Retry-After": str(retry_after)},
            )
        bucket.append(now)


ingestion_limiter = SlidingWindowLimiter(settings.ingestion_rate_limit_per_minute)


async def limit_ingestion(request: Request) -> None:
    client = request.client.host if request.client else "unknown"
    ingestion_limiter.hit(client)
