"""Router for report generation endpoints."""

import uuid

from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.responses import Response
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from src.database import get_db
from src.models import Empresa, EmpresaUser, Evaluacion, RolEnum, User
from src.modules.auth.dependencies import get_current_user
from src.modules.reportes.service import ReportService

router = APIRouter()


@router.get("/{evaluacion_id}/pdf")
async def get_evaluation_pdf(
    evaluacion_id: uuid.UUID,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> Response:
    """
    Generate and download a PDF report for an evaluation.

    Access control:
    - Admin: can access all reports.
    - Evaluador/Auditor: can access reports for companies where they have membership.

    Returns:
        PDF binary with Content-Type application/pdf.

    Raises:
        HTTPException 404: If evaluation does not exist.
        HTTPException 403: If user lacks access to the evaluation's company.
    """
    # Load evaluation
    stmt = select(Evaluacion).where(Evaluacion.id == evaluacion_id)
    result = await db.execute(stmt)
    evaluacion = result.scalar_one_or_none()

    if evaluacion is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Evaluation not found",
        )

    # Check access control
    user_roles = {m.rol for m in current_user.memberships}

    # Admins have universal access
    if RolEnum.admin not in user_roles:
        # Check if user has membership in the evaluation's company
        stmt = select(EmpresaUser).where(
            EmpresaUser.user_id == current_user.id,
            EmpresaUser.empresa_id == evaluacion.empresa_id,
        )
        result = await db.execute(stmt)
        membership = result.scalar_one_or_none()

        if membership is None:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="No access to this evaluation's company",
            )

    # Load the empresa
    stmt = select(Empresa).where(Empresa.id == evaluacion.empresa_id)
    result = await db.execute(stmt)
    empresa = result.scalar_one_or_none()

    if empresa is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Company not found",
        )

    # Load the evaluator user (may be None if user was deleted)
    evaluador: User | None = None
    if evaluacion.user_id:
        stmt = select(User).where(User.id == evaluacion.user_id)
        result = await db.execute(stmt)
        evaluador = result.scalar_one_or_none()

    # Generate PDF
    report_service = ReportService()
    pdf_bytes = report_service.generate_pdf(evaluacion, empresa, evaluador)

    # Build filename
    filename = f"reporte_evaluacion_{evaluacion_id}.pdf"

    return Response(
        content=pdf_bytes,
        media_type="application/pdf",
        headers={
            "Content-Disposition": f'attachment; filename="{filename}"',
        },
    )
