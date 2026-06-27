"""Tests for Chat Service: session creation, history boundaries, context enrichment."""

import uuid
from datetime import datetime, timedelta
from unittest.mock import AsyncMock, MagicMock, patch

import pytest
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from src.models import ChatMessage, ChatSession, Empresa, Evaluacion
from src.modules.ai.gateway import AIGateway, AIResponse
from src.modules.ai.prompts import ChatContext, CompanyContext, DiagnosticState
from src.modules.chat.service import ChatService


# --- Fixtures ---


@pytest.fixture
def mock_ai_gateway():
    """Create a mock AI Gateway that returns a predictable response."""
    gateway = AsyncMock(spec=AIGateway)
    gateway.model = "deepseek-chat"
    gateway.chat = AsyncMock(
        return_value=AIResponse(
            reply="Test AI response",
            response_type="freeform",
            metadata={"model": "deepseek-chat", "cached": False},
            suggested_actions=[],
        )
    )

    async def _stream_gen(*args, **kwargs):
        for chunk in ["Hello", " from", " AI"]:
            yield chunk

    gateway.chat_stream = MagicMock(return_value=_stream_gen())
    return gateway


@pytest.fixture
async def chat_service(db_session, mock_ai_gateway):
    """Create a ChatService instance with test DB and mock AI gateway."""
    return ChatService(db=db_session, ai_gateway=mock_ai_gateway)


@pytest.fixture
async def test_user(db_session):
    """Create a test user in the database."""
    from src.models import User

    user = User(
        id=uuid.uuid4(),
        email="chat_test@example.com",
        name="Chat Test User",
        provider="google",
        provider_id="supabase-chat-123",
        is_active=True,
    )
    db_session.add(user)
    await db_session.flush()
    return user


@pytest.fixture
async def test_empresa(db_session):
    """Create a test empresa for context enrichment tests."""
    empresa = Empresa(
        id=uuid.uuid4(),
        nombre="Empresa Prueba S.A.",
        nit="9876543210",
        sector="Salud",
        tamano="Grande",
    )
    db_session.add(empresa)
    await db_session.flush()
    return empresa


@pytest.fixture
async def test_evaluacion(db_session, test_user, test_empresa):
    """Create a test evaluation for context enrichment."""
    evaluacion = Evaluacion(
        id=uuid.uuid4(),
        empresa_id=test_empresa.id,
        user_id=test_user.id,
        answers={1: True, 2: True, 3: False, 6: True, 7: True, 8: False, 9: True, 10: True},
        score=68,
        maturity="Gestionado",
        blocks={
            "A": {"name": "Política de datos personales", "earned": 20, "max": 40},
            "B": {"name": "Privacidad desde el diseño", "earned": 24, "max": 36},
            "C": {"name": "Gobernanza", "earned": 24, "max": 24},
        },
        gaps=[
            {"question_id": 3, "weight": 10, "text": "Q3 text"},
            {"question_id": 8, "weight": 12, "text": "Q8 text"},
        ],
        notes=[],
    )
    db_session.add(evaluacion)
    await db_session.flush()
    return evaluacion


# --- Tests: Session Creation ---


class TestSessionCreation:
    """Tests for get_or_create_session."""

    async def test_creates_new_session_when_no_id_provided(
        self, chat_service: ChatService, test_user, db_session
    ):
        """A new session is created when session_id is None."""
        session = await chat_service.get_or_create_session(
            session_id=None,
            user_id=test_user.id,
            channel="web",
        )

        assert session is not None
        assert session.id is not None
        assert session.user_id == test_user.id
        assert session.channel == "web"
        assert session.is_active is True

    async def test_creates_new_session_with_context(
        self, chat_service: ChatService, test_user, test_empresa, db_session
    ):
        """A new session stores empresa_id from context."""
        context = {"empresa_id": str(test_empresa.id)}
        session = await chat_service.get_or_create_session(
            session_id=None,
            user_id=test_user.id,
            channel="api",
            context=context,
        )

        assert session.empresa_id == test_empresa.id
        assert session.context == context

    async def test_retrieves_existing_session_by_id(
        self, chat_service: ChatService, test_user, db_session
    ):
        """An existing active session is returned when a valid session_id is provided."""
        # Create a session first
        session = await chat_service.get_or_create_session(
            session_id=None,
            user_id=test_user.id,
            channel="web",
        )
        original_id = session.id

        # Retrieve it by ID
        retrieved = await chat_service.get_or_create_session(
            session_id=str(original_id),
            user_id=test_user.id,
            channel="web",
        )

        assert retrieved.id == original_id

    async def test_creates_new_session_for_invalid_session_id(
        self, chat_service: ChatService, test_user, db_session
    ):
        """A new session is created when session_id is invalid UUID."""
        session = await chat_service.get_or_create_session(
            session_id="not-a-valid-uuid",
            user_id=test_user.id,
            channel="web",
        )

        assert session is not None
        assert session.user_id == test_user.id

    async def test_creates_new_session_for_nonexistent_session_id(
        self, chat_service: ChatService, test_user, db_session
    ):
        """A new session is created when session_id does not exist in DB."""
        fake_id = str(uuid.uuid4())
        session = await chat_service.get_or_create_session(
            session_id=fake_id,
            user_id=test_user.id,
            channel="web",
        )

        assert session is not None
        assert str(session.id) != fake_id

    async def test_does_not_retrieve_session_from_different_user(
        self, chat_service: ChatService, test_user, db_session
    ):
        """A session belonging to another user is not returned."""
        # Create session for test_user
        session = await chat_service.get_or_create_session(
            session_id=None,
            user_id=test_user.id,
            channel="web",
        )

        # Try to retrieve it with a different user_id
        other_user_id = uuid.uuid4()
        new_session = await chat_service.get_or_create_session(
            session_id=str(session.id),
            user_id=other_user_id,
            channel="web",
        )

        # Should create a new session since it doesn't belong to other_user
        assert new_session.id != session.id
        assert new_session.user_id == other_user_id


# --- Tests: History Boundaries ---


class TestHistoryBoundaries:
    """Tests for load_history — Property 13: Chat History Bounded at 10."""

    async def test_empty_session_returns_empty_history(
        self, chat_service: ChatService, test_user, db_session
    ):
        """A session with no messages returns an empty list."""
        session = await chat_service.get_or_create_session(
            session_id=None,
            user_id=test_user.id,
            channel="web",
        )

        history = await chat_service.load_history(session.id)
        assert history == []

    async def test_fewer_than_10_messages_returns_all(
        self, chat_service: ChatService, test_user, db_session
    ):
        """A session with N < 10 messages returns exactly N messages."""
        session = await chat_service.get_or_create_session(
            session_id=None,
            user_id=test_user.id,
            channel="web",
        )

        # Add 5 messages
        for i in range(5):
            role = "user" if i % 2 == 0 else "assistant"
            msg = ChatMessage(
                session_id=session.id,
                role=role,
                content=f"Message {i}",
                created_at=datetime.utcnow() + timedelta(seconds=i),
            )
            db_session.add(msg)
        await db_session.flush()

        history = await chat_service.load_history(session.id)
        assert len(history) == 5

    async def test_exactly_10_messages_returns_all(
        self, chat_service: ChatService, test_user, db_session
    ):
        """A session with exactly 10 messages returns all 10."""
        session = await chat_service.get_or_create_session(
            session_id=None,
            user_id=test_user.id,
            channel="web",
        )

        for i in range(10):
            role = "user" if i % 2 == 0 else "assistant"
            msg = ChatMessage(
                session_id=session.id,
                role=role,
                content=f"Message {i}",
                created_at=datetime.utcnow() + timedelta(seconds=i),
            )
            db_session.add(msg)
        await db_session.flush()

        history = await chat_service.load_history(session.id)
        assert len(history) == 10

    async def test_more_than_10_messages_returns_last_10(
        self, chat_service: ChatService, test_user, db_session
    ):
        """A session with N > 10 messages returns exactly the last 10."""
        session = await chat_service.get_or_create_session(
            session_id=None,
            user_id=test_user.id,
            channel="web",
        )

        # Add 15 messages
        for i in range(15):
            role = "user" if i % 2 == 0 else "assistant"
            msg = ChatMessage(
                session_id=session.id,
                role=role,
                content=f"Message {i}",
                created_at=datetime.utcnow() + timedelta(seconds=i),
            )
            db_session.add(msg)
        await db_session.flush()

        history = await chat_service.load_history(session.id)
        assert len(history) == 10
        # Should be messages 5-14 (the last 10, chronological)
        assert history[0]["content"] == "Message 5"
        assert history[-1]["content"] == "Message 14"

    async def test_history_is_chronological(
        self, chat_service: ChatService, test_user, db_session
    ):
        """History messages are returned in chronological order (oldest first)."""
        session = await chat_service.get_or_create_session(
            session_id=None,
            user_id=test_user.id,
            channel="web",
        )

        # Add messages in order
        for i in range(7):
            msg = ChatMessage(
                session_id=session.id,
                role="user" if i % 2 == 0 else "assistant",
                content=f"Msg {i}",
                created_at=datetime.utcnow() + timedelta(seconds=i),
            )
            db_session.add(msg)
        await db_session.flush()

        history = await chat_service.load_history(session.id)
        # Verify chronological order
        for idx in range(len(history) - 1):
            current_num = int(history[idx]["content"].split(" ")[1])
            next_num = int(history[idx + 1]["content"].split(" ")[1])
            assert current_num < next_num

    async def test_history_contains_role_and_content(
        self, chat_service: ChatService, test_user, db_session
    ):
        """Each history item has 'role' and 'content' keys."""
        session = await chat_service.get_or_create_session(
            session_id=None,
            user_id=test_user.id,
            channel="web",
        )

        msg = ChatMessage(
            session_id=session.id,
            role="user",
            content="Hello AI",
        )
        db_session.add(msg)
        await db_session.flush()

        history = await chat_service.load_history(session.id)
        assert len(history) == 1
        assert history[0] == {"role": "user", "content": "Hello AI"}


# --- Tests: Context Enrichment ---


class TestContextEnrichment:
    """Tests for enrich_context."""

    async def test_enriches_with_empresa_data(
        self, chat_service: ChatService, test_user, test_empresa, db_session
    ):
        """Context includes company name, sector, and size from empresa."""
        session = await chat_service.get_or_create_session(
            session_id=None,
            user_id=test_user.id,
            channel="web",
            context={"empresa_id": str(test_empresa.id)},
        )

        ctx = await chat_service.enrich_context(session)

        assert ctx.company is not None
        assert ctx.company.nombre == "Empresa Prueba S.A."
        assert ctx.company.sector == "Salud"
        assert ctx.company.tamano == "Grande"

    async def test_enriches_with_evaluacion_state(
        self,
        chat_service: ChatService,
        test_user,
        test_empresa,
        test_evaluacion,
        db_session,
    ):
        """Context includes diagnostic score, maturity, gaps from evaluation."""
        session = await chat_service.get_or_create_session(
            session_id=None,
            user_id=test_user.id,
            channel="web",
            context={
                "empresa_id": str(test_empresa.id),
                "evaluacion_id": str(test_evaluacion.id),
            },
        )

        ctx = await chat_service.enrich_context(session)

        assert ctx.diagnostic is not None
        assert ctx.diagnostic.score == 68
        assert ctx.diagnostic.maturity == "Gestionado"
        assert ctx.diagnostic.gaps is not None
        assert len(ctx.diagnostic.gaps) == 2
        assert ctx.diagnostic.answers is not None

    async def test_enriches_from_request_context_answers(
        self, chat_service: ChatService, test_user, db_session
    ):
        """Context includes inline answers from request context dict."""
        session = await chat_service.get_or_create_session(
            session_id=None,
            user_id=test_user.id,
            channel="web",
        )

        context_data = {
            "answers": {1: True, 6: True, 7: False},
            "score": 50,
            "maturity": "Gestionado",
        }

        ctx = await chat_service.enrich_context(session, context=context_data)

        assert ctx.diagnostic is not None
        assert ctx.diagnostic.score == 50
        assert ctx.diagnostic.maturity == "Gestionado"
        assert ctx.diagnostic.answers == {1: True, 6: True, 7: False}

    async def test_empty_context_returns_none_fields(
        self, chat_service: ChatService, test_user, db_session
    ):
        """With no empresa or evaluation, context fields are None."""
        session = await chat_service.get_or_create_session(
            session_id=None,
            user_id=test_user.id,
            channel="web",
        )

        ctx = await chat_service.enrich_context(session)

        assert ctx.company is None
        assert ctx.diagnostic is None


# --- Tests: handle_message orchestration ---


class TestHandleMessage:
    """Tests for the full handle_message flow."""

    async def test_handle_message_returns_expected_response(
        self, chat_service: ChatService, test_user, db_session
    ):
        """handle_message returns dict with reply, type, session_id, metadata, suggested_actions."""
        result = await chat_service.handle_message(
            session_id=None,
            user_id=test_user.id,
            channel="web",
            message="Hola, ¿qué es la pregunta 1?",
        )

        assert "reply" in result
        assert "type" in result
        assert "session_id" in result
        assert "metadata" in result
        assert "suggested_actions" in result
        assert result["reply"] == "Test AI response"
        assert result["type"] == "freeform"

    async def test_handle_message_persists_user_and_assistant_messages(
        self, chat_service: ChatService, test_user, db_session
    ):
        """Both user and assistant messages are persisted in the database."""
        result = await chat_service.handle_message(
            session_id=None,
            user_id=test_user.id,
            channel="web",
            message="Test message",
        )

        session_id = uuid.UUID(result["session_id"])
        stmt = (
            select(ChatMessage)
            .where(ChatMessage.session_id == session_id)
            .order_by(ChatMessage.created_at)
        )
        res = await db_session.execute(stmt)
        messages = list(res.scalars().all())

        assert len(messages) == 2
        assert messages[0].role == "user"
        assert messages[0].content == "Test message"
        assert messages[1].role == "assistant"
        assert messages[1].content == "Test AI response"

    async def test_handle_message_passes_history_to_gateway(
        self, chat_service: ChatService, test_user, db_session, mock_ai_gateway
    ):
        """The AI Gateway receives history in the context."""
        # First message creates session
        result = await chat_service.handle_message(
            session_id=None,
            user_id=test_user.id,
            channel="web",
            message="First message",
        )
        session_id = result["session_id"]

        # Second message should include history from first
        await chat_service.handle_message(
            session_id=session_id,
            user_id=test_user.id,
            channel="web",
            message="Second message",
        )

        # Check that ai_gateway.chat was called with context containing history
        call_args = mock_ai_gateway.chat.call_args_list[-1]
        context_arg: ChatContext = call_args[0][1]
        assert context_arg.history is not None
        assert len(context_arg.history) == 2  # user + assistant from first call
