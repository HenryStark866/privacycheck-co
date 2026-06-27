"""Business logic for empresa (company) management."""

import uuid

from fastapi import HTTPException, status
from sqlalchemy import func, select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.ext.asyncio import AsyncSession

from src.models import Empresa, EmpresaUser, RolEnum, User
from src.modules.empresas.schemas import EmpresaCreate, EmpresaUpdate, MemberAssign
from src.shared.utils.pagination import PaginatedResult, PaginationParams


async def create_empresa(
    db: AsyncSession,
    data: EmpresaCreate,
) -> Empresa:
    """
    Create a new empresa. Validates NIT uniqueness at DB level.

    Raises:
        HTTPException 409: If NIT already exists.
    """
    empresa = Empresa(
        nombre=data.nombre,
        nit=data.nit,
        sector=data.sector,
        tamano=data.tamano,
    )
    db.add(empresa)
    try:
        await db.flush()
    except IntegrityError:
        await db.rollback()
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=f"A company with NIT '{data.nit}' already exists",
        )
    await db.refresh(empresa)
    return empresa


async def list_empresas(
    db: AsyncSession,
    user: User,
    pagination: PaginationParams,
) -> PaginatedResult:
    """
    List empresas based on user role.

    - Admin: sees all companies.
    - Evaluador/Auditor: sees only companies where they have membership.
    """
    user_roles = {m.rol for m in user.memberships}

    if RolEnum.admin in user_roles:
        # Admin sees all
        count_stmt = select(func.count()).select_from(Empresa)
        count_result = await db.execute(count_stmt)
        total = count_result.scalar_one()

        stmt = (
            select(Empresa)
            .order_by(Empresa.created_at.desc())
            .offset(pagination.offset)
            .limit(pagination.limit)
        )
        result = await db.execute(stmt)
        items = list(result.scalars().all())
    else:
        # Non-admin sees only own memberships
        count_stmt = (
            select(func.count())
            .select_from(Empresa)
            .join(EmpresaUser, EmpresaUser.empresa_id == Empresa.id)
            .where(EmpresaUser.user_id == user.id)
        )
        count_result = await db.execute(count_stmt)
        total = count_result.scalar_one()

        stmt = (
            select(Empresa)
            .join(EmpresaUser, EmpresaUser.empresa_id == Empresa.id)
            .where(EmpresaUser.user_id == user.id)
            .order_by(Empresa.created_at.desc())
            .offset(pagination.offset)
            .limit(pagination.limit)
        )
        result = await db.execute(stmt)
        items = list(result.scalars().all())

    return PaginatedResult(
        items=items,
        total=total,
        page=pagination.page,
        page_size=pagination.page_size,
    )


async def get_empresa_by_id(
    db: AsyncSession,
    empresa_id: uuid.UUID,
) -> Empresa:
    """
    Get a single empresa by ID.

    Raises:
        HTTPException 404: If empresa not found.
    """
    stmt = select(Empresa).where(Empresa.id == empresa_id)
    result = await db.execute(stmt)
    empresa = result.scalar_one_or_none()

    if empresa is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Company not found",
        )
    return empresa


async def update_empresa(
    db: AsyncSession,
    empresa_id: uuid.UUID,
    data: EmpresaUpdate,
) -> Empresa:
    """
    Update an empresa. NIT is immutable and cannot be changed.

    Raises:
        HTTPException 404: If empresa not found.
    """
    empresa = await get_empresa_by_id(db, empresa_id)

    update_data = data.model_dump(exclude_unset=True)
    for field, value in update_data.items():
        setattr(empresa, field, value)

    await db.flush()
    await db.refresh(empresa)
    return empresa


async def assign_member(
    db: AsyncSession,
    empresa_id: uuid.UUID,
    data: MemberAssign,
) -> EmpresaUser:
    """
    Assign a user to an empresa with a specific role.

    Raises:
        HTTPException 404: If empresa or user not found.
        HTTPException 409: If user is already a member of the empresa.
    """
    # Verify empresa exists
    await get_empresa_by_id(db, empresa_id)

    # Verify user exists
    stmt = select(User).where(User.id == data.user_id)
    result = await db.execute(stmt)
    user = result.scalar_one_or_none()
    if user is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="User not found",
        )

    membership = EmpresaUser(
        user_id=data.user_id,
        empresa_id=empresa_id,
        rol=RolEnum(data.rol),
    )
    db.add(membership)
    try:
        await db.flush()
    except IntegrityError:
        await db.rollback()
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="User is already a member of this company",
        )
    await db.refresh(membership)
    return membership
