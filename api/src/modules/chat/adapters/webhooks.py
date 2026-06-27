"""Webhook routes for external channel adapters (WhatsApp, Telegram).

These routes are conditionally registered based on environment variables:
- CHANNEL_WHATSAPP_ENABLED: Registers POST /webhooks/whatsapp
- CHANNEL_TELEGRAM_ENABLED: Registers POST /webhooks/telegram/{secret_token}

When a channel is disabled, its route is not registered and returns 404.
"""

import logging
import uuid

from fastapi import APIRouter, Header, Request
from fastapi.responses import JSONResponse
from openai import AsyncOpenAI
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from src.config import settings
from src.database import async_session_factory
from src.models import ProviderEnum, User
from src.modules.ai.cache import RedisSemanticCache
from src.modules.ai.fallback import DeterministicFallbackProvider
from src.modules.ai.gateway import AIGateway
from src.modules.chat.adapters.whatsapp import EvolutionWhatsAppAdapter
from src.modules.chat.adapters.telegram import TelegramAdapter
from src.modules.chat.service import ChatService

logger = logging.getLogger(__name__)

# Usuario de sistema para mensajes que llegan por canales externos
# (WhatsApp/Telegram) donde aún no hay un usuario autenticado. Se crea una
# sola vez; cada número/chat conserva su propia sesión (uuid5 del remitente).
_CHANNEL_SYSTEM_USER_EMAIL = "channel-system@habeascheck.local"


async def _get_or_create_system_user(db: AsyncSession) -> uuid.UUID:
    """Obtiene (o crea) el usuario de sistema para canales externos.

    Las sesiones de chat requieren un user_id válido (FK NOT NULL). Los
    webhooks no tienen un usuario autenticado, así que usamos un único
    usuario de sistema en lugar de un UUID inexistente (que rompía la FK).
    """
    stmt = select(User).where(User.email == _CHANNEL_SYSTEM_USER_EMAIL)
    result = await db.execute(stmt)
    user = result.scalar_one_or_none()
    if user is None:
        user = User(
            email=_CHANNEL_SYSTEM_USER_EMAIL,
            name="Canal externo (WhatsApp/Telegram)",
            provider=ProviderEnum.google,
            provider_id="channel-system",
            is_active=True,
        )
        db.add(user)
        await db.flush()
    return user.id


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


def create_whatsapp_webhook_router() -> APIRouter:
    """Create the WhatsApp webhook router.

    Returns:
        APIRouter with POST /webhooks/whatsapp endpoint.
    """
    router = APIRouter()
    adapter = EvolutionWhatsAppAdapter(
        api_url=settings.evolution_api_url,
        api_key=settings.evolution_api_key,
        instance_name=settings.evolution_instance_name,
    )

    @router.post("/webhooks/whatsapp", tags=["Webhooks"])
    async def whatsapp_webhook(
        request: Request,
        apikey: str = Header(default="", alias="apikey"),
    ) -> JSONResponse:
        """Receive inbound WhatsApp messages from Evolution API.

        Authenticates via API key in the 'apikey' header.
        Normalizes the payload and routes to the ChatService.
        """
        # Verify authentication
        if not adapter.verify_auth(api_key_header=apikey):
            return JSONResponse(
                status_code=401,
                content={"detail": "Invalid API key"},
            )

        # Parse payload
        payload = await request.json()

        # Normalize inbound message
        message = adapter.normalize_inbound(payload)
        if message is None:
            # Not a text message (could be status update, etc.) - acknowledge
            return JSONResponse(status_code=200, content={"status": "ignored"})

        # Process via ChatService using a dedicated session
        try:
            async with async_session_factory() as db:
                ai_gateway = _get_ai_gateway()
                service = ChatService(db=db, ai_gateway=ai_gateway)

                # Use a deterministic session UUID based on sender for continuity
                session_namespace = uuid.UUID("a1b2c3d4-e5f6-7890-abcd-ef1234567890")
                session_id = str(
                    uuid.uuid5(session_namespace, f"whatsapp:{message.sender_id}")
                )

                system_user_id = await _get_or_create_system_user(db)
                result = await service.handle_message(
                    session_id=session_id,
                    user_id=system_user_id,
                    channel="whatsapp",
                    message=message.text,
                    context=None,
                )

                await db.commit()

                # Send response back via WhatsApp
                from src.modules.ai.gateway import AIResponse

                ai_response = AIResponse(
                    reply=result["reply"],
                    response_type=result["type"],
                    metadata=result["metadata"],
                    suggested_actions=result.get("suggested_actions", []),
                )
                await adapter.send_response(message.sender_id, ai_response)

        except Exception as e:
            logger.error("Error processing WhatsApp webhook: %s", e)
            return JSONResponse(
                status_code=500,
                content={"detail": "Internal error processing message"},
            )

        return JSONResponse(status_code=200, content={"status": "processed"})

    return router


def create_telegram_webhook_router() -> APIRouter:
    """Create the Telegram webhook router.

    Returns:
        APIRouter with POST /webhooks/telegram/{secret_token} endpoint.
    """
    router = APIRouter()
    adapter = TelegramAdapter(
        bot_token=settings.telegram_bot_token,
        webhook_secret=settings.telegram_webhook_secret,
    )

    @router.post("/webhooks/telegram/{secret_token}", tags=["Webhooks"])
    async def telegram_webhook(
        request: Request,
        secret_token: str,
    ) -> JSONResponse:
        """Receive inbound Telegram messages via Bot API webhook.

        Authenticates via secret token in the URL path.
        Normalizes the update and routes to the ChatService.
        """
        # Verify authentication
        if not adapter.verify_auth(secret_token=secret_token):
            return JSONResponse(
                status_code=401,
                content={"detail": "Invalid secret token"},
            )

        # Parse payload
        payload = await request.json()

        # Normalize inbound message
        message = adapter.normalize_inbound(payload)
        if message is None:
            # Not a text message (could be callback query, etc.) - acknowledge
            return JSONResponse(status_code=200, content={"status": "ignored"})

        # Process via ChatService
        try:
            async with async_session_factory() as db:
                ai_gateway = _get_ai_gateway()
                service = ChatService(db=db, ai_gateway=ai_gateway)

                # Use a deterministic session UUID based on chat_id for continuity
                session_namespace = uuid.UUID("b2c3d4e5-f6a7-8901-bcde-f12345678901")
                session_id = str(
                    uuid.uuid5(session_namespace, f"telegram:{message.sender_id}")
                )

                system_user_id = await _get_or_create_system_user(db)
                result = await service.handle_message(
                    session_id=session_id,
                    user_id=system_user_id,
                    channel="telegram",
                    message=message.text,
                    context=None,
                )

                await db.commit()

                # Send response back via Telegram
                from src.modules.ai.gateway import AIResponse

                ai_response = AIResponse(
                    reply=result["reply"],
                    response_type=result["type"],
                    metadata=result["metadata"],
                    suggested_actions=result.get("suggested_actions", []),
                )
                await adapter.send_response(message.sender_id, ai_response)

        except Exception as e:
            logger.error("Error processing Telegram webhook: %s", e)
            return JSONResponse(
                status_code=500,
                content={"detail": "Internal error processing message"},
            )

        return JSONResponse(status_code=200, content={"status": "processed"})

    return router
