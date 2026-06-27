"""Router for empresa (company) management endpoints."""

import uuid

from fastapi import APIRouter, Depends, Query
from sqlalchemy.ext.asyncio import AsyncSession

from src.database import get_db
from src.models import RolEnum, User
from src.modules.auth.dependencies import get_current_user, require_role
from src.modules.empresas.schemas import (
    EmpresaCreate,
    EmpresaResponse,
    EmpresaUpdate,
    MemberAssign,
    MemberResponse,
    PaginatedEmpresaResponse,
)
from src.modules.empresas.service import (
    assign_member,
    create_empresa,
    get_empresa_by_id,
    list_empresas,
    update_empresa,
)
from src.shared.utils.pagination import PaginationParams

router = APIRouter()


@router.post("", response_model=EmpresaResponse, status_code=201)
async def create_empresa_endpoint(
    data: EmpresaCreate,
    current_user: User = Depends(require_role(RolEnum.admin)),
    db: AsyncSession = Depends(get_db),
) -> EmpresaResponse:
    """
    Create a new company. Admin only.

    Validates NIT format and uniqueness.
    Returns 409 if a company with the same NIT already exists.
    """
    empresa = await create_empresa(db, data)
    return EmpresaResponse.model_validate(empresa)


@router.get("", response_model=PaginatedEmpresaResponse)
async def list_empresas_endpoint(
    page: int = Query(default=1, ge=1, description="Page number"),
    page_size: int = Query(default=20, ge=1, le=100, description="Items per page"),
    current_user: User = Depends(
        require_role(RolEnum.admin, RolEnum.evaluador, RolEnum.auditor)
    ),
    db: AsyncSession = Depends(get_db),
) -> PaginatedEmpresaResponse:
    """
    List companies.

    - Admin: sees all companies.
    - Evaluador/Auditor: sees only companies where the user is a member.

    Paginated with page and page_size query parameters.
    """
    pagination = PaginationParams(page=page, page_size=page_size)
    result = await list_empresas(db, current_user, pagination)
    response_data = result.to_response()
    return PaginatedEmpresaResponse(
        items=[EmpresaResponse.model_validate(item) for item in response_data["items"]],
        pagination=response_data["pagination"],
    )


@router.get("/{empresa_id}", response_model=EmpresaResponse)
async def get_empresa_endpoint(
    empresa_id: uuid.UUID,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> EmpresaResponse:
    """
    Get a company by ID.

    Any authenticated user can view company details.
    Returns 404 if the company does not exist.
    """
    empresa = await get_empresa_by_id(db, empresa_id)
    return EmpresaResponse.model_validate(empresa)


@router.put("/{empresa_id}", response_model=EmpresaResponse)
async def update_empresa_endpoint(
    empresa_id: uuid.UUID,
    data: EmpresaUpdate,
    current_user: User = Depends(require_role(RolEnum.admin)),
    db: AsyncSession = Depends(get_db),
) -> EmpresaResponse:
    """
    Update a company. Admin only. NIT is immutable.

    Returns 404 if the company does not exist.
    """
    empresa = await update_empresa(db, empresa_id, data)
    return EmpresaResponse.model_validate(empresa)


@router.post("/{empresa_id}/members", response_model=MemberResponse, status_code=201)
async def assign_member_endpoint(
    empresa_id: uuid.UUID,
    data: MemberAssign,
    current_user: User = Depends(require_role(RolEnum.admin)),
    db: AsyncSession = Depends(get_db),
) -> MemberResponse:
    """
    Assign a user to a company with a role. Admin only.

    Returns 404 if company or user not found.
    Returns 409 if user is already a member.
    """
    membership = await assign_member(db, empresa_id, data)
    return MemberResponse.model_validate(membership)
