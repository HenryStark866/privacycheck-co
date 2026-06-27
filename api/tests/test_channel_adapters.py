"""Tests for channel adapters: normalization, format constraints, activation toggle.

Tests cover Properties 17-19 from the design:
- Property 17: WhatsApp output ≤ 4096 chars, no markdown, ≤ 3 buttons
- Property 18: Normalization produces valid InternalChatMessage with non-empty text
- Property 19: Disabled channel → 404, enabled → processes
"""

import pytest
from unittest.mock import patch, AsyncMock

from src.modules.ai.gateway import AIResponse
from src.modules.chat.adapters.base import InternalChatMessage
from src.modules.chat.adapters.whatsapp import (
    EvolutionWhatsAppAdapter,
    strip_markdown,
    WHATSAPP_MAX_CHARS,
    WHATSAPP_MAX_BUTTONS,
)
from src.modules.chat.adapters.telegram import TelegramAdapter


# --- WhatsApp Adapter Tests ---


class TestWhatsAppNormalization:
    """Test WhatsApp (Evolution API) inbound normalization. Validates Property 18."""

    def setup_method(self):
        self.adapter = EvolutionWhatsAppAdapter(
            api_url="http://localhost:8080",
            api_key="test-api-key",
            instance_name="test-instance",
        )

    def test_normalize_valid_text_message(self):
        """Standard Evolution API text message is normalized correctly."""
        payload = {
            "data": {
                "key": {"remoteJid": "5511999999999@s.whatsapp.net"},
                "message": {"conversation": "Hola, necesito ayuda"},
            }
        }
        result = self.adapter.normalize_inbound(payload)

        assert result is not None
        assert result.sender_id == "5511999999999"
        assert result.text == "Hola, necesito ayuda"
        assert result.channel == "whatsapp"
        assert len(result.text) > 0

    def test_normalize_extended_text_message(self):
        """Extended text message (quoted/forwarded) is normalized."""
        payload = {
            "data": {
                "key": {"remoteJid": "573001234567@s.whatsapp.net"},
                "message": {
                    "extendedTextMessage": {"text": "Texto extendido"}
                },
            }
        }
        result = self.adapter.normalize_inbound(payload)

        assert result is not None
        assert result.sender_id == "573001234567"
        assert result.text == "Texto extendido"
        assert result.channel == "whatsapp"

    def test_normalize_empty_data_returns_none(self):
        """Payload with empty data is ignored."""
        payload = {"data": {}}
        assert self.adapter.normalize_inbound(payload) is None

    def test_normalize_missing_text_returns_none(self):
        """Payload without text content is ignored."""
        payload = {
            "data": {
                "key": {"remoteJid": "5511999999999@s.whatsapp.net"},
                "message": {},
            }
        }
        assert self.adapter.normalize_inbound(payload) is None

    def test_normalize_missing_remote_jid_returns_none(self):
        """Payload without remoteJid is ignored."""
        payload = {
            "data": {
                "key": {},
                "message": {"conversation": "Hello"},
            }
        }
        assert self.adapter.normalize_inbound(payload) is None

    def test_normalize_status_update_returns_none(self):
        """Non-message webhooks (status updates) are ignored."""
        payload = {"event": "status.update", "data": None}
        assert self.adapter.normalize_inbound(payload) is None

    def test_normalize_strips_whitespace(self):
        """Message text has whitespace trimmed."""
        payload = {
            "data": {
                "key": {"remoteJid": "5511999999999@s.whatsapp.net"},
                "message": {"conversation": "  hola  "},
            }
        }
        result = self.adapter.normalize_inbound(payload)
        assert result is not None
        assert result.text == "hola"


class TestWhatsAppFormatOutbound:
    """Test WhatsApp output formatting. Validates Property 17."""

    def setup_method(self):
        self.adapter = EvolutionWhatsAppAdapter(
            api_url="http://localhost:8080",
            api_key="test-api-key",
            instance_name="test-instance",
        )

    def test_strips_markdown_bold(self):
        """Bold markdown is removed."""
        response = AIResponse(reply="**importante**: texto", suggested_actions=[])
        result = self.adapter.format_outbound(response)
        assert "**" not in result["text"]
        assert "importante" in result["text"]

    def test_strips_markdown_italic(self):
        """Italic markdown is removed."""
        response = AIResponse(reply="*cursiva* y _otra_", suggested_actions=[])
        result = self.adapter.format_outbound(response)
        assert "*" not in result["text"]
        assert "_" not in result["text"]

    def test_strips_markdown_headers(self):
        """Header markdown is removed."""
        response = AIResponse(reply="## Título\n\nContenido", suggested_actions=[])
        result = self.adapter.format_outbound(response)
        assert "##" not in result["text"]
        assert "Título" in result["text"]

    def test_strips_markdown_links(self):
        """Links are converted to text only."""
        response = AIResponse(
            reply="Ver [documentación](https://example.com)",
            suggested_actions=[],
        )
        result = self.adapter.format_outbound(response)
        assert "[" not in result["text"]
        assert "documentación" in result["text"]
        assert "https://example.com" not in result["text"]

    def test_truncates_to_4096_chars(self):
        """Long text is truncated to 4096 characters."""
        long_text = "A" * 5000
        response = AIResponse(reply=long_text, suggested_actions=[])
        result = self.adapter.format_outbound(response)
        assert len(result["text"]) <= WHATSAPP_MAX_CHARS

    def test_max_three_buttons(self):
        """No more than 3 quick-reply buttons are included."""
        actions = [
            {"label": f"Action {i}", "action": f"act{i}", "payload": None}
            for i in range(5)
        ]
        response = AIResponse(reply="Test", suggested_actions=actions)
        result = self.adapter.format_outbound(response)
        assert len(result.get("buttons", [])) <= WHATSAPP_MAX_BUTTONS

    def test_no_buttons_when_no_actions(self):
        """No buttons field when there are no suggested actions."""
        response = AIResponse(reply="Test", suggested_actions=[])
        result = self.adapter.format_outbound(response)
        assert "buttons" not in result

    def test_format_preserves_plain_text(self):
        """Plain text without markdown passes through."""
        response = AIResponse(
            reply="Texto simple sin formato", suggested_actions=[]
        )
        result = self.adapter.format_outbound(response)
        assert result["text"] == "Texto simple sin formato"


class TestWhatsAppAuth:
    """Test WhatsApp webhook authentication."""

    def setup_method(self):
        self.adapter = EvolutionWhatsAppAdapter(
            api_url="http://localhost:8080",
            api_key="my-secret-key",
            instance_name="test-instance",
        )

    def test_valid_api_key(self):
        """Matching API key passes verification."""
        assert self.adapter.verify_auth(api_key_header="my-secret-key") is True

    def test_invalid_api_key(self):
        """Mismatched API key fails verification."""
        assert self.adapter.verify_auth(api_key_header="wrong-key") is False

    def test_empty_api_key(self):
        """Empty API key fails verification."""
        assert self.adapter.verify_auth(api_key_header="") is False

    def test_empty_configured_key_rejects_all(self):
        """When configured key is empty, all requests are rejected."""
        adapter = EvolutionWhatsAppAdapter(
            api_url="http://localhost:8080",
            api_key="",
            instance_name="test",
        )
        assert adapter.verify_auth(api_key_header="") is False
        assert adapter.verify_auth(api_key_header="any-key") is False


# --- Telegram Adapter Tests ---


class TestTelegramNormalization:
    """Test Telegram inbound normalization. Validates Property 18."""

    def setup_method(self):
        self.adapter = TelegramAdapter(
            bot_token="123456:ABC-DEF",
            webhook_secret="my-webhook-secret",
        )

    def test_normalize_valid_text_message(self):
        """Standard Telegram text message is normalized correctly."""
        payload = {
            "update_id": 123456789,
            "message": {
                "message_id": 1,
                "from": {"id": 12345, "first_name": "User"},
                "chat": {"id": 12345, "type": "private"},
                "text": "¿Qué es la pregunta 6?",
            },
        }
        result = self.adapter.normalize_inbound(payload)

        assert result is not None
        assert result.sender_id == "12345"
        assert result.text == "¿Qué es la pregunta 6?"
        assert result.channel == "telegram"
        assert len(result.text) > 0

    def test_normalize_missing_message_returns_none(self):
        """Payload without message field is ignored."""
        payload = {"update_id": 123456789}
        assert self.adapter.normalize_inbound(payload) is None

    def test_normalize_empty_text_returns_none(self):
        """Payload without text is ignored (e.g., photo message)."""
        payload = {
            "update_id": 123456789,
            "message": {
                "message_id": 1,
                "chat": {"id": 12345, "type": "private"},
                "text": "",
            },
        }
        assert self.adapter.normalize_inbound(payload) is None

    def test_normalize_missing_chat_id_returns_none(self):
        """Payload without chat_id is ignored."""
        payload = {
            "update_id": 123456789,
            "message": {
                "message_id": 1,
                "chat": {},
                "text": "Hello",
            },
        }
        assert self.adapter.normalize_inbound(payload) is None

    def test_normalize_callback_query_returns_none(self):
        """Callback query (button press) without message text is ignored."""
        payload = {
            "update_id": 123456789,
            "callback_query": {
                "id": "abc",
                "data": "action_1",
                "from": {"id": 12345},
            },
        }
        assert self.adapter.normalize_inbound(payload) is None

    def test_normalize_strips_whitespace(self):
        """Message text has whitespace trimmed."""
        payload = {
            "update_id": 123456789,
            "message": {
                "message_id": 1,
                "chat": {"id": 12345, "type": "private"},
                "text": "  hola  ",
            },
        }
        result = self.adapter.normalize_inbound(payload)
        assert result is not None
        assert result.text == "hola"


class TestTelegramFormatOutbound:
    """Test Telegram output formatting."""

    def setup_method(self):
        self.adapter = TelegramAdapter(
            bot_token="123456:ABC-DEF",
            webhook_secret="my-webhook-secret",
        )

    def test_preserves_markdown(self):
        """Markdown is preserved for Telegram."""
        response = AIResponse(
            reply="**Importante**: _revise_ el `artículo 12`",
            suggested_actions=[],
        )
        result = self.adapter.format_outbound(response)
        assert result["text"] == "**Importante**: _revise_ el `artículo 12`"
        assert result["parse_mode"] == "Markdown"

    def test_inline_keyboard_buttons(self):
        """Suggested actions become inline keyboard buttons."""
        actions = [
            {"label": "Ver plan", "action": "plan", "payload": None},
            {"label": "Simular", "action": "whatif", "payload": None},
        ]
        response = AIResponse(reply="Test", suggested_actions=actions)
        result = self.adapter.format_outbound(response)

        assert "reply_markup" in result
        keyboard = result["reply_markup"]["inline_keyboard"]
        assert len(keyboard) == 2
        assert keyboard[0][0]["text"] == "Ver plan"
        assert keyboard[0][0]["callback_data"] == "plan"

    def test_no_keyboard_when_no_actions(self):
        """No reply_markup when there are no actions."""
        response = AIResponse(reply="Test", suggested_actions=[])
        result = self.adapter.format_outbound(response)
        assert "reply_markup" not in result


class TestTelegramAuth:
    """Test Telegram webhook authentication."""

    def setup_method(self):
        self.adapter = TelegramAdapter(
            bot_token="123456:ABC-DEF",
            webhook_secret="my-webhook-secret",
        )

    def test_valid_secret_token(self):
        """Matching secret token passes verification."""
        assert self.adapter.verify_auth(secret_token="my-webhook-secret") is True

    def test_invalid_secret_token(self):
        """Mismatched secret token fails verification."""
        assert self.adapter.verify_auth(secret_token="wrong-secret") is False

    def test_empty_secret_token(self):
        """Empty secret token fails verification."""
        assert self.adapter.verify_auth(secret_token="") is False

    def test_empty_configured_secret_rejects_all(self):
        """When configured secret is empty, all requests are rejected."""
        adapter = TelegramAdapter(bot_token="token", webhook_secret="")
        assert adapter.verify_auth(secret_token="") is False
        assert adapter.verify_auth(secret_token="any") is False


# --- Channel Activation Toggle Tests (Property 19) ---


class TestChannelActivationToggle:
    """Test that disabled channels return 404 and enabled channels process.

    Validates Property 19.
    """

    def test_whatsapp_disabled_by_default(self):
        """WhatsApp channel is disabled by default in settings."""
        from src.config import Settings

        s = Settings(
            supabase_jwt_secret="test",
            ai_api_key="test",
            _env_file=None,
        )
        assert s.channel_whatsapp_enabled is False

    def test_telegram_disabled_by_default(self):
        """Telegram channel is disabled by default in settings."""
        from src.config import Settings

        s = Settings(
            supabase_jwt_secret="test",
            ai_api_key="test",
            _env_file=None,
        )
        assert s.channel_telegram_enabled is False

    def test_whatsapp_enabled_via_env(self):
        """WhatsApp channel can be enabled via env var."""
        from src.config import Settings

        s = Settings(
            supabase_jwt_secret="test",
            ai_api_key="test",
            channel_whatsapp_enabled=True,
            _env_file=None,
        )
        assert s.channel_whatsapp_enabled is True

    def test_telegram_enabled_via_env(self):
        """Telegram channel can be enabled via env var."""
        from src.config import Settings

        s = Settings(
            supabase_jwt_secret="test",
            ai_api_key="test",
            channel_telegram_enabled=True,
            _env_file=None,
        )
        assert s.channel_telegram_enabled is True


class TestChannelActivationRoutes:
    """Test that webhook routes are registered/unregistered based on config.

    Validates Property 19: Disabled channel → 404, enabled → processes.
    """

    def test_disabled_whatsapp_returns_404(self):
        """When WhatsApp is disabled, /webhooks/whatsapp returns 404."""
        from fastapi.testclient import TestClient
        from src.main import app

        # Default settings have whatsapp disabled
        client = TestClient(app)
        response = client.post(
            "/webhooks/whatsapp",
            json={"data": {"key": {"remoteJid": "123"}, "message": {"conversation": "hi"}}},
            headers={"apikey": "any-key"},
        )
        # Should be 404 since the route isn't registered when disabled
        assert response.status_code == 404

    def test_disabled_telegram_returns_404(self):
        """When Telegram is disabled, /webhooks/telegram/{token} returns 404."""
        from fastapi.testclient import TestClient
        from src.main import app

        client = TestClient(app)
        response = client.post(
            "/webhooks/telegram/some-secret",
            json={"update_id": 1, "message": {"chat": {"id": 1}, "text": "hi"}},
        )
        # Should be 404 since the route isn't registered when disabled
        assert response.status_code == 404


# --- Strip Markdown Tests ---


class TestStripMarkdown:
    """Test the strip_markdown utility function."""

    def test_strips_bold_double_star(self):
        assert strip_markdown("**bold**") == "bold"

    def test_strips_bold_underscore(self):
        assert strip_markdown("__bold__") == "bold"

    def test_strips_italic_star(self):
        assert strip_markdown("*italic*") == "italic"

    def test_strips_italic_underscore(self):
        assert strip_markdown("_italic_") == "italic"

    def test_strips_strikethrough(self):
        assert strip_markdown("~~deleted~~") == "deleted"

    def test_strips_inline_code(self):
        assert strip_markdown("`code`") == "code"

    def test_strips_code_blocks(self):
        result = strip_markdown("```python\nprint('hi')\n```")
        assert "```" not in result

    def test_strips_headers(self):
        result = strip_markdown("# Header\n## Subheader")
        assert "#" not in result
        assert "Header" in result

    def test_strips_links(self):
        result = strip_markdown("[Click here](https://example.com)")
        assert result == "Click here"
        assert "https://" not in result

    def test_strips_blockquotes(self):
        result = strip_markdown("> quoted text")
        assert ">" not in result
        assert "quoted" in result

    def test_converts_bullet_lists(self):
        result = strip_markdown("- item 1\n- item 2")
        assert "• item 1" in result

    def test_plain_text_unchanged(self):
        assert strip_markdown("plain text") == "plain text"

    def test_complex_markdown(self):
        text = "## Título\n\n**Importante**: revise el [artículo 12](http://link.com)\n\n- Paso 1\n- Paso 2"
        result = strip_markdown(text)
        assert "##" not in result
        assert "**" not in result
        assert "[" not in result
        assert "Importante" in result
        assert "artículo 12" in result
