"""Abstract base class for channel adapters.

Channel adapters normalize messages from external messaging platforms
(WhatsApp via Evolution API, Telegram) into the internal chat message format.
"""

from abc import ABC, abstractmethod
from dataclasses import dataclass, field

from src.modules.ai.gateway import AIResponse


@dataclass
class InternalChatMessage:
    """Normalized internal representation of an inbound chat message.

    All channel adapters convert their native format into this structure
    before routing to the ChatService.
    """

    sender_id: str  # Phone number (WhatsApp) or chat_id (Telegram)
    text: str  # Message text content
    channel: str  # "whatsapp" or "telegram"
    raw_payload: dict = field(default_factory=dict)  # Original payload for debugging


class ChannelAdapter(ABC):
    """Abstract interface for channel adapters.

    Each adapter must implement:
    - verify_auth: Validate the webhook request is authentic
    - normalize_inbound: Convert platform-specific payload to InternalChatMessage
    - format_outbound: Convert AIResponse to platform-specific format
    - send_response: Send the formatted response back to the user
    """

    @abstractmethod
    def verify_auth(self, **kwargs) -> bool:
        """Verify that the webhook request is authentic.

        Implementation varies by channel:
        - WhatsApp (Evolution): Check API key header
        - Telegram: Verify secret token in URL path
        """
        ...

    @abstractmethod
    def normalize_inbound(self, payload: dict) -> InternalChatMessage | None:
        """Normalize platform-specific webhook payload to internal format.

        Args:
            payload: The raw webhook body from the channel.

        Returns:
            InternalChatMessage if the payload contains a valid text message,
            None if the payload should be ignored (e.g., status updates).
        """
        ...

    @abstractmethod
    def format_outbound(self, response: AIResponse) -> dict:
        """Format an AIResponse for the specific channel.

        Args:
            response: The AI gateway response to format.

        Returns:
            Dict with channel-specific message structure.
        """
        ...

    @abstractmethod
    async def send_response(self, recipient_id: str, response: AIResponse) -> bool:
        """Send a formatted response back to the user via the channel's API.

        Args:
            recipient_id: Channel-specific user identifier.
            response: The AI response to send.

        Returns:
            True if the message was sent successfully, False otherwise.
        """
        ...
