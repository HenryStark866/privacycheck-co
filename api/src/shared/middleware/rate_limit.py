"""Redis-backed sliding window rate limiting middleware.

Implements per-endpoint rate limits using Redis sorted sets (sliding window algorithm).
Gracefully degrades to allowing requests through if Redis is unavailable.
"""

import time
from typing import Callable

import redis.asyncio as redis
from starlette.middleware.base import BaseHTTPMiddleware, RequestResponseEndpoint
from starlette.requests import Request
from starlette.responses import JSONResponse, Response

from src.config import settings
from src.shared.middleware.security_logging import log_security_event


def _get_redis_client() -> redis.Redis | None:
    """Create a Redis client or return None if connection fails."""
    try:
        return redis.from_url(settings.redis_url, decode_responses=True)
    except Exception:
        return None


def _classify_path(path: str) -> str:
    """Classify a request path into a rate limit category.

    Categories:
        - auth: authentication endpoints
        - chat: AI chat endpoints
        - webhooks: channel webhook endpoints
        - other: all remaining endpoints
    """
    if "/auth" in path:
        return "auth"
    if "/chat" in path:
        return "chat"
    if "/webhooks" in path:
        return "webhooks"
    return "other"


def _get_limit_for_category(category: str) -> int:
    """Return the requests-per-minute limit for a given category."""
    limits = {
        "auth": settings.rate_limit_auth,
        "chat": settings.rate_limit_chat,
        "webhooks": settings.rate_limit_webhooks,
        "other": settings.rate_limit_default,
    }
    return limits.get(category, settings.rate_limit_default)


def _get_identifier(request: Request, category: str) -> str:
    """Determine the rate limit identifier based on category.

    - auth and webhooks: keyed by IP address
    - chat and other: keyed by user ID (falls back to IP if no user)
    """
    client_ip = request.client.host if request.client else "unknown"

    if category in ("auth", "webhooks"):
        return f"ip:{client_ip}"

    # For chat and other, try to use user ID from request state
    user_id = getattr(request.state, "user_id", None)
    if user_id:
        return f"user:{user_id}"

    # Fallback to IP if user is not yet authenticated
    return f"ip:{client_ip}"


class RateLimitMiddleware(BaseHTTPMiddleware):
    """Sliding window rate limiter backed by Redis.

    Uses sorted sets with timestamps as scores for accurate sliding window.
    Falls back to allowing requests through if Redis is unavailable.
    """

    def __init__(self, app, get_redis: Callable | None = None):
        super().__init__(app)
        self._get_redis = get_redis or _get_redis_client
        self._redis_client: redis.Redis | None = None

    async def _get_client(self) -> redis.Redis | None:
        """Get or create Redis client."""
        if self._redis_client is None:
            self._redis_client = self._get_redis()
        return self._redis_client

    async def dispatch(self, request: Request, call_next: RequestResponseEndpoint) -> Response:
        """Check rate limit before processing request."""
        path = request.url.path

        # Skip rate limiting for health endpoint
        if path == "/health":
            return await call_next(request)

        category = _classify_path(path)
        limit = _get_limit_for_category(category)
        identifier = _get_identifier(request, category)
        key = f"rate_limit:{identifier}:{category}"

        # Try sliding window check with Redis
        allowed, retry_after = await self._check_rate_limit(key, limit)

        if not allowed:
            client_ip = request.client.host if request.client else "unknown"
            log_security_event(
                event_type="rate_limit_exceeded",
                ip=client_ip,
                path=path,
                details={
                    "category": category,
                    "limit": limit,
                    "retry_after": retry_after,
                },
            )
            return JSONResponse(
                status_code=429,
                content={
                    "detail": "Too many requests. Please try again later.",
                    "retry_after": retry_after,
                },
                headers={"Retry-After": str(retry_after)},
            )

        response = await call_next(request)
        return response

    async def _check_rate_limit(self, key: str, limit: int) -> tuple[bool, int]:
        """Check if request is within rate limit using sliding window.

        Returns:
            Tuple of (is_allowed, retry_after_seconds).
            retry_after is 0 if allowed, otherwise seconds until the window resets.
        """
        try:
            client = await self._get_client()
            if client is None:
                # Graceful degradation: allow request if Redis unavailable
                return (True, 0)

            now = time.time()
            window_start = now - 60  # 1-minute window

            pipe = client.pipeline()
            # Remove entries outside the current window
            pipe.zremrangebyscore(key, 0, window_start)
            # Count current entries in the window
            pipe.zcard(key)
            # Add current request
            pipe.zadd(key, {f"{now}": now})
            # Set expiry on the key (cleanup after window passes)
            pipe.expire(key, 120)

            results = await pipe.execute()
            current_count = results[1]

            if current_count >= limit:
                # Get the oldest entry to calculate retry_after
                oldest = await client.zrange(key, 0, 0, withscores=True)
                if oldest:
                    oldest_time = oldest[0][1]
                    retry_after = int(oldest_time + 60 - now) + 1
                    retry_after = max(1, retry_after)
                else:
                    retry_after = 60

                # Remove the entry we just added since request is denied
                await client.zrem(key, f"{now}")
                return (False, retry_after)

            return (True, 0)

        except (redis.ConnectionError, redis.TimeoutError, OSError):
            # Graceful degradation: allow request if Redis errors occur
            return (True, 0)
        except Exception:
            # Any unexpected error: allow request through
            return (True, 0)
