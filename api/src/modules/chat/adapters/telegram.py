"""Telegram channel adapter using the Telegram Bot API.

This adapter normalizes Telegram Bot webhook updates into the internal
chat message format and sends responses via the Telegram sendMessage API.
"""

import logging

import httpx

from src.modules.ai.gateway import AIResponse
from src.modules.chat.adapters.base import ChannelAdapter, InternalChatMessage

logger = logging.getLogger(__name__)

TELEGRAM_API_BASE = "https://api.telegram.org"


class TelegramAdapter(ChannelAdapter):
    """Adapter for Telegram Bot messages.

    Handles:
    - Webhook authentication via secret token in URL path
    - Inbound message normalization from Telegram update format
    - Outbound formatting (preserve markdown, inline keyboard)
    - Sending responses via Telegram sendMessage API
    """

    def __init__(self, bot_token: str, webhook_secret: str):
        """Initialize the Telegram adapter.

        Args:
            bot_token: Telegram Bot API token.
            webhook_secret: Secret token used in the webhook URL path for auth.
        """
        self.bot_token = bot_token
        self.webhook_secret = webhook_secret

    def verify_auth(self, *, secret_token: str = "", **kwargs) -> bool:
        """Verify request came from Telegram via secret token in URL path.

        Args:
            secret_token: The secret token extracted from the URL path.

        Returns:
            True if the token matches the configured webhook secret.
        """
        return secret_token == self.webhook_secret and bool(self.webhook_secret)

    def normalize_inbound(self, payload: dict) -> InternalChatMessage | None:
        """Normalize Telegram webhook update to internal format.

        Telegram update format:
        {
            "update_id": 123456,
            "message": {
                "message_id": 1,
                "from": {"id": 12345, "first_name": "User"},
                "chat": {"id": 12345, "type": "private"},
                "text": "Hello!"
            }
        }

        Args:
            payload: Raw Telegram webhook update body.

        Returns:
            InternalChatMessage if payload contains a text message, None otherwise.
        """
        try:
            message = payload.get("message", {})
            if not message:
                return None

            chat = message.get("chat", {})
            chat_id = chat.get("id")
            text = message.get("text", "")

            if not chat_id or not text:
                return None

            return InternalChatMessage(
                sender_id=str(chat_id),
                text=text.strip(),
                channel="telegram",
                raw_payload=payload,
            )
        except (AttributeError, TypeError):
            logger.warning("Failed to normalize Telegram payload: %s", payload)
            return None

    def format_outbound(self, response: AIResponse) -> dict:
        """Format AIResponse for Telegram (preserves markdown, inline keyboard).

        Args:
            response: The AI response to format.

        Returns:
            Dict with 'text', 'parse_mode', and optional 'reply_markup'.
        """
        result: dict = {
            "text": response.reply,
            "parse_mode": "Markdown",
        }

        # Build inline keyboard from suggested actions
        if response.suggested_actions:
            keyboard_buttons = []
            for action in response.suggested_actions:
                label = action.get("label", "") if isinstance(action, dict) else action.label
                callback = action.get("action", "") if isinstance(action, dict) else action.action
                keyboard_buttons.append(
                    [{"text": label, "callback_data": callback}]
                )

            result["reply_markup"] = {
                "inline_keyboard": keyboard_buttons,
            }

        return result

    async def send_response(self, recipient_id: str, response: AIResponse) -> bool:
        """Send message via Telegram sendMessage API.

        Args:
            recipient_id: Telegram chat_id to send to.
            response: The AI response to send.

        Returns:
            True if the message was sent successfully.
        """
        formatted = self.format_outbound(response)
        url = f"{TELEGRAM_API_BASE}/bot{self.bot_token}/sendMessage"

        payload = {
            "chat_id": int(recipient_id),
            "text": formatted["text"],
            "parse_mode": formatted.get("parse_mode", "Markdown"),
        }

        if "reply_markup" in formatted:
            payload["reply_markup"] = formatted["reply_markup"]

        try:
            async with httpx.AsyncClient() as client:
                resp = await client.post(url, json=payload, timeout=10)
                if resp.status_code >= 400:
                    logger.error(
                        "Telegram API error %d: %s", resp.status_code, resp.text
                    )
                    return False
                return True
        except httpx.RequestError as e:
            logger.error("Failed to send Telegram message: %s", e)
            return False
