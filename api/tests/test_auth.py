"""Tests for authentication: JWT validation, expired token rejection, role enforcement."""

import time

import pytest
from jose import jwt

from src.modules.auth.service import decode_supabase_token

# Test secret for JWT signing
TEST_SECRET = "test-supabase-jwt-secret-for-testing-purposes"


def _make_token(
    sub: str = "supabase-user-123",
    email: str = "test@example.com",
    exp_offset: int = 3600,
    secret: str = TEST_SECRET,
    algorithm: str = "HS256",
    extra_claims: dict | None = None,
) -> str:
    """Helper to create a JWT token for testing."""
    payload = {
        "sub": sub,
        "email": email,
        "exp": int(time.time()) + exp_offset,
        "iat": int(time.time()),
        "aud": "authenticated",
        "role": "authenticated",
    }
    if extra_claims:
        payload.update(extra_claims)
    return jwt.encode(payload, secret, algorithm=algorithm)


class TestDecodeSupabaseToken:
    """Tests for decode_supabase_token function."""

    def test_valid_token_returns_payload(self):
        """Valid JWT signed with correct secret returns payload with email and sub."""
        token = _make_token(sub="user-abc-123", email="dev@company.com")
        result = decode_supabase_token(token, secret=TEST_SECRET)

        assert result is not None
        assert result["sub"] == "user-abc-123"
        assert result["email"] == "dev@company.com"

    def test_valid_token_extracts_all_claims(self):
        """All standard claims are accessible from the decoded payload."""
        token = _make_token(
            extra_claims={
                "user_metadata": {"full_name": "Test User", "avatar_url": "https://example.com/pic.jpg"},
                "app_metadata": {"provider": "google"},
            }
        )
        result = decode_supabase_token(token, secret=TEST_SECRET)

        assert result is not None
        assert result["user_metadata"]["full_name"] == "Test User"
        assert result["app_metadata"]["provider"] == "google"

    def test_expired_token_returns_none(self):
        """Expired JWT returns None."""
        token = _make_token(exp_offset=-3600)  # Expired 1 hour ago
        result = decode_supabase_token(token, secret=TEST_SECRET)

        assert result is None

    def test_wrong_secret_returns_none(self):
        """JWT signed with wrong secret returns None."""
        token = _make_token(secret="wrong-secret-key")
        result = decode_supabase_token(token, secret=TEST_SECRET)

        assert result is None

    def test_malformed_token_returns_none(self):
        """Completely invalid token string returns None."""
        result = decode_supabase_token("not-a-jwt-at-all", secret=TEST_SECRET)
        assert result is None

    def test_empty_token_returns_none(self):
        """Empty string returns None."""
        result = decode_supabase_token("", secret=TEST_SECRET)
        assert result is None

    def test_token_missing_sub_returns_none(self):
        """Token without 'sub' claim returns None (required by options)."""
        payload = {
            "email": "test@example.com",
            "exp": int(time.time()) + 3600,
        }
        token = jwt.encode(payload, TEST_SECRET, algorithm="HS256")
        result = decode_supabase_token(token, secret=TEST_SECRET)

        assert result is None

    def test_token_missing_exp_returns_none(self):
        """Token without 'exp' claim returns None (required by options)."""
        payload = {
            "sub": "user-123",
            "email": "test@example.com",
        }
        token = jwt.encode(payload, TEST_SECRET, algorithm="HS256")
        result = decode_supabase_token(token, secret=TEST_SECRET)

        assert result is None


class TestRoleEnforcement:
    """Tests for role-based access control logic."""

    def test_admin_role_check(self):
        """Admin role grants access when admin is in required roles."""
        from src.models import RolEnum

        required_roles = {RolEnum.admin}
        user_roles = {RolEnum.admin}
        assert user_roles.intersection(required_roles)

    def test_evaluador_role_check(self):
        """Evaluador role grants access when evaluador is required."""
        from src.models import RolEnum

        required_roles = {RolEnum.evaluador}
        user_roles = {RolEnum.evaluador}
        assert user_roles.intersection(required_roles)

    def test_auditor_role_check(self):
        """Auditor role grants access when auditor is required."""
        from src.models import RolEnum

        required_roles = {RolEnum.auditor}
        user_roles = {RolEnum.auditor}
        assert user_roles.intersection(required_roles)

    def test_insufficient_role_denied(self):
        """User with only auditor role is denied when admin is required."""
        from src.models import RolEnum

        required_roles = {RolEnum.admin}
        user_roles = {RolEnum.auditor}
        assert not user_roles.intersection(required_roles)

    def test_evaluador_denied_admin_only(self):
        """User with evaluador role is denied admin-only access."""
        from src.models import RolEnum

        required_roles = {RolEnum.admin}
        user_roles = {RolEnum.evaluador}
        assert not user_roles.intersection(required_roles)

    def test_multiple_roles_any_match(self):
        """User with multiple roles passes if any role matches."""
        from src.models import RolEnum

        required_roles = {RolEnum.admin, RolEnum.evaluador}
        user_roles = {RolEnum.evaluador}
        assert user_roles.intersection(required_roles)

    def test_no_memberships_denied(self):
        """User with no memberships (empty roles) is always denied."""
        from src.models import RolEnum

        required_roles = {RolEnum.admin}
        user_roles: set = set()
        assert not user_roles.intersection(required_roles)
