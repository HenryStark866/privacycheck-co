"""WhatsApp channel adapter using Evolution API.

Evolution API is a self-hosted WhatsApp Web wrapper that exposes REST endpoints.
This adapter normalizes Evolution API webhooks into the internal chat format
and sends responses back via the Evolution API.
"""

import logging
import re

import httpx

from src.modules.ai.gateway import AIResponse
from src.modules.chat.adapters.base import ChannelAdapter, InternalChatMessage

logger = logging.getLogger(__name__)

# Regex to match common markdown formatting
_MARKDOWN_PATTERNS = [
    (re.compile(r"\*\*(.+?)\*\*"), r"\1"),  # bold **text**
    (re.compile(r"__(.+?)__"), r"\1"),  # bold __text__
    (re.compile(r"\*(.+?)\*"), r"\1"),  # italic *text*
    (re.compile(r"_(.+?)_"), r"\1"),  # italic _text_
    (re.compile(r"~~(.+?)~~"), r"\1"),  # strikethrough
    (re.compile(r"`(.+?)`"), r"\1"),  # inline code
    (re.compile(r"```[\s\S]*?```"), ""),  # code blocks
    (re.compile(r"^#{1,6}\s+", re.MULTILINE), ""),  # headers
    (re.compile(r"^\s*[-*+]\s+", re.MULTILINE), "• "),  # list items
    (re.compile(r"^\s*\d+\.\s+", re.MULTILINE), ""),  # numbered lists
    (re.compile(r"\[(.+?)\]\(.+?\)"), r"\1"),  # links [text](url)
    (re.compile(r"^>\s+", re.MULTILINE), ""),  # blockquotes
]

# WhatsApp message character limit
WHATSAPP_MAX_CHARS = 4096

# Maximum quick-reply buttons allowed by Evolution API
WHATSAPP_MAX_BUTTONS = 3


def strip_markdown(text: str) -> str:
    """Remove markdown formatting from text for WhatsApp display.

    Args:
        text: Text potentially containing markdown formatting.

    Returns:
        Plain text with markdown removed.
    """
    result = text
    for pattern, replacement in _MARKDOWN_PATTERNS:
        result = pattern.sub(replacement, result)
    return result.strip()


class EvolutionWhatsAppAdapter(ChannelAdapter):
    """Adapter for WhatsApp messages via Evolution API.

    Handles:
    - Webhook authentication via API key header
    - Inbound message normalization from Evolution format
    - Outbound formatting (strip markdown, truncate, limit buttons)
    - Sending responses via Evolution API POST /message/sendText
    """

    def __init__(self, api_url: str, api_key: str, instance_name: str):
        """Initialize the WhatsApp adapter.

        Args:
            api_url: Evolution API base URL (e.g., "http://localhost:8080").
            api_key: API key for authenticating with Evolution API.
            instance_name: Evolution API instance name.
        """
        self.api_url = api_url.rstrip("/")
        self.api_key = api_key
        self.instance_name = instance_name

    def verify_auth(self, *, api_key_header: str = "", **kwargs) -> bool:
        """Validate the webhook came from our Evolution API instance.

        Args:
            api_key_header: The API key from the request header.

        Returns:
            True if the key matches the configured API key.
        """
        return api_key_header == self.api_key and bool(self.api_key)

    def normalize_inbound(self, payload: dict) -> InternalChatMessage | None:
        """Extract message from Evolution API webhook payload.

        Evolution format:
        {
            "data": {
                "key": {"remoteJid": "5511999999999@s.whatsapp.net", ...},
                "message": {"conversation": "Hello!"}
            }
        }

        Args:
            payload: Raw Evolution API webhook body.

        Returns:
            InternalChatMessage if payload contains a text message, None otherwise.
        """
        try:
            data = payload.get("data", {})
            if not data:
                return None

            key = data.get("key", {})
            message = data.get("message", {})

            remote_jid = key.get("remoteJid", "")
            text = message.get("conversation", "")

            # Also check extendedTextMessage for forwarded/quoted messages
            if not text:
                extended = message.get("extendedTextMessage", {})
                text = extended.get("text", "") if extended else ""

            if not remote_jid or not text:
                return None

            # Extract phone number from JID (remove @s.whatsapp.net)
            sender_id = remote_jid.split("@")[0]

            return InternalChatMessage(
                sender_id=sender_id,
                text=text.strip(),
                channel="whatsapp",
                raw_payload=payload,
            )
        except (AttributeError, TypeError):
            logger.warning("Failed to normalize WhatsApp payload: %s", payload)
            return None

    def format_outbound(self, response: AIResponse) -> dict:
        """Format AIResponse for WhatsApp via Evolution API.

        Applies:
        - Strip markdown formatting
        - Truncate to 4096 characters
        - Limit to max 3 quick-reply buttons

        Args:
            response: The AI response to format.

        Returns:
            Dict with 'text' and optional 'buttons' fields.
        """
        # Strip markdown and truncate
        text = strip_markdown(response.reply)
        if len(text) > WHATSAPP_MAX_CHARS:
            text = text[: WHATSAPP_MAX_CHARS - 3] + "..."

        # Format buttons (max 3)
        buttons = []
        for action in response.suggested_actions[:WHATSAPP_MAX_BUTTONS]:
            label = action.get("label", "") if isinstance(action, dict) else action.label
            buttons.append({"buttonText": {"displayText": label}})

        result: dict = {"text": text}
        if buttons:
            result["buttons"] = buttons

        return result

    async def send_response(self, recipient_id: str, response: AIResponse) -> bool:
        """Send message via Evolution API POST /message/sendText/{instance}.

        Args:
            recipient_id: Phone number to send to.
            response: The AI response to send.

        Returns:
            True if the message was sent successfully.
        """
        formatted = self.format_outbound(response)
        url = f"{self.api_url}/message/sendText/{self.instance_name}"

        payload = {
            "number": recipient_id,
            "text": formatted["text"],
        }

        # Add buttons if present
        if "buttons" in formatted:
            payload["buttons"] = formatted["buttons"]

        headers = {
            "apikey": self.api_key,
            "Content-Type": "application/json",
        }

        try:
            async with httpx.AsyncClient() as client:
                resp = await client.post(url, json=payload, headers=headers, timeout=10)
                if resp.status_code >= 400:
                    logger.error(
                        "Evolution API error %d: %s", resp.status_code, resp.text
                    )
                    return False
                return True
        except httpx.RequestError as e:
            logger.error("Failed to send WhatsApp message: %s", e)
            return False
