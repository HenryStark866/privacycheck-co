"""Tests for the reportes (report generation) module: service and router."""

import sys
import uuid
from datetime import datetime
from types import ModuleType
from unittest.mock import MagicMock, patch

import pytest
from fastapi import HTTPException
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from src.models import Empresa, EmpresaUser, Evaluacion, RolEnum, User
from src.modules.reportes.service import ReportService


async def _reload_user_with_memberships(session: AsyncSession, user_id: uuid.UUID) -> User:
    """Helper to reload user with memberships eagerly loaded."""
    stmt = select(User).where(User.id == user_id).options(selectinload(User.memberships))
    result = await session.execute(stmt)
    return result.scalar_one()


def _create_evaluacion(empresa_id: uuid.UUID, user_id: uuid.UUID) -> Evaluacion:
    """Create a sample Evaluacion instance with typical data."""
    return Evaluacion(
        id=uuid.uuid4(),
        empresa_id=empresa_id,
        user_id=user_id,
        answers={1: True, 2: True, 3: True, 4: True, 5: True, 6: True, 7: True, 8: True, 9: True, 10: True, 11: True},
        score=100,
        maturity="Líder",
        blocks={
            "A": {"name": "Política de datos personales", "earned": 40, "max": 40},
            "B": {"name": "Privacidad desde el diseño", "earned": 36, "max": 36},
            "C": {"name": "Gobernanza", "earned": 24, "max": 24},
        },
        gaps=[],
        notes=[],
        created_at=datetime(2024, 6, 15, 10, 30, 0),
    )


def _create_evaluacion_with_gaps(empresa_id: uuid.UUID, user_id: uuid.UUID) -> Evaluacion:
    """Create an Evaluacion with gaps and notes for richer template rendering."""
    return Evaluacion(
        id=uuid.uuid4(),
        empresa_id=empresa_id,
        user_id=user_id,
        answers={1: False, 6: True, 7: False, 8: True, 9: True, 10: False},
        score=32,
        maturity="Básico",
        blocks={
            "A": {"name": "Política de datos personales", "earned": 0, "max": 40},
            "B": {"name": "Privacidad desde el diseño", "earned": 24, "max": 36},
            "C": {"name": "Gobernanza", "earned": 16, "max": 24},
        },
        gaps=[
            {"question_id": 9, "weight": 16, "text": "¿Existe un Oficial de Protección de Datos o responsable designado?"},
            {"question_id": 7, "weight": 12, "text": "¿Se aplican medidas de seguridad técnica para proteger datos personales?"},
            {"question_id": 10, "weight": 8, "text": "¿La empresa tiene un programa de formación en protección de datos?"},
        ],
        notes=["Inconsistencia: Q1 es negativa pero Q2-Q5 no son aplicables."],
        created_at=datetime(2024, 6, 15, 10, 30, 0),
    )


# ============================================================================
# ReportService Unit Tests
# ============================================================================


class TestReportService:
    """Test the ReportService PDF generation logic."""

    @pytest.fixture(autouse=True)
    def mock_weasyprint(self):
        """Mock weasyprint module since system libraries are not available."""
        mock_html_class = MagicMock()
        mock_html_instance = MagicMock()
        mock_html_instance.write_pdf.return_value = b"%PDF-1.4 fake content"
        mock_html_class.return_value = mock_html_instance

        # Create a mock weasyprint module
        mock_module = ModuleType("weasyprint")
        mock_module.HTML = mock_html_class

        with patch.dict(sys.modules, {"weasyprint": mock_module}):
            self._mock_html_class = mock_html_class
            self._mock_html_instance = mock_html_instance
            yield

    def test_generate_pdf_returns_bytes(self):
        """generate_pdf returns bytes from WeasyPrint."""
        empresa = Empresa(
            id=uuid.uuid4(),
            nombre="Test Corp",
            nit="123456789",
            sector="Tecnología",
            tamano="Mediana",
        )
        user = User(
            id=uuid.uuid4(),
            email="evaluador@test.com",
            name="Juan Evaluador",
            provider="google",
            provider_id="sub-123",
            is_active=True,
        )
        evaluacion = _create_evaluacion(empresa.id, user.id)

        service = ReportService()
        pdf_bytes = service.generate_pdf(evaluacion, empresa, user)

        assert isinstance(pdf_bytes, bytes)
        assert len(pdf_bytes) > 0
        # Verify WeasyPrint was called
        self._mock_html_class.assert_called_once()
        self._mock_html_instance.write_pdf.assert_called_once()

    def test_generate_pdf_with_gaps_and_notes(self):
        """generate_pdf handles evaluations with gaps and notes."""
        self._mock_html_instance.write_pdf.return_value = b"%PDF-1.4 gaps content"

        empresa = Empresa(
            id=uuid.uuid4(),
            nombre="Gap Corp",
            nit="987654321",
            sector="Finanzas",
            tamano="Grande",
        )
        user = User(
            id=uuid.uuid4(),
            email="evaluador2@test.com",
            name="María Evaluadora",
            provider="microsoft",
            provider_id="sub-456",
            is_active=True,
        )
        evaluacion = _create_evaluacion_with_gaps(empresa.id, user.id)

        service = ReportService()
        pdf_bytes = service.generate_pdf(evaluacion, empresa, user)

        assert isinstance(pdf_bytes, bytes)
        assert len(pdf_bytes) > 0
        # Verify template was rendered with the HTML content
        call_args = self._mock_html_class.call_args
        html_string = call_args[1]["string"]
        assert "Gap Corp" in html_string
        assert "987654321" in html_string
        assert "Básico" in html_string

    def test_generate_pdf_with_null_evaluator(self):
        """generate_pdf works when evaluator is None."""
        self._mock_html_instance.write_pdf.return_value = b"%PDF-1.4 no evaluator"

        empresa = Empresa(
            id=uuid.uuid4(),
            nombre="Null Corp",
            nit="111222333",
            sector="Salud",
            tamano="Pequeña",
        )
        evaluacion = _create_evaluacion(empresa.id, None)

        service = ReportService()
        pdf_bytes = service.generate_pdf(evaluacion, empresa, None)

        assert isinstance(pdf_bytes, bytes)
        call_args = self._mock_html_class.call_args
        html_string = call_args[1]["string"]
        assert "No especificado" in html_string

    def test_generate_pdf_template_contains_company_info(self):
        """PDF template renders company information correctly."""
        self._mock_html_instance.write_pdf.return_value = b"%PDF-1.4"

        empresa = Empresa(
            id=uuid.uuid4(),
            nombre="Empresa ABC",
            nit="999888777",
            sector="Educación",
            tamano="Microempresa",
        )
        user = User(
            id=uuid.uuid4(),
            email="eval@test.com",
            name="Carlos García",
            provider="google",
            provider_id="sub-789",
            is_active=True,
        )
        evaluacion = _create_evaluacion(empresa.id, user.id)

        service = ReportService()
        service.generate_pdf(evaluacion, empresa, user)

        call_args = self._mock_html_class.call_args
        html_string = call_args[1]["string"]
        assert "Empresa ABC" in html_string
        assert "999888777" in html_string
        assert "Educación" in html_string
        assert "Microempresa" in html_string
        assert "Carlos García" in html_string
        assert "Habeas Check" in html_string
        assert "Ley 1581" in html_string

    def test_generate_pdf_contains_score_and_maturity(self):
        """PDF template renders score gauge and maturity level."""
        self._mock_html_instance.write_pdf.return_value = b"%PDF-1.4"

        empresa = Empresa(
            id=uuid.uuid4(),
            nombre="Score Corp",
            nit="555444333",
            sector="Retail",
            tamano="Grande",
        )
        user = User(
            id=uuid.uuid4(),
            email="score@test.com",
            name="Test User",
            provider="google",
            provider_id="sub-score",
            is_active=True,
        )
        evaluacion = _create_evaluacion_with_gaps(empresa.id, user.id)

        service = ReportService()
        service.generate_pdf(evaluacion, empresa, user)

        call_args = self._mock_html_class.call_args
        html_string = call_args[1]["string"]
        assert "32%" in html_string
        assert "Básico" in html_string


# ============================================================================
# Router / Endpoint Access Control Tests
# ============================================================================


class TestReportEndpointAccessControl:
    """Test access control for the PDF report endpoint."""

    @pytest.mark.asyncio
    async def test_evaluador_can_access_own_company_report(self, seeded_db):
        """Evaluador with membership can generate report for their company."""
        from src.modules.reportes.router import get_evaluation_pdf

        data = seeded_db
        user = data["user"]
        empresa = data["empresa"]
        session = data["session"]

        # Create an evaluation
        evaluacion = Evaluacion(
            id=uuid.uuid4(),
            empresa_id=empresa.id,
            user_id=user.id,
            answers={1: False, 6: True, 7: True, 8: True, 9: True, 10: False},
            score=52,
            maturity="Gestionado",
            blocks={
                "A": {"name": "Política de datos personales", "earned": 0, "max": 40},
                "B": {"name": "Privacidad desde el diseño", "earned": 36, "max": 36},
                "C": {"name": "Gobernanza", "earned": 16, "max": 24},
            },
            gaps=[{"question_id": 10, "weight": 8, "text": "Q10 gap"}],
            notes=[],
            created_at=datetime(2024, 6, 15, 10, 30, 0),
        )
        session.add(evaluacion)
        await session.flush()

        # Call the endpoint handler directly
        with patch("src.modules.reportes.router.ReportService") as MockService:
            mock_instance = MagicMock()
            mock_instance.generate_pdf.return_value = b"%PDF-1.4 valid pdf content"
            MockService.return_value = mock_instance

            response = await get_evaluation_pdf(
                evaluacion_id=evaluacion.id,
                current_user=user,
                db=session,
            )

        assert response.status_code == 200
        assert response.media_type == "application/pdf"
        assert response.body == b"%PDF-1.4 valid pdf content"
        assert "Content-Disposition" in response.headers
        assert "attachment" in response.headers["Content-Disposition"]
        assert str(evaluacion.id) in response.headers["Content-Disposition"]

    @pytest.mark.asyncio
    async def test_auditor_can_access_company_report(self, seeded_db):
        """Auditor with membership can access reports (read-only)."""
        from src.modules.reportes.router import get_evaluation_pdf

        data = seeded_db
        empresa = data["empresa"]
        session = data["session"]

        # Create auditor user
        auditor = User(
            id=uuid.uuid4(),
            email="auditor@test.com",
            name="Test Auditor",
            provider="google",
            provider_id="auditor-sub-123",
            is_active=True,
        )
        session.add(auditor)
        await session.flush()

        # Give auditor membership
        auditor_membership = EmpresaUser(
            user_id=auditor.id,
            empresa_id=empresa.id,
            rol=RolEnum.auditor,
        )
        session.add(auditor_membership)
        await session.flush()

        # Reload auditor with memberships
        auditor = await _reload_user_with_memberships(session, auditor.id)

        # Create an evaluation
        evaluacion = Evaluacion(
            id=uuid.uuid4(),
            empresa_id=empresa.id,
            user_id=data["user"].id,
            answers={1: False, 6: True, 7: True, 8: True, 9: True, 10: False},
            score=52,
            maturity="Gestionado",
            blocks={"A": {"name": "Block A", "earned": 0, "max": 40}},
            gaps=[],
            notes=[],
            created_at=datetime(2024, 6, 15, 10, 30, 0),
        )
        session.add(evaluacion)
        await session.flush()

        with patch("src.modules.reportes.router.ReportService") as MockService:
            mock_instance = MagicMock()
            mock_instance.generate_pdf.return_value = b"%PDF-1.4 auditor pdf"
            MockService.return_value = mock_instance

            response = await get_evaluation_pdf(
                evaluacion_id=evaluacion.id,
                current_user=auditor,
                db=session,
            )

        assert response.status_code == 200
        assert response.media_type == "application/pdf"

    @pytest.mark.asyncio
    async def test_admin_can_access_any_report(self, seeded_db):
        """Admin can access reports for any company."""
        from src.modules.reportes.router import get_evaluation_pdf

        data = seeded_db
        empresa = data["empresa"]
        session = data["session"]

        # Create admin user with admin role in a different empresa
        admin_user = User(
            id=uuid.uuid4(),
            email="admin@test.com",
            name="Admin User",
            provider="google",
            provider_id="admin-sub-999",
            is_active=True,
        )
        session.add(admin_user)
        await session.flush()

        admin_empresa = Empresa(
            id=uuid.uuid4(),
            nombre="Admin Corp",
            nit="555666777",
            sector="Admin",
            tamano="Grande",
        )
        session.add(admin_empresa)
        await session.flush()

        admin_membership = EmpresaUser(
            user_id=admin_user.id,
            empresa_id=admin_empresa.id,
            rol=RolEnum.admin,
        )
        session.add(admin_membership)
        await session.flush()

        # Reload admin with memberships
        admin_user = await _reload_user_with_memberships(session, admin_user.id)

        # Create evaluation in original empresa (not admin's)
        evaluacion = Evaluacion(
            id=uuid.uuid4(),
            empresa_id=empresa.id,
            user_id=data["user"].id,
            answers={1: False, 6: True, 7: True, 8: True, 9: True, 10: False},
            score=52,
            maturity="Gestionado",
            blocks={"A": {"name": "Block A", "earned": 0, "max": 40}},
            gaps=[],
            notes=[],
            created_at=datetime(2024, 6, 15, 10, 30, 0),
        )
        session.add(evaluacion)
        await session.flush()

        with patch("src.modules.reportes.router.ReportService") as MockService:
            mock_instance = MagicMock()
            mock_instance.generate_pdf.return_value = b"%PDF-1.4 admin pdf"
            MockService.return_value = mock_instance

            response = await get_evaluation_pdf(
                evaluacion_id=evaluacion.id,
                current_user=admin_user,
                db=session,
            )

        assert response.status_code == 200
        assert response.media_type == "application/pdf"

    @pytest.mark.asyncio
    async def test_user_without_membership_gets_403(self, seeded_db):
        """User without membership in evaluation's company gets 403."""
        from src.modules.reportes.router import get_evaluation_pdf

        data = seeded_db
        empresa = data["empresa"]
        session = data["session"]

        # Create a user without membership in the empresa
        other_user = User(
            id=uuid.uuid4(),
            email="noaccess@test.com",
            name="No Access User",
            provider="google",
            provider_id="noaccess-sub-123",
            is_active=True,
        )
        session.add(other_user)
        await session.flush()

        # Reload user with memberships (should be empty)
        other_user = await _reload_user_with_memberships(session, other_user.id)

        # Create evaluation
        evaluacion = Evaluacion(
            id=uuid.uuid4(),
            empresa_id=empresa.id,
            user_id=data["user"].id,
            answers={1: False, 6: True, 7: True, 8: True, 9: True, 10: False},
            score=52,
            maturity="Gestionado",
            blocks={},
            gaps=[],
            notes=[],
            created_at=datetime(2024, 6, 15, 10, 30, 0),
        )
        session.add(evaluacion)
        await session.flush()

        with pytest.raises(HTTPException) as exc_info:
            await get_evaluation_pdf(
                evaluacion_id=evaluacion.id,
                current_user=other_user,
                db=session,
            )
        assert exc_info.value.status_code == 403

    @pytest.mark.asyncio
    async def test_nonexistent_evaluation_gets_404(self, seeded_db):
        """Request for non-existent evaluation returns 404."""
        from src.modules.reportes.router import get_evaluation_pdf

        data = seeded_db
        user = data["user"]
        session = data["session"]

        with pytest.raises(HTTPException) as exc_info:
            await get_evaluation_pdf(
                evaluacion_id=uuid.uuid4(),  # Non-existent
                current_user=user,
                db=session,
            )
        assert exc_info.value.status_code == 404

    @pytest.mark.asyncio
    async def test_pdf_response_has_correct_content_type(self, seeded_db):
        """Response has Content-Type: application/pdf."""
        from src.modules.reportes.router import get_evaluation_pdf

        data = seeded_db
        user = data["user"]
        empresa = data["empresa"]
        session = data["session"]

        evaluacion = Evaluacion(
            id=uuid.uuid4(),
            empresa_id=empresa.id,
            user_id=user.id,
            answers={1: False, 6: True, 7: True, 8: True, 9: True, 10: False},
            score=52,
            maturity="Gestionado",
            blocks={"A": {"name": "Block A", "earned": 0, "max": 40}},
            gaps=[],
            notes=[],
            created_at=datetime(2024, 6, 15, 10, 30, 0),
        )
        session.add(evaluacion)
        await session.flush()

        with patch("src.modules.reportes.router.ReportService") as MockService:
            mock_instance = MagicMock()
            mock_instance.generate_pdf.return_value = b"%PDF-1.4 content type test"
            MockService.return_value = mock_instance

            response = await get_evaluation_pdf(
                evaluacion_id=evaluacion.id,
                current_user=user,
                db=session,
            )

        assert response.media_type == "application/pdf"
        assert response.headers["Content-Disposition"].startswith("attachment")

    @pytest.mark.asyncio
    async def test_pdf_response_contains_valid_bytes(self, seeded_db):
        """Response body contains PDF bytes (non-empty)."""
        from src.modules.reportes.router import get_evaluation_pdf

        data = seeded_db
        user = data["user"]
        empresa = data["empresa"]
        session = data["session"]

        evaluacion = Evaluacion(
            id=uuid.uuid4(),
            empresa_id=empresa.id,
            user_id=user.id,
            answers={1: False, 6: True, 7: True, 8: True, 9: True, 10: False},
            score=52,
            maturity="Gestionado",
            blocks={"A": {"name": "Block A", "earned": 0, "max": 40}},
            gaps=[],
            notes=[],
            created_at=datetime(2024, 6, 15, 10, 30, 0),
        )
        session.add(evaluacion)
        await session.flush()

        with patch("src.modules.reportes.router.ReportService") as MockService:
            mock_instance = MagicMock()
            # Simulate PDF magic bytes
            mock_instance.generate_pdf.return_value = b"%PDF-1.4\n1 0 obj\n<< /Type /Catalog >>\nendobj"
            MockService.return_value = mock_instance

            response = await get_evaluation_pdf(
                evaluacion_id=evaluacion.id,
                current_user=user,
                db=session,
            )

        assert len(response.body) > 0
        assert response.body.startswith(b"%PDF")
