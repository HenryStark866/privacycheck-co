"""Router for chat endpoints (message and stream)."""

import logging
from collections.abc import AsyncGenerator

from fastapi import APIRouter, Depends
from fastapi.responses import StreamingResponse
from openai import AsyncOpenAI
from sqlalchemy.ext.asyncio import AsyncSession
from sse_starlette.sse import EventSourceResponse

from src.config import settings
from src.database import get_db
from src.models import User
from src.modules.ai.cache import RedisSemanticCache
from src.modules.ai.fallback import DeterministicFallbackProvider
from src.modules.ai.gateway import AIGateway
from src.modules.auth.dependencies import get_current_user
from src.modules.chat.schemas import (
    ChatMessageRequest,
    ChatMessageResponse,
    SuggestedAction,
)
from src.modules.chat.service import ChatService

logger = logging.getLogger(__name__)

router = APIRouter()


def _get_ai_gateway() -> AIGateway:
    """Build an AIGateway instance with configured dependencies."""
    client = AsyncOpenAI(
        api_key=settings.ai_api_key,
        base_url=settings.ai_base_url,
    )
    cache = RedisSemanticCache()
    fallback = DeterministicFallbackProvider()
    return AIGateway(
        client=client,
        cache=cache,
        fallback=fallback,
        model=settings.ai_model,
        timeout=float(settings.ai_timeout_seconds),
    )


@router.post("/message", response_model=ChatMessageResponse)
async def chat_message_endpoint(
    request: ChatMessageRequest,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> ChatMessageResponse:
    """Send a chat message and receive an AI response.

    Requires JWT authentication. Manages sessions automatically.
    Supports all channels: web, whatsapp, telegram, api.

    Returns the AI reply with type classification, session ID,
    metadata, and suggested follow-up actions.
    """
    ai_gateway = _get_ai_gateway()
    service = ChatService(db=db, ai_gateway=ai_gateway)

    result = await service.handle_message(
        session_id=request.session_id,
        user_id=current_user.id,
        channel=request.channel,
        message=request.message,
        context=request.context,
    )

    suggested_actions = [
        SuggestedAction(**action) if isinstance(action, dict) else action
        for action in result.get("suggested_actions", [])
    ]

    return ChatMessageResponse(
        reply=result["reply"],
        type=result["type"],
        session_id=result["session_id"],
        metadata=result["metadata"],
        suggested_actions=suggested_actions,
    )


@router.post("/stream")
async def chat_stream_endpoint(
    request: ChatMessageRequest,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> EventSourceResponse:
    """Stream a chat response via Server-Sent Events (SSE).

    Requires JWT authentication. Web channel only.
    Delivers AI response tokens incrementally as they arrive.
    """
    ai_gateway = _get_ai_gateway()
    service = ChatService(db=db, ai_gateway=ai_gateway)

    async def event_generator() -> AsyncGenerator[dict, None]:
        """Generate SSE events from the chat stream."""
        # First, send session info
        session = await service.get_or_create_session(
            session_id=request.session_id,
            user_id=current_user.id,
            channel="web",
            context=request.context,
        )
        yield {"event": "session", "data": str(session.id)}

        # Stream the AI response
        async for chunk in service.handle_stream(
            session_id=str(session.id),
            user_id=current_user.id,
            message=request.message,
            context=request.context,
        ):
            yield {"event": "message", "data": chunk}

        # Signal completion
        yield {"event": "done", "data": ""}

    return EventSourceResponse(event_generator())
