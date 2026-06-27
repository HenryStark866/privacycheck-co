"""FastAPI dependencies for authentication and authorization."""

import uuid

from fastapi import Depends, HTTPException, Path, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from src.database import get_db
from src.models import EmpresaUser, RolEnum, User
from src.modules.auth.service import decode_supabase_token, get_or_create_local_user

security = HTTPBearer()


async def get_current_user(
    credentials: HTTPAuthorizationCredentials = Depends(security),
    db: AsyncSession = Depends(get_db),
) -> User:
    """
    Validates Supabase JWT token and returns the local User.

    1. Decode JWT using Supabase JWT secret (HS256)
    2. Extract user email and sub (Supabase user ID)
    3. Find or create local User record linked to Supabase ID
    4. Raises 401 if token is invalid or expired
    """
    token = credentials.credentials
    payload = decode_supabase_token(token)

    if payload is None:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid or expired token",
            headers={"WWW-Authenticate": "Bearer"},
        )

    sub = payload.get("sub")
    email = payload.get("email", "")

    if not sub or not email:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Token missing required claims",
            headers={"WWW-Authenticate": "Bearer"},
        )

    # Extract optional metadata from Supabase token
    user_metadata = payload.get("user_metadata", {})
    name = user_metadata.get("full_name") or user_metadata.get("name")
    avatar_url = user_metadata.get("avatar_url")
    provider = payload.get("app_metadata", {}).get("provider")

    user = await get_or_create_local_user(
        db=db,
        supabase_sub=sub,
        email=email,
        name=name,
        provider=provider,
        avatar_url=avatar_url,
    )

    # Load memberships eagerly for role checks
    stmt = select(User).where(User.id == user.id).options(selectinload(User.memberships))
    result = await db.execute(stmt)
    user = result.scalar_one()

    return user


def require_role(*roles: RolEnum):
    """
    Factory that returns a dependency requiring the user to have
    at least one of the specified roles in any of their memberships.

    Returns 403 if the user has no matching role.
    """

    async def _check(
        user: User = Depends(get_current_user),
    ) -> User:
        user_roles = {m.rol for m in user.memberships}
        if not user_roles.intersection(set(roles)):
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Insufficient permissions",
            )
        return user

    return _check


def require_empresa_access(empresa_id_param: str = "empresa_id"):
    """
    Validates user has membership in the target empresa.

    Admins have access to all empresas.
    Other roles must have an explicit membership record.
    Returns 403 if access is denied.
    """

    async def _check(
        empresa_id: uuid.UUID = Path(..., alias=empresa_id_param),
        user: User = Depends(get_current_user),
        db: AsyncSession = Depends(get_db),
    ) -> User:
        # Admins have universal access
        user_roles = {m.rol for m in user.memberships}
        if RolEnum.admin in user_roles:
            return user

        # Check specific membership in the target empresa
        stmt = select(EmpresaUser).where(
            EmpresaUser.user_id == user.id,
            EmpresaUser.empresa_id == empresa_id,
        )
        result = await db.execute(stmt)
        membership = result.scalar_one_or_none()

        if membership is None:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="No access to this empresa",
            )

        return user

    return _check
