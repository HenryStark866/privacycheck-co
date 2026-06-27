"""Business logic for evaluacion (evaluation) management."""

import uuid

from fastapi import HTTPException, status
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from src.models import Empresa, EmpresaUser, Evaluacion, RolEnum, User
from src.modules.diagnostico.scoring import compute_score
from src.modules.evaluaciones.schemas import EvaluacionCreate
from src.shared.utils.pagination import PaginatedResult, PaginationParams


async def _check_membership(
    db: AsyncSession,
    user: User,
    empresa_id: uuid.UUID,
) -> None:
    """
    Verify the user has membership in the given empresa.
    Admins bypass this check.

    Raises:
        HTTPException 403: If user has no membership in the empresa.
        HTTPException 404: If empresa does not exist.
    """
    # Verify empresa exists
    stmt = select(Empresa).where(Empresa.id == empresa_id)
    result = await db.execute(stmt)
    empresa = result.scalar_one_or_none()
    if empresa is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Company not found",
        )

    # Admins have universal access
    user_roles = {m.rol for m in user.memberships}
    if RolEnum.admin in user_roles:
        return

    # Check specific membership
    stmt = select(EmpresaUser).where(
        EmpresaUser.user_id == user.id,
        EmpresaUser.empresa_id == empresa_id,
    )
    result = await db.execute(stmt)
    membership = result.scalar_one_or_none()

    if membership is None:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="No membership in this company",
        )


async def submit_evaluacion(
    db: AsyncSession,
    user: User,
    data: EvaluacionCreate,
) -> Evaluacion:
    """
    Submit a new evaluation for a company.

    1. Validate user has membership in the empresa (evaluador role) → 403 if not
    2. Answer completeness validated by schema
    3. Call compute_score(answers) from scoring engine
    4. Persist Evaluacion record with answers, score, maturity, blocks, gaps, notes
    5. Return full result

    Raises:
        HTTPException 403: If user has no membership in the empresa.
        HTTPException 404: If empresa does not exist.
    """
    await _check_membership(db, user, data.empresa_id)

    # Compute score using the scoring engine
    score_result = compute_score(data.answers)

    # Serialize blocks and gaps for JSON storage
    blocks_json = {
        key: {"name": b.name, "earned": b.earned, "max": b.max}
        for key, b in score_result.blocks.items()
    }
    gaps_json = [
        {"question_id": g.question_id, "weight": g.weight, "text": g.text}
        for g in score_result.gaps
    ]

    evaluacion = Evaluacion(
        empresa_id=data.empresa_id,
        user_id=user.id,
        answers=data.answers,
        score=score_result.score,
        maturity=score_result.maturity.label,
        blocks=blocks_json,
        gaps=gaps_json,
        notes=score_result.notes,
    )
    db.add(evaluacion)
    await db.flush()
    await db.refresh(evaluacion)
    return evaluacion


async def list_evaluaciones(
    db: AsyncSession,
    user: User,
    empresa_id: uuid.UUID,
    pagination: PaginationParams,
) -> PaginatedResult:
    """
    List evaluations for a company, ordered by creation date descending.

    Requires the user to have membership in the empresa.

    Raises:
        HTTPException 403: If user has no membership in the empresa.
        HTTPException 404: If empresa does not exist.
    """
    await _check_membership(db, user, empresa_id)

    # Count total evaluaciones for this empresa
    count_stmt = (
        select(func.count())
        .select_from(Evaluacion)
        .where(Evaluacion.empresa_id == empresa_id)
    )
    count_result = await db.execute(count_stmt)
    total = count_result.scalar_one()

    # Fetch paginated evaluaciones ordered by date desc
    stmt = (
        select(Evaluacion)
        .where(Evaluacion.empresa_id == empresa_id)
        .order_by(Evaluacion.created_at.desc())
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


async def get_evaluacion_by_id(
    db: AsyncSession,
    user: User,
    evaluacion_id: uuid.UUID,
) -> Evaluacion:
    """
    Get a single evaluation by ID with full detail.

    Requires the user to have membership in the evaluation's empresa.

    Raises:
        HTTPException 404: If evaluacion not found.
        HTTPException 403: If user has no membership in the empresa.
    """
    stmt = select(Evaluacion).where(Evaluacion.id == evaluacion_id)
    result = await db.execute(stmt)
    evaluacion = result.scalar_one_or_none()

    if evaluacion is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Evaluation not found",
        )

    # Verify user has access to the empresa this evaluation belongs to
    await _check_membership(db, user, evaluacion.empresa_id)

    return evaluacion
