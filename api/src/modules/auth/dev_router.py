"""Development-only auth router for simulating login without Supabase.

This module is ONLY registered when DEBUG=true. It provides:
- POST /auth/dev/login: Generate a valid JWT for testing all endpoints
- POST /auth/dev/users: List all dev users created

The generated JWT is signed with the same SUPABASE_JWT_SECRET, so it
passes validation in get_current_user exactly like a real Supabase token would.
"""

import time
import uuid

from fastapi import APIRouter, Depends, HTTPException, status
from jose import jwt
from pydantic import BaseModel, Field
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from src.config import settings
from src.database import get_db
from src.models import Empresa, EmpresaUser, ProviderEnum, RolEnum, User

router = APIRouter()


# --- Schemas ---


class DevLoginRequest(BaseModel):
    """Request body for dev login."""

    email: str = Field(default="admin@habeascheck.dev", description="Email for the dev user")
    name: str = Field(default="Dev Admin", description="Display name")
    role: str = Field(default="admin", description="Role: admin, evaluador, or auditor")
    empresa_nombre: str = Field(default="Empresa de Desarrollo", description="Company name")
    empresa_nit: str = Field(default="9001234567", description="Company NIT")
    empresa_sector: str = Field(default="Tecnología", description="Company sector")
    empresa_tamano: str = Field(default="Mediana", description="Company size")


class DevLoginResponse(BaseModel):
    """Response for dev login with JWT token."""

    access_token: str
    token_type: str = "bearer"
    user_id: str
    email: str
    name: str
    role: str
    empresa_id: str
    empresa_nombre: str
    expires_in: int = 86400  # 24 hours


class DevUserInfo(BaseModel):
    """Dev user info."""

    id: str
    email: str
    name: str
    role: str
    empresa_id: str | None
    empresa_nombre: str | None

    model_config = {"from_attributes": True}


# --- Endpoints ---


@router.post("/dev/login", response_model=DevLoginResponse, tags=["Dev Auth"])
async def dev_login(
    request: DevLoginRequest,
    db: AsyncSession = Depends(get_db),
) -> DevLoginResponse:
    """
    🔧 DEV ONLY — Simulate login and get a valid JWT.

    Creates a user + empresa + membership if they don't exist,
    then returns a JWT signed with the local SUPABASE_JWT_SECRET.

    Use the returned access_token in the Authorization header:
    `Authorization: Bearer <access_token>`

    This endpoint only exists when DEBUG=true.
    """
    if not settings.debug:
        raise HTTPException(status_code=404, detail="Not found")

    # Validate role
    try:
        rol = RolEnum(request.role)
    except ValueError:
        raise HTTPException(
            status_code=422,
            detail=f"Invalid role '{request.role}'. Must be: admin, evaluador, or auditor",
        )

    # Find or create user
    stmt = select(User).where(User.email == request.email)
    result = await db.execute(stmt)
    user = result.scalar_one_or_none()

    if user is None:
        user = User(
            id=uuid.uuid4(),
            email=request.email,
            name=request.name,
            provider=ProviderEnum.google,
            provider_id=f"dev-{uuid.uuid4().hex[:12]}",
            is_active=True,
        )
        db.add(user)
        await db.flush()

    # Find or create empresa
    stmt = select(Empresa).where(Empresa.nit == request.empresa_nit)
    result = await db.execute(stmt)
    empresa = result.scalar_one_or_none()

    if empresa is None:
        empresa = Empresa(
            id=uuid.uuid4(),
            nombre=request.empresa_nombre,
            nit=request.empresa_nit,
            sector=request.empresa_sector,
            tamano=request.empresa_tamano,
        )
        db.add(empresa)
        await db.flush()

    # Find or create membership
    stmt = select(EmpresaUser).where(
        EmpresaUser.user_id == user.id,
        EmpresaUser.empresa_id == empresa.id,
    )
    result = await db.execute(stmt)
    membership = result.scalar_one_or_none()

    if membership is None:
        membership = EmpresaUser(
            user_id=user.id,
            empresa_id=empresa.id,
            rol=rol,
        )
        db.add(membership)
        await db.flush()
    elif membership.rol != rol:
        # Update role if different
        membership.rol = rol
        await db.flush()

    await db.commit()

    # Generate JWT (same format as Supabase)
    now = int(time.time())
    payload = {
        "sub": user.provider_id,
        "email": user.email,
        "iat": now,
        "exp": now + 86400,  # 24 hours
        "aud": "authenticated",
        "role": "authenticated",
        "user_metadata": {
            "full_name": user.name,
        },
        "app_metadata": {
            "provider": "google",
        },
    }

    token = jwt.encode(payload, settings.supabase_jwt_secret, algorithm="HS256")

    return DevLoginResponse(
        access_token=token,
        user_id=str(user.id),
        email=user.email,
        name=user.name,
        role=request.role,
        empresa_id=str(empresa.id),
        empresa_nombre=empresa.nombre,
    )


@router.get("/dev/users", tags=["Dev Auth"])
async def dev_list_users(
    db: AsyncSession = Depends(get_db),
) -> list[DevUserInfo]:
    """
    🔧 DEV ONLY — List all users and their roles.

    Useful for seeing what dev users have been created.
    """
    if not settings.debug:
        raise HTTPException(status_code=404, detail="Not found")

    stmt = select(User).order_by(User.created_at.desc())
    result = await db.execute(stmt)
    users = list(result.scalars().all())

    user_infos = []
    for user in users:
        # Get first membership (user may have multiple)
        stmt = select(EmpresaUser).where(EmpresaUser.user_id == user.id).limit(1)
        result = await db.execute(stmt)
        membership = result.scalar_one_or_none()

        empresa_id = None
        empresa_nombre = None
        role = "none"

        if membership:
            role = membership.rol.value
            empresa_id = str(membership.empresa_id)
            # Get empresa name
            stmt2 = select(Empresa).where(Empresa.id == membership.empresa_id)
            result2 = await db.execute(stmt2)
            emp = result2.scalar_one_or_none()
            if emp:
                empresa_nombre = emp.nombre

        user_infos.append(DevUserInfo(
            id=str(user.id),
            email=user.email,
            name=user.name,
            role=role,
            empresa_id=empresa_id,
            empresa_nombre=empresa_nombre,
        ))

    return user_infos
