"""Auth service: JWT decoding and local user management."""

from datetime import datetime, timezone

from jose import JWTError, jwt
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from src.config import settings
from src.models import ProviderEnum, User


def decode_supabase_token(token: str, secret: str | None = None) -> dict | None:
    """
    Decode and validate a Supabase JWT token.

    Uses the Supabase JWT secret (HS256) to verify signature and expiration.
    Returns the payload dict on success, or None if invalid/expired.

    Args:
        token: The JWT string to decode.
        secret: Optional override for the JWT secret (used in testing).
                Defaults to settings.supabase_jwt_secret.
    """
    jwt_secret = secret if secret is not None else settings.supabase_jwt_secret
    try:
        payload = jwt.decode(
            token,
            jwt_secret,
            algorithms=["HS256"],
            audience="authenticated",
            options={"require_exp": True, "require_sub": True},
        )
        # Check expiration explicitly
        exp = payload.get("exp")
        if exp is not None:
            now = datetime.now(timezone.utc).timestamp()
            if now > exp:
                return None
        return payload
    except JWTError:
        return None


async def get_or_create_local_user(
    db: AsyncSession,
    supabase_sub: str,
    email: str,
    name: str | None = None,
    provider: str | None = None,
    avatar_url: str | None = None,
) -> User:
    """
    Find or create a local User record linked to a Supabase user ID.

    On first call for a new Supabase user, creates the local record.
    On subsequent calls, returns the existing record.
    """
    # Look up by provider_id (Supabase sub)
    stmt = select(User).where(User.provider_id == supabase_sub)
    result = await db.execute(stmt)
    user = result.scalar_one_or_none()

    if user is not None:
        return user

    # Determine provider enum
    provider_enum = ProviderEnum.google
    if provider and "microsoft" in provider.lower():
        provider_enum = ProviderEnum.microsoft

    # Create new local user
    user = User(
        email=email,
        name=name or email.split("@")[0],
        provider=provider_enum,
        provider_id=supabase_sub,
        avatar_url=avatar_url,
        is_active=True,
    )
    db.add(user)
    await db.flush()
    return user
