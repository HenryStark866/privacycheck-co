"""Router for evaluacion (evaluation) endpoints."""

import uuid

from fastapi import APIRouter, Depends, Query
from sqlalchemy.ext.asyncio import AsyncSession

from src.database import get_db
from src.models import RolEnum, User
from src.modules.auth.dependencies import get_current_user, require_role
from src.modules.evaluaciones.schemas import (
    EvaluacionCreate,
    EvaluacionListItem,
    EvaluacionResponse,
    PaginatedEvaluacionResponse,
)
from src.modules.evaluaciones.service import (
    get_evaluacion_by_id,
    list_evaluaciones,
    submit_evaluacion,
)
from src.shared.utils.pagination import PaginationParams

router = APIRouter()


@router.post("", response_model=EvaluacionResponse, status_code=201)
async def create_evaluacion_endpoint(
    data: EvaluacionCreate,
    current_user: User = Depends(
        require_role(RolEnum.evaluador, RolEnum.admin)
    ),
    db: AsyncSession = Depends(get_db),
) -> EvaluacionResponse:
    """
    Submit a new evaluation for a company.

    Requires evaluador or admin role and membership in the target company.
    Validates answer completeness, computes score via scoring engine,
    and persists the evaluation record.

    Returns 403 if user has no membership in the company.
    Returns 422 if answers are invalid or incomplete.
    """
    evaluacion = await submit_evaluacion(db, current_user, data)
    return EvaluacionResponse.model_validate(evaluacion)


@router.get("", response_model=PaginatedEvaluacionResponse)
async def list_evaluaciones_endpoint(
    empresa_id: uuid.UUID = Query(..., description="Company ID to list evaluations for"),
    page: int = Query(default=1, ge=1, description="Page number"),
    page_size: int = Query(default=20, ge=1, le=100, description="Items per page"),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> PaginatedEvaluacionResponse:
    """
    List evaluations for a company, ordered by creation date descending.

    Requires membership in the target company.
    Returns 403 if user has no membership.
    """
    pagination = PaginationParams(page=page, page_size=page_size)
    result = await list_evaluaciones(db, current_user, empresa_id, pagination)
    response_data = result.to_response()
    return PaginatedEvaluacionResponse(
        items=[EvaluacionListItem.model_validate(item) for item in response_data["items"]],
        pagination=response_data["pagination"],
    )


@router.get("/{evaluacion_id}", response_model=EvaluacionResponse)
async def get_evaluacion_endpoint(
    evaluacion_id: uuid.UUID,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> EvaluacionResponse:
    """
    Get a single evaluation with full detail.

    Requires membership in the evaluation's company.
    Returns 404 if evaluation not found.
    Returns 403 if user has no access.
    """
    evaluacion = await get_evaluacion_by_id(db, current_user, evaluacion_id)
    return EvaluacionResponse.model_validate(evaluacion)
