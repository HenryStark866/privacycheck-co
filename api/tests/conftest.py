"""Test fixtures for Habeas Check API tests.

Provides:
- Async SQLite test database with all tables
- Authenticated test client (mock Supabase JWT)
- Pre-seeded empresa + user + membership
- Mock Redis client
- Mock AI Gateway
"""

import time
import uuid
from datetime import datetime, timezone
from unittest.mock import AsyncMock, MagicMock, patch

import pytest
from httpx import ASGITransport, AsyncClient
from jose import jwt
from sqlalchemy import StaticPool, select
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine
from sqlalchemy.orm import selectinload

from src.database import Base, get_db
from src.main import app
from src.models import Empresa, EmpresaUser, Evaluacion, RolEnum, User


# --- Constants ---

TEST_DATABASE_URL = "sqlite+aiosqlite:///:memory:"
TEST_JWT_SECRET = "test-supabase-jwt-secret-for-testing-purposes"


# --- Database Fixtures ---


@pytest.fixture
async def async_engine():
    """Create an async test engine with SQLite."""
    engine = create_async_engine(
        TEST_DATABASE_URL,
        connect_args={"check_same_thread": False},
        poolclass=StaticPool,
    )
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
    yield engine
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.drop_all)
    await engine.dispose()


@pytest.fixture
async def db_session(async_engine):
    """Create an async session for tests."""
    session_factory = async_sessionmaker(
        async_engine, class_=AsyncSession, expire_on_commit=False
    )
    async with session_factory() as session:
        yield session


@pytest.fixture
async def seeded_db(db_session):
    """Seed the database with a user, empresa, and membership.

    Returns user with memberships eagerly loaded.
    """
    user = User(
        id=uuid.uuid4(),
        email="evaluador@test.com",
        name="Test Evaluador",
        provider="google",
        provider_id="supabase-sub-123",
        is_active=True,
    )
    empresa = Empresa(
        id=uuid.uuid4(),
        nombre="Test Company",
        nit="123456789",
        sector="Tecnología",
        tamano="Mediana",
    )
    db_session.add(user)
    db_session.add(empresa)
    await db_session.flush()

    membership = EmpresaUser(
        user_id=user.id,
        empresa_id=empresa.id,
        rol=RolEnum.evaluador,
    )
    db_session.add(membership)
    await db_session.flush()

    # Reload user with memberships eagerly loaded
    stmt = select(User).where(User.id == user.id).options(selectinload(User.memberships))
    result = await db_session.execute(stmt)
    user = result.scalar_one()

    return {
        "user": user,
        "empresa": empresa,
        "membership": membership,
        "session": db_session,
    }


# --- JWT Helper ---


def make_test_token(
    sub: str = "supabase-sub-123",
    email: str = "evaluador@test.com",
    exp_offset: int = 3600,
    secret: str = TEST_JWT_SECRET,
    extra_claims: dict | None = None,
) -> str:
    """Create a valid Supabase-style JWT token for testing."""
    payload = {
        "sub": sub,
        "email": email,
        "exp": int(time.time()) + exp_offset,
        "iat": int(time.time()),
        "aud": "authenticated",
        "role": "authenticated",
        "user_metadata": {"full_name": "Test Evaluador"},
        "app_metadata": {"provider": "google"},
    }
    if extra_claims:
        payload.update(extra_claims)
    return jwt.encode(payload, secret, algorithm="HS256")


# --- Mock Redis ---


@pytest.fixture
def mock_redis():
    """Mock Redis client that always returns cache miss."""
    redis_mock = AsyncMock()
    redis_mock.get = AsyncMock(return_value=None)
    redis_mock.set = AsyncMock(return_value=True)
    redis_mock.pipeline = MagicMock()
    redis_mock.zremrangebyscore = AsyncMock()
    redis_mock.zcard = AsyncMock(return_value=0)
    redis_mock.zadd = AsyncMock()
    redis_mock.expire = AsyncMock()
    redis_mock.zrange = AsyncMock(return_value=[])
    redis_mock.zrem = AsyncMock()
    # Pipeline mock
    pipe_mock = AsyncMock()
    pipe_mock.zremrangebyscore = MagicMock(return_value=pipe_mock)
    pipe_mock.zcard = MagicMock(return_value=pipe_mock)
    pipe_mock.zadd = MagicMock(return_value=pipe_mock)
    pipe_mock.expire = MagicMock(return_value=pipe_mock)
    pipe_mock.execute = AsyncMock(return_value=[0, 0, True, True])
    redis_mock.pipeline = MagicMock(return_value=pipe_mock)
    return redis_mock


# --- Authenticated Test Client ---


@pytest.fixture
async def authenticated_client(async_engine):
    """
    Create an authenticated HTTP test client with:
    - In-memory SQLite DB override
    - Mocked Supabase JWT validation (uses test secret)
    - Mocked Redis for rate limiter (always allows)
    - Pre-seeded admin user + empresa + membership
    """
    session_factory = async_sessionmaker(
        async_engine, class_=AsyncSession, expire_on_commit=False
    )

    # Override get_db dependency
    async def _override_get_db():
        async with session_factory() as session:
            try:
                yield session
                await session.commit()
            except Exception:
                await session.rollback()
                raise

    app.dependency_overrides[get_db] = _override_get_db

    # Seed admin user + empresa + membership
    async with session_factory() as session:
        admin_user = User(
            id=uuid.uuid4(),
            email="admin@test.com",
            name="Admin User",
            provider="google",
            provider_id="supabase-admin-sub",
            is_active=True,
        )
        session.add(admin_user)
        await session.flush()

        empresa = Empresa(
            id=uuid.uuid4(),
            nombre="Integration Test Co",
            nit="9876543210",
            sector="Tecnología",
            tamano="Mediana",
        )
        session.add(empresa)
        await session.flush()

        membership = EmpresaUser(
            user_id=admin_user.id,
            empresa_id=empresa.id,
            rol=RolEnum.admin,
        )
        session.add(membership)
        await session.commit()

    # Create JWT for admin user
    token = make_test_token(
        sub="supabase-admin-sub",
        email="admin@test.com",
        extra_claims={
            "user_metadata": {"full_name": "Admin User"},
            "app_metadata": {"provider": "google"},
        },
    )

    # Patch decode function to accept our test secret
    with patch("src.modules.auth.service.settings") as mock_settings:
        mock_settings.supabase_jwt_secret = TEST_JWT_SECRET

        # Patch the rate limiter to always allow
        async def _always_allow(self, key, limit):
            return (True, 0)

        with patch(
            "src.shared.middleware.rate_limit.RateLimitMiddleware._check_rate_limit",
            _always_allow,
        ):
            transport = ASGITransport(app=app)
            async with AsyncClient(
                transport=transport,
                base_url="http://test",
                headers={"Authorization": f"Bearer {token}"},
            ) as client:
                client._test_data = {  # type: ignore
                    "admin_user_id": admin_user.id,
                    "empresa_id": empresa.id,
                    "token": token,
                }
                yield client

    app.dependency_overrides.clear()


@pytest.fixture
async def unauthenticated_client(async_engine):
    """
    Create an unauthenticated HTTP test client (no JWT).
    Uses the same DB but no auth header.
    """
    session_factory = async_sessionmaker(
        async_engine, class_=AsyncSession, expire_on_commit=False
    )

    async def _override_get_db():
        async with session_factory() as session:
            try:
                yield session
                await session.commit()
            except Exception:
                await session.rollback()
                raise

    app.dependency_overrides[get_db] = _override_get_db

    async def _always_allow_unauth(self, key, limit):
        return (True, 0)

    with patch(
        "src.shared.middleware.rate_limit.RateLimitMiddleware._check_rate_limit",
        _always_allow_unauth,
    ):
        transport = ASGITransport(app=app)
        async with AsyncClient(
            transport=transport,
            base_url="http://test",
        ) as client:
            yield client

    app.dependency_overrides.clear()
