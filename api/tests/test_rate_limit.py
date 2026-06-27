"""Tests for rate limiting middleware, security headers, and security logging."""

import time
import logging
import json
from unittest.mock import AsyncMock, MagicMock, patch

import pytest
from fastapi import FastAPI, Request
from fastapi.testclient import TestClient
from starlette.middleware.base import BaseHTTPMiddleware

from src.shared.middleware.rate_limit import (
    RateLimitMiddleware,
    _classify_path,
    _get_identifier,
    _get_limit_for_category,
)
from src.shared.middleware.security_headers import SecurityHeadersMiddleware
from src.shared.middleware.security_logging import (
    _sanitize_details,
    log_failed_auth,
    log_security_event,
    log_validation_failure,
)


# --- Helper: Create a test app with middleware ---


def create_test_app(redis_mock=None):
    """Create a minimal FastAPI app with rate limit and security headers middleware."""
    app = FastAPI()

    # Middleware order: last added = outermost (runs first on request).
    # SecurityHeaders outermost ensures headers on ALL responses (including 429).
    app.add_middleware(RateLimitMiddleware, get_redis=lambda: redis_mock)
    app.add_middleware(SecurityHeadersMiddleware)

    @app.get("/health")
    async def health():
        return {"status": "ok"}

    @app.post("/api/v1/auth/login")
    async def auth_login():
        return {"token": "fake"}

    @app.post("/api/v1/chat/message")
    async def chat_message():
        return {"reply": "hello"}

    @app.post("/webhooks/whatsapp")
    async def webhook_whatsapp():
        return {"ok": True}

    @app.get("/api/v1/empresas")
    async def list_empresas():
        return {"empresas": []}

    return app


# --- Tests for path classification ---


class TestPathClassification:
    """Tests for _classify_path function."""

    def test_auth_paths(self):
        assert _classify_path("/api/v1/auth/login") == "auth"
        assert _classify_path("/api/v1/auth/me") == "auth"

    def test_chat_paths(self):
        assert _classify_path("/api/v1/chat/message") == "chat"
        assert _classify_path("/api/v1/chat/stream") == "chat"

    def test_webhook_paths(self):
        assert _classify_path("/webhooks/whatsapp") == "webhooks"
        assert _classify_path("/webhooks/telegram") == "webhooks"

    def test_other_paths(self):
        assert _classify_path("/api/v1/empresas") == "other"
        assert _classify_path("/api/v1/evaluaciones") == "other"
        assert _classify_path("/api/v1/diagnostico/score") == "other"

    def test_health_is_other(self):
        # Health is classified as 'other' but skipped by middleware logic
        assert _classify_path("/health") == "other"


# --- Tests for rate limit category limits ---


class TestRateLimitCategories:
    """Tests for rate limit configuration per category."""

    def test_auth_limit(self):
        assert _get_limit_for_category("auth") == 10

    def test_chat_limit(self):
        assert _get_limit_for_category("chat") == 30

    def test_webhooks_limit(self):
        assert _get_limit_for_category("webhooks") == 100

    def test_other_limit(self):
        assert _get_limit_for_category("other") == 60

    def test_unknown_category_defaults(self):
        assert _get_limit_for_category("nonexistent") == 60


# --- Tests for identifier extraction ---


class TestIdentifierExtraction:
    """Tests for _get_identifier based on category."""

    def _make_request(self, ip="127.0.0.1", user_id=None):
        """Create a mock request with client and state."""
        request = MagicMock(spec=Request)
        request.client = MagicMock()
        request.client.host = ip
        request.state = MagicMock()
        if user_id:
            request.state.user_id = user_id
        else:
            # Simulate missing user_id attribute
            del request.state.user_id
        return request

    def test_auth_uses_ip(self):
        request = self._make_request(ip="10.0.0.1", user_id="user-123")
        assert _get_identifier(request, "auth") == "ip:10.0.0.1"

    def test_webhooks_uses_ip(self):
        request = self._make_request(ip="192.168.1.1")
        assert _get_identifier(request, "webhooks") == "ip:192.168.1.1"

    def test_chat_uses_user_id_when_available(self):
        request = self._make_request(ip="10.0.0.1", user_id="user-456")
        assert _get_identifier(request, "chat") == "user:user-456"

    def test_chat_falls_back_to_ip(self):
        request = self._make_request(ip="10.0.0.1")
        assert _get_identifier(request, "chat") == "ip:10.0.0.1"

    def test_other_uses_user_id_when_available(self):
        request = self._make_request(ip="10.0.0.1", user_id="user-789")
        assert _get_identifier(request, "other") == "user:user-789"


# --- Tests for rate limiting behavior (boundary tests) ---


class TestRateLimitMiddleware:
    """Integration tests for rate limit middleware behavior."""

    def test_health_endpoint_skips_rate_limit(self):
        """Health endpoint should never be rate limited."""
        app = create_test_app(redis_mock=None)
        client = TestClient(app)

        # Even with no Redis (graceful degradation), health always passes
        for _ in range(200):
            response = client.get("/health")
            assert response.status_code == 200

    def test_graceful_degradation_when_redis_unavailable(self):
        """When Redis is None/unavailable, requests should be allowed through."""
        app = create_test_app(redis_mock=None)
        client = TestClient(app)

        response = client.post("/api/v1/auth/login")
        assert response.status_code == 200

    def test_rate_limit_returns_429_with_retry_after(self):
        """When rate limit is exceeded, return 429 with Retry-After header."""
        # Create a mock Redis that simulates limit being exceeded
        mock_redis = MagicMock()
        mock_pipe = MagicMock()

        # Simulate: zremrangebyscore succeeds, zcard returns count at limit
        mock_pipe.zremrangebyscore = MagicMock(return_value=mock_pipe)
        mock_pipe.zcard = MagicMock(return_value=mock_pipe)
        mock_pipe.zadd = MagicMock(return_value=mock_pipe)
        mock_pipe.expire = MagicMock(return_value=mock_pipe)

        async def mock_execute():
            return [0, 10, True, True]  # count = 10 (at auth limit)

        mock_pipe.execute = mock_execute
        mock_redis.pipeline = MagicMock(return_value=mock_pipe)

        # Mock zrange to return oldest entry
        now = time.time()

        async def mock_zrange(*args, **kwargs):
            return [("entry", now - 30)]  # 30 seconds old

        mock_redis.zrange = mock_zrange

        # Mock zrem
        async def mock_zrem(*args):
            return 1

        mock_redis.zrem = mock_zrem

        app = create_test_app(redis_mock=mock_redis)
        client = TestClient(app)

        response = client.post("/api/v1/auth/login")
        assert response.status_code == 429
        assert "Retry-After" in response.headers
        assert int(response.headers["Retry-After"]) > 0

        body = response.json()
        assert "detail" in body
        assert "retry_after" in body

    def test_allows_request_when_under_limit(self):
        """When request count is below limit, request should pass through."""
        mock_redis = MagicMock()
        mock_pipe = MagicMock()

        mock_pipe.zremrangebyscore = MagicMock(return_value=mock_pipe)
        mock_pipe.zcard = MagicMock(return_value=mock_pipe)
        mock_pipe.zadd = MagicMock(return_value=mock_pipe)
        mock_pipe.expire = MagicMock(return_value=mock_pipe)

        async def mock_execute():
            return [0, 5, True, True]  # count = 5 (under auth limit of 10)

        mock_pipe.execute = mock_execute
        mock_redis.pipeline = MagicMock(return_value=mock_pipe)

        app = create_test_app(redis_mock=mock_redis)
        client = TestClient(app)

        response = client.post("/api/v1/auth/login")
        assert response.status_code == 200

    def test_redis_connection_error_allows_request(self):
        """If Redis raises a connection error, request should pass through."""
        import redis as redis_lib

        mock_redis = MagicMock()
        mock_pipe = MagicMock()
        mock_pipe.zremrangebyscore = MagicMock(return_value=mock_pipe)
        mock_pipe.zcard = MagicMock(return_value=mock_pipe)
        mock_pipe.zadd = MagicMock(return_value=mock_pipe)
        mock_pipe.expire = MagicMock(return_value=mock_pipe)

        async def mock_execute():
            raise redis_lib.ConnectionError("Connection refused")

        mock_pipe.execute = mock_execute
        mock_redis.pipeline = MagicMock(return_value=mock_pipe)

        app = create_test_app(redis_mock=mock_redis)
        client = TestClient(app)

        response = client.post("/api/v1/auth/login")
        assert response.status_code == 200


# --- Tests for security headers on all responses ---


class TestSecurityHeaders:
    """Tests that security headers are present on ALL responses."""

    def setup_method(self):
        self.app = create_test_app(redis_mock=None)
        self.client = TestClient(self.app)

    def test_headers_on_success_response(self):
        """Security headers should be present on 200 responses."""
        response = self.client.get("/health")
        assert response.status_code == 200
        assert response.headers["X-Content-Type-Options"] == "nosniff"
        assert response.headers["X-Frame-Options"] == "DENY"
        assert "max-age=31536000" in response.headers["Strict-Transport-Security"]
        assert response.headers["Content-Security-Policy"] == "default-src 'self'"
        assert response.headers["X-XSS-Protection"] == "1; mode=block"
        assert "strict-origin-when-cross-origin" in response.headers["Referrer-Policy"]

    def test_headers_on_not_found_response(self):
        """Security headers should be present on 404 responses."""
        response = self.client.get("/nonexistent")
        assert response.status_code == 404
        assert response.headers["X-Content-Type-Options"] == "nosniff"
        assert response.headers["X-Frame-Options"] == "DENY"

    def test_headers_on_rate_limited_response(self):
        """Security headers should be present on 429 responses."""
        mock_redis = MagicMock()
        mock_pipe = MagicMock()
        mock_pipe.zremrangebyscore = MagicMock(return_value=mock_pipe)
        mock_pipe.zcard = MagicMock(return_value=mock_pipe)
        mock_pipe.zadd = MagicMock(return_value=mock_pipe)
        mock_pipe.expire = MagicMock(return_value=mock_pipe)

        now = time.time()

        async def mock_execute():
            return [0, 10, True, True]

        mock_pipe.execute = mock_execute
        mock_redis.pipeline = MagicMock(return_value=mock_pipe)

        async def mock_zrange(*args, **kwargs):
            return [("entry", now - 10)]

        mock_redis.zrange = mock_zrange

        async def mock_zrem(*args):
            return 1

        mock_redis.zrem = mock_zrem

        app = create_test_app(redis_mock=mock_redis)
        client = TestClient(app)

        response = client.post("/api/v1/auth/login")
        assert response.status_code == 429
        assert response.headers["X-Content-Type-Options"] == "nosniff"
        assert response.headers["X-Frame-Options"] == "DENY"


# --- Tests for security logging ---


class TestSecurityLogging:
    """Tests for structured security event logging."""

    def test_sanitize_removes_sensitive_keys(self):
        """Sensitive fields should be redacted."""
        details = {
            "password": "secret123",
            "token": "jwt.xxx.yyy",
            "username": "testuser",
            "path": "/api/v1/auth",
        }
        result = _sanitize_details(details)
        assert result["password"] == "[REDACTED]"
        assert result["token"] == "[REDACTED]"
        assert result["username"] == "testuser"
        assert result["path"] == "/api/v1/auth"

    def test_sanitize_handles_nested_dicts(self):
        """Nested dictionaries should also be sanitized."""
        details = {
            "headers": {
                "authorization": "Bearer xyz",
                "content-type": "application/json",
            }
        }
        result = _sanitize_details(details)
        assert result["headers"]["authorization"] == "[REDACTED]"
        assert result["headers"]["content-type"] == "application/json"

    def test_sanitize_handles_none(self):
        """None input should return empty dict."""
        assert _sanitize_details(None) == {}

    def test_log_security_event_outputs_json(self, caplog):
        """Security events should be logged as structured JSON."""
        with caplog.at_level(logging.WARNING, logger="habeas_check.security"):
            log_security_event(
                event_type="test_event",
                ip="192.168.1.1",
                path="/api/v1/test",
                user_id="user-abc",
                details={"reason": "testing"},
            )

        assert len(caplog.records) == 1
        event = json.loads(caplog.records[0].message)
        assert event["event_type"] == "test_event"
        assert event["ip"] == "192.168.1.1"
        assert event["path"] == "/api/v1/test"
        assert event["user_id"] == "user-abc"
        assert "timestamp" in event
        assert event["details"]["reason"] == "testing"

    def test_log_failed_auth(self, caplog):
        """Failed auth events should include reason without sensitive data."""
        with caplog.at_level(logging.WARNING, logger="habeas_check.security"):
            log_failed_auth(
                ip="10.0.0.5",
                path="/api/v1/auth/me",
                reason="expired_token",
            )

        assert len(caplog.records) == 1
        event = json.loads(caplog.records[0].message)
        assert event["event_type"] == "failed_auth"
        assert event["details"]["reason"] == "expired_token"
        assert "token" not in event.get("details", {}).get("data", "")

    def test_log_validation_failure(self, caplog):
        """Validation failures should include field locations but not values."""
        errors = [
            {"loc": ["body", "email"], "type": "value_error", "msg": "invalid email"},
            {"loc": ["body", "nit"], "type": "string_type", "msg": "not a string"},
        ]

        with caplog.at_level(logging.WARNING, logger="habeas_check.security"):
            log_validation_failure(
                ip="10.0.0.10",
                path="/api/v1/empresas",
                errors=errors,
                user_id="user-xyz",
            )

        assert len(caplog.records) == 1
        event = json.loads(caplog.records[0].message)
        assert event["event_type"] == "validation_failure"
        assert event["user_id"] == "user-xyz"
        assert len(event["details"]["errors"]) == 2
        assert event["details"]["errors"][0]["loc"] == ["body", "email"]

    def test_log_security_event_excludes_none_values(self, caplog):
        """Log entries should not include keys with None values."""
        with caplog.at_level(logging.WARNING, logger="habeas_check.security"):
            log_security_event(
                event_type="rate_limit_exceeded",
                ip="1.2.3.4",
                path="/api/v1/chat/message",
            )

        event = json.loads(caplog.records[0].message)
        assert "user_id" not in event
        assert "ip" in event


# --- Test for Pydantic 422 response format ---


class TestValidationErrorResponse:
    """Tests that Pydantic validation returns 422 with field-level errors."""

    def test_pydantic_422_format(self):
        """Validation errors should return 422 with field-level detail."""
        from pydantic import BaseModel, Field
        from fastapi import FastAPI
        from fastapi.exceptions import RequestValidationError
        from fastapi.testclient import TestClient

        app = FastAPI()

        @app.exception_handler(RequestValidationError)
        async def handler(request, exc):
            from fastapi.responses import JSONResponse

            return JSONResponse(
                status_code=422,
                content={"detail": exc.errors()},
            )

        class TestBody(BaseModel):
            name: str = Field(..., min_length=1)
            age: int = Field(..., gt=0)

        @app.post("/test")
        async def test_endpoint(body: TestBody):
            return {"ok": True}

        client = TestClient(app)
        response = client.post("/test", json={"name": "", "age": -1})
        assert response.status_code == 422
        body = response.json()
        assert "detail" in body
        # Should have field-level errors
        assert len(body["detail"]) >= 1
        # Each error should have loc, msg, type
        for error in body["detail"]:
            assert "loc" in error
            assert "msg" in error
            assert "type" in error
