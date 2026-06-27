"""Tests for empresa (company) management module."""

import uuid
from datetime import datetime
from unittest.mock import AsyncMock, MagicMock, patch

import pytest
from fastapi import status
from httpx import ASGITransport, AsyncClient

from src.main import app
from src.models import Empresa, EmpresaUser, RolEnum, User
from src.modules.auth.dependencies import get_current_user
from src.modules.empresas.validators import validate_nit_format


# --- NIT Validator Unit Tests ---


class TestNITValidator:
    """Unit tests for NIT format validation."""

    def test_valid_9_digits(self):
        assert validate_nit_format("123456789") is True

    def test_valid_10_digits(self):
        assert validate_nit_format("1234567890") is True

    def test_valid_9_digits_with_verification(self):
        assert validate_nit_format("123456789-1") is True

    def test_valid_10_digits_with_verification(self):
        assert validate_nit_format("1234567890-5") is True

    def test_invalid_too_short(self):
        assert validate_nit_format("12345678") is False

    def test_invalid_too_long(self):
        assert validate_nit_format("12345678901") is False

    def test_invalid_letters(self):
        assert validate_nit_format("12345678a") is False

    def test_invalid_two_digit_verification(self):
        assert validate_nit_format("123456789-12") is False

    def test_invalid_empty(self):
        assert validate_nit_format("") is False

    def test_invalid_only_hyphen(self):
        assert validate_nit_format("-") is False

    def test_invalid_spaces(self):
        assert validate_nit_format("123 456 789") is False

    def test_invalid_special_chars(self):
        assert validate_nit_format("123456789.1") is False

    def test_invalid_hyphen_no_digit(self):
        assert validate_nit_format("123456789-") is False

    def test_invalid_leading_hyphen(self):
        assert validate_nit_format("-123456789") is False

    def test_valid_boundary_9_digits_with_check(self):
        assert validate_nit_format("999999999-0") is True

    def test_valid_all_zeros(self):
        assert validate_nit_format("000000000") is True


# --- Helpers ---


def _make_user(role: RolEnum, user_id: uuid.UUID | None = None) -> User:
    """Create a mock user with memberships loaded."""
    uid = user_id or uuid.uuid4()
    user = MagicMock(spec=User)
    user.id = uid
    user.email = "test@example.com"
    user.name = "Test User"
    user.is_active = True

    membership = MagicMock(spec=EmpresaUser)
    membership.rol = role
    user.memberships = [membership]
    return user


def _make_no_role_user() -> User:
    """Create a mock user with no memberships."""
    user = MagicMock(spec=User)
    user.id = uuid.uuid4()
    user.email = "norole@example.com"
    user.name = "No Role"
    user.is_active = True
    user.memberships = []
    return user


@pytest.fixture
def admin_user():
    return _make_user(RolEnum.admin)


@pytest.fixture
def evaluador_user():
    return _make_user(RolEnum.evaluador)


@pytest.fixture
def no_role_user():
    return _make_no_role_user()


def _override_user(user):
    """Return a dependency override function for get_current_user."""

    async def _override():
        return user

    return _override


# --- API Integration Tests ---


class TestCreateEmpresa:
    """Tests for POST /api/v1/empresas."""

    @pytest.mark.asyncio
    async def test_create_empresa_success(self, admin_user):
        """Admin can create a company with valid data."""
        empresa_id = uuid.uuid4()

        app.dependency_overrides[get_current_user] = _override_user(admin_user)
        try:
            with patch(
                "src.modules.empresas.router.create_empresa",
            ) as mock_create:
                mock_empresa = MagicMock()
                mock_empresa.id = empresa_id
                mock_empresa.nombre = "Mi Empresa"
                mock_empresa.nit = "123456789"
                mock_empresa.sector = "Technology"
                mock_empresa.tamano = "Grande"
                mock_empresa.created_at = datetime(2024, 1, 1)
                mock_empresa.updated_at = datetime(2024, 1, 1)
                mock_create.return_value = mock_empresa

                async with AsyncClient(
                    transport=ASGITransport(app=app), base_url="http://test"
                ) as client:
                    response = await client.post(
                        "/api/v1/empresas",
                        json={
                            "nombre": "Mi Empresa",
                            "nit": "123456789",
                            "sector": "Technology",
                            "tamano": "Grande",
                        },
                        headers={"Authorization": "Bearer test-token"},
                    )

                assert response.status_code == status.HTTP_201_CREATED
                data = response.json()
                assert data["nombre"] == "Mi Empresa"
                assert data["nit"] == "123456789"
        finally:
            app.dependency_overrides.clear()

    @pytest.mark.asyncio
    async def test_create_empresa_invalid_nit_format(self, admin_user):
        """Returns 422 when NIT format is invalid."""
        app.dependency_overrides[get_current_user] = _override_user(admin_user)
        try:
            async with AsyncClient(
                transport=ASGITransport(app=app), base_url="http://test"
            ) as client:
                response = await client.post(
                    "/api/v1/empresas",
                    json={
                        "nombre": "Mi Empresa",
                        "nit": "invalid-nit",
                        "sector": "Technology",
                    },
                    headers={"Authorization": "Bearer test-token"},
                )

            assert response.status_code == status.HTTP_422_UNPROCESSABLE_ENTITY
        finally:
            app.dependency_overrides.clear()

    @pytest.mark.asyncio
    async def test_create_empresa_forbidden_for_evaluador(self, evaluador_user):
        """Evaluador cannot create companies."""
        app.dependency_overrides[get_current_user] = _override_user(evaluador_user)
        try:
            async with AsyncClient(
                transport=ASGITransport(app=app), base_url="http://test"
            ) as client:
                response = await client.post(
                    "/api/v1/empresas",
                    json={
                        "nombre": "Mi Empresa",
                        "nit": "123456789",
                    },
                    headers={"Authorization": "Bearer test-token"},
                )

            assert response.status_code == status.HTTP_403_FORBIDDEN
        finally:
            app.dependency_overrides.clear()

    @pytest.mark.asyncio
    async def test_create_empresa_duplicate_nit(self, admin_user):
        """Returns 409 when NIT already exists."""
        from fastapi import HTTPException

        app.dependency_overrides[get_current_user] = _override_user(admin_user)
        try:
            with patch(
                "src.modules.empresas.router.create_empresa",
                side_effect=HTTPException(
                    status_code=status.HTTP_409_CONFLICT,
                    detail="A company with NIT '123456789' already exists",
                ),
            ):
                async with AsyncClient(
                    transport=ASGITransport(app=app), base_url="http://test"
                ) as client:
                    response = await client.post(
                        "/api/v1/empresas",
                        json={
                            "nombre": "Duplicate Company",
                            "nit": "123456789",
                        },
                        headers={"Authorization": "Bearer test-token"},
                    )

                assert response.status_code == status.HTTP_409_CONFLICT
                assert "already exists" in response.json()["detail"]
        finally:
            app.dependency_overrides.clear()


class TestListEmpresas:
    """Tests for GET /api/v1/empresas."""

    @pytest.mark.asyncio
    async def test_list_empresas_admin_sees_all(self, admin_user):
        """Admin sees all companies."""
        app.dependency_overrides[get_current_user] = _override_user(admin_user)
        try:
            with patch(
                "src.modules.empresas.router.list_empresas",
            ) as mock_list:
                from src.shared.utils.pagination import PaginatedResult

                emp = MagicMock()
                emp.id = uuid.uuid4()
                emp.nombre = "Test Co"
                emp.nit = "123456789"
                emp.sector = "Tech"
                emp.tamano = "Grande"
                emp.created_at = datetime(2024, 1, 1)
                emp.updated_at = datetime(2024, 1, 1)

                mock_list.return_value = PaginatedResult(
                    items=[emp], total=1, page=1, page_size=20
                )

                async with AsyncClient(
                    transport=ASGITransport(app=app), base_url="http://test"
                ) as client:
                    response = await client.get(
                        "/api/v1/empresas",
                        headers={"Authorization": "Bearer test-token"},
                    )

                assert response.status_code == status.HTTP_200_OK
                data = response.json()
                assert len(data["items"]) == 1
                assert data["pagination"]["total"] == 1
        finally:
            app.dependency_overrides.clear()

    @pytest.mark.asyncio
    async def test_list_empresas_forbidden_no_role(self, no_role_user):
        """User with no roles cannot list companies."""
        app.dependency_overrides[get_current_user] = _override_user(no_role_user)
        try:
            async with AsyncClient(
                transport=ASGITransport(app=app), base_url="http://test"
            ) as client:
                response = await client.get(
                    "/api/v1/empresas",
                    headers={"Authorization": "Bearer test-token"},
                )

            assert response.status_code == status.HTTP_403_FORBIDDEN
        finally:
            app.dependency_overrides.clear()


class TestGetEmpresa:
    """Tests for GET /api/v1/empresas/{id}."""

    @pytest.mark.asyncio
    async def test_get_empresa_success(self, admin_user):
        """Get an existing empresa by ID."""
        empresa_id = uuid.uuid4()

        app.dependency_overrides[get_current_user] = _override_user(admin_user)
        try:
            with patch(
                "src.modules.empresas.router.get_empresa_by_id",
            ) as mock_get:
                emp = MagicMock()
                emp.id = empresa_id
                emp.nombre = "Found Co"
                emp.nit = "987654321"
                emp.sector = "Finance"
                emp.tamano = "Mediana"
                emp.created_at = datetime(2024, 1, 1)
                emp.updated_at = datetime(2024, 1, 1)
                mock_get.return_value = emp

                async with AsyncClient(
                    transport=ASGITransport(app=app), base_url="http://test"
                ) as client:
                    response = await client.get(
                        f"/api/v1/empresas/{empresa_id}",
                        headers={"Authorization": "Bearer test-token"},
                    )

                assert response.status_code == status.HTTP_200_OK
                assert response.json()["nit"] == "987654321"
        finally:
            app.dependency_overrides.clear()

    @pytest.mark.asyncio
    async def test_get_empresa_not_found(self, admin_user):
        """Returns 404 for non-existent empresa."""
        from fastapi import HTTPException

        missing_id = uuid.uuid4()

        app.dependency_overrides[get_current_user] = _override_user(admin_user)
        try:
            with patch(
                "src.modules.empresas.router.get_empresa_by_id",
                side_effect=HTTPException(
                    status_code=status.HTTP_404_NOT_FOUND,
                    detail="Company not found",
                ),
            ):
                async with AsyncClient(
                    transport=ASGITransport(app=app), base_url="http://test"
                ) as client:
                    response = await client.get(
                        f"/api/v1/empresas/{missing_id}",
                        headers={"Authorization": "Bearer test-token"},
                    )

                assert response.status_code == status.HTTP_404_NOT_FOUND
        finally:
            app.dependency_overrides.clear()


class TestUpdateEmpresa:
    """Tests for PUT /api/v1/empresas/{id}."""

    @pytest.mark.asyncio
    async def test_update_empresa_success(self, admin_user):
        """Admin can update company data (excluding NIT)."""
        empresa_id = uuid.uuid4()

        app.dependency_overrides[get_current_user] = _override_user(admin_user)
        try:
            with patch(
                "src.modules.empresas.router.update_empresa",
            ) as mock_update:
                emp = MagicMock()
                emp.id = empresa_id
                emp.nombre = "Updated Name"
                emp.nit = "123456789"
                emp.sector = "Updated Sector"
                emp.tamano = "Grande"
                emp.created_at = datetime(2024, 1, 1)
                emp.updated_at = datetime(2024, 6, 1)
                mock_update.return_value = emp

                async with AsyncClient(
                    transport=ASGITransport(app=app), base_url="http://test"
                ) as client:
                    response = await client.put(
                        f"/api/v1/empresas/{empresa_id}",
                        json={"nombre": "Updated Name", "sector": "Updated Sector"},
                        headers={"Authorization": "Bearer test-token"},
                    )

                assert response.status_code == status.HTTP_200_OK
                assert response.json()["nombre"] == "Updated Name"
        finally:
            app.dependency_overrides.clear()

    @pytest.mark.asyncio
    async def test_update_empresa_forbidden_for_evaluador(self, evaluador_user):
        """Evaluador cannot update companies."""
        empresa_id = uuid.uuid4()

        app.dependency_overrides[get_current_user] = _override_user(evaluador_user)
        try:
            async with AsyncClient(
                transport=ASGITransport(app=app), base_url="http://test"
            ) as client:
                response = await client.put(
                    f"/api/v1/empresas/{empresa_id}",
                    json={"nombre": "Hacked"},
                    headers={"Authorization": "Bearer test-token"},
                )

            assert response.status_code == status.HTTP_403_FORBIDDEN
        finally:
            app.dependency_overrides.clear()


class TestAssignMember:
    """Tests for POST /api/v1/empresas/{id}/members."""

    @pytest.mark.asyncio
    async def test_assign_member_success(self, admin_user):
        """Admin can assign a user to a company."""
        empresa_id = uuid.uuid4()
        user_id = uuid.uuid4()

        app.dependency_overrides[get_current_user] = _override_user(admin_user)
        try:
            with patch(
                "src.modules.empresas.router.assign_member",
            ) as mock_assign:
                membership = MagicMock()
                membership.id = uuid.uuid4()
                membership.user_id = user_id
                membership.empresa_id = empresa_id
                membership.rol = "evaluador"
                mock_assign.return_value = membership

                async with AsyncClient(
                    transport=ASGITransport(app=app), base_url="http://test"
                ) as client:
                    response = await client.post(
                        f"/api/v1/empresas/{empresa_id}/members",
                        json={"user_id": str(user_id), "rol": "evaluador"},
                        headers={"Authorization": "Bearer test-token"},
                    )

                assert response.status_code == status.HTTP_201_CREATED
                data = response.json()
                assert data["rol"] == "evaluador"
                assert data["user_id"] == str(user_id)
        finally:
            app.dependency_overrides.clear()

    @pytest.mark.asyncio
    async def test_assign_member_invalid_role(self, admin_user):
        """Returns 422 for invalid role value."""
        empresa_id = uuid.uuid4()

        app.dependency_overrides[get_current_user] = _override_user(admin_user)
        try:
            async with AsyncClient(
                transport=ASGITransport(app=app), base_url="http://test"
            ) as client:
                response = await client.post(
                    f"/api/v1/empresas/{empresa_id}/members",
                    json={"user_id": str(uuid.uuid4()), "rol": "superuser"},
                    headers={"Authorization": "Bearer test-token"},
                )

            assert response.status_code == status.HTTP_422_UNPROCESSABLE_ENTITY
        finally:
            app.dependency_overrides.clear()

    @pytest.mark.asyncio
    async def test_assign_member_forbidden_for_evaluador(self, evaluador_user):
        """Evaluador cannot assign members."""
        empresa_id = uuid.uuid4()

        app.dependency_overrides[get_current_user] = _override_user(evaluador_user)
        try:
            async with AsyncClient(
                transport=ASGITransport(app=app), base_url="http://test"
            ) as client:
                response = await client.post(
                    f"/api/v1/empresas/{empresa_id}/members",
                    json={"user_id": str(uuid.uuid4()), "rol": "evaluador"},
                    headers={"Authorization": "Bearer test-token"},
                )

            assert response.status_code == status.HTTP_403_FORBIDDEN
        finally:
            app.dependency_overrides.clear()


class TestNITImmutability:
    """Tests ensuring NIT cannot be changed via PUT."""

    def test_nit_not_in_update_schema(self):
        """EmpresaUpdate schema does not accept NIT field."""
        from src.modules.empresas.schemas import EmpresaUpdate

        data = EmpresaUpdate(nombre="Updated")
        assert "nit" not in data.model_dump(exclude_unset=True)

    def test_nit_field_ignored_in_update(self):
        """Even if NIT is passed, the schema ignores extra fields."""
        from src.modules.empresas.schemas import EmpresaUpdate

        data = EmpresaUpdate.model_validate({"nombre": "X", "nit": "999999999"})
        dumped = data.model_dump(exclude_unset=True)
        assert "nit" not in dumped
