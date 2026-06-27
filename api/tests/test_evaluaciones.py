"""Tests for the evaluaciones module: schemas, service, and router."""

import uuid
from datetime import datetime, timezone
from unittest.mock import AsyncMock, MagicMock, patch

import pytest
from pydantic import ValidationError
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from src.models import Empresa, EmpresaUser, Evaluacion, RolEnum, User
from src.modules.evaluaciones.schemas import EvaluacionCreate
from src.modules.evaluaciones.service import (
    get_evaluacion_by_id,
    list_evaluaciones,
    submit_evaluacion,
)
from src.shared.utils.pagination import PaginationParams


async def _reload_user_with_memberships(session: AsyncSession, user_id: uuid.UUID) -> User:
    """Helper to reload user with memberships eagerly loaded."""
    stmt = select(User).where(User.id == user_id).options(selectinload(User.memberships))
    result = await session.execute(stmt)
    return result.scalar_one()


# ============================================================================
# Schema Validation Tests
# ============================================================================


class TestEvaluacionCreateSchema:
    """Test EvaluacionCreate schema validation."""

    def test_valid_answers_minimal(self):
        """Minimal valid answers: Q1=False, Q6-Q10 present."""
        data = EvaluacionCreate(
            empresa_id=uuid.uuid4(),
            answers={1: False, 6: True, 7: True, 8: True, 9: True, 10: False},
        )
        assert data.answers[1] is False
        assert len(data.answers) == 6

    def test_valid_answers_with_q1_true(self):
        """When Q1=True, Q2-Q5 must also be present."""
        data = EvaluacionCreate(
            empresa_id=uuid.uuid4(),
            answers={
                1: True, 2: True, 3: False, 4: True, 5: False,
                6: True, 7: True, 8: True, 9: True, 10: False,
            },
        )
        assert data.answers[1] is True
        assert len(data.answers) == 10

    def test_valid_answers_with_q11_when_q10_true(self):
        """Q11 accepted when Q10=True."""
        data = EvaluacionCreate(
            empresa_id=uuid.uuid4(),
            answers={
                1: False, 6: True, 7: True, 8: True, 9: True, 10: True, 11: False,
            },
        )
        assert data.answers[10] is True
        assert 11 in data.answers

    def test_missing_always_required_questions(self):
        """Missing any always-required question raises 422."""
        # Missing Q9
        with pytest.raises(ValidationError) as exc_info:
            EvaluacionCreate(
                empresa_id=uuid.uuid4(),
                answers={1: False, 6: True, 7: True, 8: True, 10: False},
            )
        assert "Missing required answers" in str(exc_info.value)

    def test_missing_q1(self):
        """Missing Q1 (always required) raises validation error."""
        with pytest.raises(ValidationError) as exc_info:
            EvaluacionCreate(
                empresa_id=uuid.uuid4(),
                answers={6: True, 7: True, 8: True, 9: True, 10: False},
            )
        assert "Missing required answers" in str(exc_info.value)

    def test_q1_true_but_missing_block_a(self):
        """When Q1=True but Q2-Q5 incomplete, raises 422."""
        with pytest.raises(ValidationError) as exc_info:
            EvaluacionCreate(
                empresa_id=uuid.uuid4(),
                answers={
                    1: True, 2: True, 3: False,  # Missing Q4, Q5
                    6: True, 7: True, 8: True, 9: True, 10: False,
                },
            )
        assert "Q1 is True" in str(exc_info.value)

    def test_q11_rejected_when_q10_false(self):
        """Q11 not accepted when Q10=False."""
        with pytest.raises(ValidationError) as exc_info:
            EvaluacionCreate(
                empresa_id=uuid.uuid4(),
                answers={
                    1: False, 6: True, 7: True, 8: True, 9: True, 10: False, 11: True,
                },
            )
        assert "Q11 can only be provided when Q10 is True" in str(exc_info.value)

    def test_question_id_out_of_range(self):
        """Question IDs outside 1-11 raise 422."""
        with pytest.raises(ValidationError) as exc_info:
            EvaluacionCreate(
                empresa_id=uuid.uuid4(),
                answers={
                    0: True,  # Invalid
                    1: False, 6: True, 7: True, 8: True, 9: True, 10: False,
                },
            )
        assert "out of range" in str(exc_info.value)

    def test_question_id_above_range(self):
        """Question ID > 11 raises 422."""
        with pytest.raises(ValidationError) as exc_info:
            EvaluacionCreate(
                empresa_id=uuid.uuid4(),
                answers={
                    1: False, 6: True, 7: True, 8: True, 9: True, 10: False, 12: True,
                },
            )
        assert "out of range" in str(exc_info.value)

    def test_all_questions_positive(self):
        """Full positive answers (Q1-Q11 all True) is valid."""
        data = EvaluacionCreate(
            empresa_id=uuid.uuid4(),
            answers={
                1: True, 2: True, 3: True, 4: True, 5: True,
                6: True, 7: True, 8: True, 9: True, 10: True, 11: True,
            },
        )
        assert data.answers[11] is True

    def test_empty_answers_rejected(self):
        """Empty answers dict raises validation error."""
        with pytest.raises(ValidationError):
            EvaluacionCreate(
                empresa_id=uuid.uuid4(),
                answers={},
            )


# ============================================================================
# Service Tests
# ============================================================================


class TestSubmitEvaluacion:
    """Test the submit_evaluacion service function."""

    @pytest.fixture
    def valid_answers_minimal(self):
        """Minimal valid answer set."""
        return {1: False, 6: True, 7: True, 8: True, 9: True, 10: False}

    @pytest.fixture
    def valid_answers_full(self):
        """Full valid answer set with Q1=True."""
        return {
            1: True, 2: True, 3: True, 4: True, 5: True,
            6: True, 7: True, 8: True, 9: True, 10: True, 11: True,
        }

    @pytest.mark.asyncio
    async def test_submit_success(self, seeded_db, valid_answers_full):
        """Successful submission computes score and persists."""
        data = seeded_db
        user = data["user"]
        empresa = data["empresa"]
        session = data["session"]

        create_data = EvaluacionCreate(
            empresa_id=empresa.id,
            answers=valid_answers_full,
        )

        evaluacion = await submit_evaluacion(session, user, create_data)

        assert evaluacion.id is not None
        assert evaluacion.empresa_id == empresa.id
        assert evaluacion.user_id == user.id
        assert evaluacion.score == 100  # All True = max score
        assert evaluacion.maturity == "Líder"
        assert evaluacion.blocks is not None
        assert evaluacion.gaps is not None
        assert evaluacion.notes is not None

    @pytest.mark.asyncio
    async def test_submit_partial_score(self, seeded_db, valid_answers_minimal):
        """Submission with minimal answers computes correct partial score."""
        data = seeded_db
        user = data["user"]
        empresa = data["empresa"]
        session = data["session"]

        create_data = EvaluacionCreate(
            empresa_id=empresa.id,
            answers=valid_answers_minimal,
        )

        evaluacion = await submit_evaluacion(session, user, create_data)

        # Q6=12, Q7=12, Q8=12, Q9=16, Q10=0 → score = 52
        assert evaluacion.score == 52
        assert evaluacion.maturity == "Gestionado"

    @pytest.mark.asyncio
    async def test_submit_no_membership_raises_403(self, seeded_db, valid_answers_minimal):
        """Submission to empresa without membership raises 403."""
        from fastapi import HTTPException

        data = seeded_db
        user = data["user"]
        session = data["session"]

        other_empresa = Empresa(
            id=uuid.uuid4(),
            nombre="Other Company",
            nit="987654321",
            sector="Finanzas",
            tamano="Grande",
        )
        session.add(other_empresa)
        await session.flush()

        create_data = EvaluacionCreate(
            empresa_id=other_empresa.id,
            answers=valid_answers_minimal,
        )

        # Reload user with memberships to avoid lazy-load issues
        user = await _reload_user_with_memberships(session, user.id)

        with pytest.raises(HTTPException) as exc_info:
            await submit_evaluacion(session, user, create_data)
        assert exc_info.value.status_code == 403

    @pytest.mark.asyncio
    async def test_submit_nonexistent_empresa_raises_404(self, seeded_db, valid_answers_minimal):
        """Submission to non-existent empresa raises 404."""
        from fastapi import HTTPException

        data = seeded_db
        user = data["user"]
        session = data["session"]

        create_data = EvaluacionCreate(
            empresa_id=uuid.uuid4(),  # Non-existent
            answers=valid_answers_minimal,
        )

        with pytest.raises(HTTPException) as exc_info:
            await submit_evaluacion(session, user, create_data)
        assert exc_info.value.status_code == 404


# ============================================================================
# List Evaluaciones Tests
# ============================================================================


class TestListEvaluaciones:
    """Test the list_evaluaciones service function."""

    @pytest.mark.asyncio
    async def test_list_empty(self, seeded_db):
        """List with no evaluations returns empty result."""
        data = seeded_db
        user = data["user"]
        empresa = data["empresa"]
        session = data["session"]

        pagination = PaginationParams(page=1, page_size=20)
        result = await list_evaluaciones(session, user, empresa.id, pagination)

        assert result.total == 0
        assert result.items == []

    @pytest.mark.asyncio
    async def test_list_with_evaluaciones(self, seeded_db):
        """List returns evaluations ordered by date desc."""
        data = seeded_db
        user = data["user"]
        empresa = data["empresa"]
        session = data["session"]

        # Create multiple evaluaciones
        answers = {1: False, 6: True, 7: True, 8: True, 9: True, 10: False}
        create_data = EvaluacionCreate(empresa_id=empresa.id, answers=answers)

        await submit_evaluacion(session, user, create_data)
        await submit_evaluacion(session, user, create_data)

        pagination = PaginationParams(page=1, page_size=20)
        result = await list_evaluaciones(session, user, empresa.id, pagination)

        assert result.total == 2
        assert len(result.items) == 2

    @pytest.mark.asyncio
    async def test_list_no_membership_raises_403(self, seeded_db):
        """List without membership raises 403."""
        from fastapi import HTTPException

        data = seeded_db
        user = data["user"]
        session = data["session"]

        other_empresa = Empresa(
            id=uuid.uuid4(),
            nombre="Other Company",
            nit="111222333",
            sector="Salud",
            tamano="Pequeña",
        )
        session.add(other_empresa)
        await session.flush()

        # Reload user with memberships
        user = await _reload_user_with_memberships(session, user.id)

        pagination = PaginationParams(page=1, page_size=20)
        with pytest.raises(HTTPException) as exc_info:
            await list_evaluaciones(session, user, other_empresa.id, pagination)
        assert exc_info.value.status_code == 403

    @pytest.mark.asyncio
    async def test_list_pagination(self, seeded_db):
        """Pagination limits returned items."""
        data = seeded_db
        user = data["user"]
        empresa = data["empresa"]
        session = data["session"]

        answers = {1: False, 6: True, 7: True, 8: True, 9: True, 10: False}
        create_data = EvaluacionCreate(empresa_id=empresa.id, answers=answers)

        # Create 3 evaluaciones
        for _ in range(3):
            await submit_evaluacion(session, user, create_data)

        # Request page_size=2
        pagination = PaginationParams(page=1, page_size=2)
        result = await list_evaluaciones(session, user, empresa.id, pagination)

        assert result.total == 3
        assert len(result.items) == 2
        assert result.has_next is True


# ============================================================================
# Get Evaluacion by ID Tests
# ============================================================================


class TestGetEvaluacionById:
    """Test the get_evaluacion_by_id service function."""

    @pytest.mark.asyncio
    async def test_get_success(self, seeded_db):
        """Get existing evaluation returns full detail."""
        data = seeded_db
        user = data["user"]
        empresa = data["empresa"]
        session = data["session"]

        answers = {
            1: True, 2: True, 3: True, 4: True, 5: True,
            6: True, 7: True, 8: True, 9: True, 10: True, 11: True,
        }
        create_data = EvaluacionCreate(empresa_id=empresa.id, answers=answers)
        created = await submit_evaluacion(session, user, create_data)

        result = await get_evaluacion_by_id(session, user, created.id)

        assert result.id == created.id
        assert result.score == 100
        # JSON serialization converts int keys to strings
        expected_answers = {str(k): v for k, v in answers.items()}
        assert result.answers == expected_answers

    @pytest.mark.asyncio
    async def test_get_not_found_raises_404(self, seeded_db):
        """Get non-existent evaluation raises 404."""
        from fastapi import HTTPException

        data = seeded_db
        user = data["user"]
        session = data["session"]

        with pytest.raises(HTTPException) as exc_info:
            await get_evaluacion_by_id(session, user, uuid.uuid4())
        assert exc_info.value.status_code == 404

    @pytest.mark.asyncio
    async def test_get_no_access_raises_403(self, seeded_db):
        """Get evaluation for empresa without membership raises 403."""
        from fastapi import HTTPException

        data = seeded_db
        session = data["session"]

        # Create another user without membership
        other_user = User(
            id=uuid.uuid4(),
            email="other@test.com",
            name="Other User",
            provider="google",
            provider_id="other-sub-456",
            is_active=True,
        )
        session.add(other_user)
        await session.flush()

        # Create evaluation as original user
        user = data["user"]
        empresa = data["empresa"]
        answers = {1: False, 6: True, 7: True, 8: True, 9: True, 10: False}
        create_data = EvaluacionCreate(empresa_id=empresa.id, answers=answers)
        created = await submit_evaluacion(session, user, create_data)

        # Reload other_user with memberships eagerly loaded
        other_user = await _reload_user_with_memberships(session, other_user.id)

        # Other user tries to access
        with pytest.raises(HTTPException) as exc_info:
            await get_evaluacion_by_id(session, other_user, created.id)
        assert exc_info.value.status_code == 403


# ============================================================================
# Admin Access Tests
# ============================================================================


class TestAdminAccess:
    """Test that admins bypass membership checks."""

    @pytest.mark.asyncio
    async def test_admin_can_list_any_empresa(self, seeded_db):
        """Admin user can list evaluations of any empresa."""
        data = seeded_db
        session = data["session"]

        # Create admin user
        admin_user = User(
            id=uuid.uuid4(),
            email="admin@test.com",
            name="Admin User",
            provider="google",
            provider_id="admin-sub-789",
            is_active=True,
        )
        session.add(admin_user)
        await session.flush()

        # Give admin the admin role in some empresa (to have the admin role)
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

        # Reload admin user with memberships
        admin_user = await _reload_user_with_memberships(session, admin_user.id)

        # Admin should be able to list evaluations of original empresa
        empresa = data["empresa"]
        pagination = PaginationParams(page=1, page_size=20)
        result = await list_evaluaciones(session, admin_user, empresa.id, pagination)

        assert result.total == 0  # No evals yet, but no 403
