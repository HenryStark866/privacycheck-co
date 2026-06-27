"""Chat Service: session management, context enrichment, and message orchestration."""

import logging
import uuid
from collections.abc import AsyncGenerator
from typing import Any

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from src.models import ChatMessage, ChatSession, Empresa, Evaluacion
from src.modules.ai.gateway import AIGateway, AIResponse
from src.modules.ai.prompts import ChatContext, CompanyContext, DiagnosticState

logger = logging.getLogger(__name__)


class ChatService:
    """Unified chat service for all channels.

    Manages sessions, loads bounded history, enriches context with evaluation
    state, routes to the AI Gateway, and persists messages.
    """

    def __init__(self, db: AsyncSession, ai_gateway: AIGateway):
        self.db = db
        self.ai_gateway = ai_gateway

    async def get_or_create_session(
        self,
        session_id: str | None,
        user_id: uuid.UUID,
        channel: str,
        context: dict | None = None,
    ) -> ChatSession:
        """Retrieve an existing session or create a new one.

        Args:
            session_id: Existing session UUID string, or None to create new.
            user_id: The authenticated user's ID.
            channel: Channel identifier (web, whatsapp, telegram, api).
            context: Optional context dict (empresa_id, current_step, answers).

        Returns:
            ChatSession ORM instance.
        """
        if session_id:
            try:
                sid = uuid.UUID(session_id)
            except ValueError:
                sid = None

            if sid:
                stmt = select(ChatSession).where(
                    ChatSession.id == sid,
                    ChatSession.user_id == user_id,
                    ChatSession.is_active.is_(True),
                )
                result = await self.db.execute(stmt)
                session = result.scalar_one_or_none()
                if session:
                    return session

        # Create new session
        empresa_id = None
        evaluacion_id = None
        if context:
            empresa_id_str = context.get("empresa_id")
            if empresa_id_str:
                try:
                    empresa_id = uuid.UUID(str(empresa_id_str))
                except ValueError:
                    pass
            evaluacion_id_str = context.get("evaluacion_id")
            if evaluacion_id_str:
                try:
                    evaluacion_id = uuid.UUID(str(evaluacion_id_str))
                except ValueError:
                    pass

        session = ChatSession(
            user_id=user_id,
            empresa_id=empresa_id,
            evaluacion_id=evaluacion_id,
            channel=channel,
            context=context,
            is_active=True,
        )
        self.db.add(session)
        await self.db.flush()
        await self.db.refresh(session)
        return session

    async def load_history(
        self, session_id: uuid.UUID, limit: int = 10
    ) -> list[dict[str, str]]:
        """Load the last N messages for a session in chronological order.

        Property 13: The history SHALL contain exactly min(N, limit) messages,
        and those messages SHALL be the N most recent in chronological order.

        Args:
            session_id: The chat session UUID.
            limit: Maximum number of messages to return (default 10).

        Returns:
            List of dicts with 'role' and 'content' keys, chronologically ordered.
        """
        # Get the most recent `limit` messages ordered by created_at DESC
        stmt = (
            select(ChatMessage)
            .where(ChatMessage.session_id == session_id)
            .order_by(ChatMessage.created_at.desc())
            .limit(limit)
        )
        result = await self.db.execute(stmt)
        messages = list(result.scalars().all())

        # Reverse to get chronological order (oldest first)
        messages.reverse()

        return [
            {"role": msg.role, "content": msg.content}
            for msg in messages
        ]

    async def enrich_context(
        self, session: ChatSession, context: dict | None = None
    ) -> ChatContext:
        """Build ChatContext with empresa data, evaluation answers, and score.

        Args:
            session: The current chat session.
            context: Optional additional context from the request.

        Returns:
            ChatContext populated with company and diagnostic state.
        """
        company_context: CompanyContext | None = None
        diagnostic_state: DiagnosticState | None = None

        # Load empresa data if linked
        empresa_id = session.empresa_id
        if not empresa_id and context:
            empresa_id_str = context.get("empresa_id")
            if empresa_id_str:
                try:
                    empresa_id = uuid.UUID(str(empresa_id_str))
                except ValueError:
                    pass

        if empresa_id:
            stmt = select(Empresa).where(Empresa.id == empresa_id)
            result = await self.db.execute(stmt)
            empresa = result.scalar_one_or_none()
            if empresa:
                company_context = CompanyContext(
                    nombre=empresa.nombre,
                    sector=empresa.sector,
                    tamano=empresa.tamano,
                )

        # Load evaluation state if linked or provided in context
        evaluacion_id = session.evaluacion_id
        if not evaluacion_id and context:
            evaluacion_id_str = context.get("evaluacion_id")
            if evaluacion_id_str:
                try:
                    evaluacion_id = uuid.UUID(str(evaluacion_id_str))
                except ValueError:
                    pass

        if evaluacion_id:
            stmt = select(Evaluacion).where(Evaluacion.id == evaluacion_id)
            result = await self.db.execute(stmt)
            evaluacion = result.scalar_one_or_none()
            if evaluacion:
                answers_dict: dict[int, bool] | None = None
                if evaluacion.answers:
                    answers_dict = {
                        int(k): v for k, v in evaluacion.answers.items()
                    }
                gaps_list: list[dict] | None = None
                if evaluacion.gaps:
                    gaps_list = evaluacion.gaps

                diagnostic_state = DiagnosticState(
                    score=evaluacion.score,
                    maturity=evaluacion.maturity,
                    gaps=gaps_list,
                    answers=answers_dict,
                )

        # If context has direct answers (e.g., from ongoing diagnostic)
        if not diagnostic_state and context:
            answers_raw = context.get("answers")
            score = context.get("score")
            if answers_raw or score is not None:
                answers_dict = None
                if answers_raw and isinstance(answers_raw, dict):
                    answers_dict = {int(k): v for k, v in answers_raw.items()}
                diagnostic_state = DiagnosticState(
                    score=score,
                    maturity=context.get("maturity"),
                    gaps=context.get("gaps"),
                    answers=answers_dict,
                )

        return ChatContext(
            company=company_context,
            diagnostic=diagnostic_state,
            history=None,  # History is added separately in handle_message
        )

    async def _persist_message(
        self,
        session_id: uuid.UUID,
        role: str,
        content: str,
        metadata: dict | None = None,
    ) -> ChatMessage:
        """Persist a single message to the database.

        Args:
            session_id: The chat session UUID.
            role: "user" or "assistant".
            content: Message text.
            metadata: Optional metadata dict.

        Returns:
            The created ChatMessage instance.
        """
        message = ChatMessage(
            session_id=session_id,
            role=role,
            content=content,
            metadata_=metadata,
        )
        self.db.add(message)
        await self.db.flush()
        return message

    async def handle_message(
        self,
        session_id: str | None,
        user_id: uuid.UUID,
        channel: str,
        message: str,
        context: dict | None = None,
    ) -> dict[str, Any]:
        """Orchestrate a full chat interaction.

        Flow:
        1. Get or create session
        2. Load history (last 10 messages)
        3. Enrich context with evaluation state
        4. Route to AI Gateway
        5. Persist user + assistant messages
        6. Return response

        Args:
            session_id: Optional existing session ID.
            user_id: Authenticated user's ID.
            channel: Channel identifier.
            message: User's message text.
            context: Optional context dict.

        Returns:
            Dict with reply, type, session_id, metadata, suggested_actions.
        """
        # 1. Get or create session
        session = await self.get_or_create_session(
            session_id, user_id, channel, context
        )

        # 2. Load history (last 10 messages, chronological)
        history = await self.load_history(session.id, limit=10)

        # 3. Enrich context
        chat_context = await self.enrich_context(session, context)
        chat_context.history = history

        # 4. Route to AI Gateway
        ai_response: AIResponse = await self.ai_gateway.chat(message, chat_context)

        # 5. Persist user message
        await self._persist_message(
            session_id=session.id,
            role="user",
            content=message,
        )

        # 5. Persist assistant message
        await self._persist_message(
            session_id=session.id,
            role="assistant",
            content=ai_response.reply,
            metadata=ai_response.metadata,
        )

        # 6. Return response
        return {
            "reply": ai_response.reply,
            "type": ai_response.response_type,
            "session_id": str(session.id),
            "metadata": ai_response.metadata,
            "suggested_actions": ai_response.suggested_actions,
        }

    async def handle_stream(
        self,
        session_id: str | None,
        user_id: uuid.UUID,
        message: str,
        context: dict | None = None,
    ) -> AsyncGenerator[str, None]:
        """SSE streaming handler (web channel only).

        Flow:
        1. Get or create session
        2. Load history
        3. Enrich context
        4. Stream from AI Gateway
        5. Persist messages after streaming completes

        Args:
            session_id: Optional existing session ID.
            user_id: Authenticated user's ID.
            message: User's message text.
            context: Optional context dict.

        Yields:
            Text chunks as they arrive from the AI model.
        """
        # 1. Get or create session
        session = await self.get_or_create_session(
            session_id, user_id, "web", context
        )

        # 2. Load history
        history = await self.load_history(session.id, limit=10)

        # 3. Enrich context
        chat_context = await self.enrich_context(session, context)
        chat_context.history = history

        # 4. Persist user message before streaming
        await self._persist_message(
            session_id=session.id,
            role="user",
            content=message,
        )

        # 5. Stream from AI Gateway, collecting full response
        full_reply_parts: list[str] = []
        async for chunk in self.ai_gateway.chat_stream(message, chat_context):
            full_reply_parts.append(chunk)
            yield chunk

        # 6. Persist assistant message after streaming completes
        full_reply = "".join(full_reply_parts)
        if full_reply:
            await self._persist_message(
                session_id=session.id,
                role="assistant",
                content=full_reply,
                metadata={"model": self.ai_gateway.model, "streamed": True},
            )
