"""Structured logging for security events.

Logs security-relevant events (failed auth, rate limits, validation failures)
with sufficient detail for audit without including sensitive data.

Events include: timestamp, event_type, IP, path, user_id (if available).
NEVER includes: passwords, tokens, request bodies with sensitive data.
"""

import logging
import json
from datetime import datetime, timezone
from typing import Any

# Configure a dedicated security logger
security_logger = logging.getLogger("habeas_check.security")


def _sanitize_details(details: dict[str, Any] | None) -> dict[str, Any]:
    """Remove sensitive fields from log details.

    Strips passwords, tokens, authorization headers, and request bodies
    that could contain personal data.
    """
    if details is None:
        return {}

    sensitive_keys = {
        "password",
        "token",
        "access_token",
        "refresh_token",
        "authorization",
        "secret",
        "api_key",
        "credentials",
        "body",
    }

    sanitized = {}
    for key, value in details.items():
        if key.lower() in sensitive_keys:
            sanitized[key] = "[REDACTED]"
        elif isinstance(value, dict):
            sanitized[key] = _sanitize_details(value)
        else:
            sanitized[key] = value

    return sanitized


def log_security_event(
    event_type: str,
    ip: str | None = None,
    path: str | None = None,
    user_id: str | None = None,
    details: dict[str, Any] | None = None,
) -> None:
    """Log a structured security event.

    Args:
        event_type: Type of security event (e.g., "failed_auth", "rate_limit_exceeded",
                    "validation_failure").
        ip: Client IP address.
        path: Request path that triggered the event.
        user_id: Authenticated user ID if available.
        details: Additional context (will be sanitized to remove sensitive data).
    """
    event = {
        "timestamp": datetime.now(timezone.utc).isoformat(),
        "event_type": event_type,
        "ip": ip,
        "path": path,
        "user_id": user_id,
        "details": _sanitize_details(details),
    }

    # Remove None values for cleaner logs
    event = {k: v for k, v in event.items() if v is not None}

    security_logger.warning(json.dumps(event))


def log_failed_auth(
    ip: str,
    path: str,
    reason: str,
    user_id: str | None = None,
) -> None:
    """Log a failed authentication attempt.

    Args:
        ip: Client IP address.
        path: The endpoint that was accessed.
        reason: Why authentication failed (e.g., "expired_token", "invalid_signature").
        user_id: User ID if extractable from the token.
    """
    log_security_event(
        event_type="failed_auth",
        ip=ip,
        path=path,
        user_id=user_id,
        details={"reason": reason},
    )


def log_validation_failure(
    ip: str,
    path: str,
    errors: list[dict[str, Any]],
    user_id: str | None = None,
) -> None:
    """Log a request validation failure (422).

    Args:
        ip: Client IP address.
        path: The endpoint that was accessed.
        errors: List of validation error details (field locations and messages only).
        user_id: User ID if authenticated.
    """
    # Only include field location and error type, never the actual values
    safe_errors = []
    for error in errors:
        safe_error = {
            "loc": error.get("loc"),
            "type": error.get("type"),
            "msg": error.get("msg"),
        }
        safe_errors.append(safe_error)

    log_security_event(
        event_type="validation_failure",
        ip=ip,
        path=path,
        user_id=user_id,
        details={"errors": safe_errors},
    )
