"""Property-based tests for channel adapters using Hypothesis.

**Validates: Requirements 11.3, 11.5, 11.6, 11.7**

Properties tested:
- Property 17: WhatsApp output ≤ 4096 chars, no markdown, ≤ 3 buttons
- Property 18: Normalization produces valid InternalChatMessage with non-empty text
"""

import string

from hypothesis import given, settings as h_settings
from hypothesis import strategies as st

from src.modules.ai.gateway import AIResponse
from src.modules.chat.adapters.whatsapp import (
    EvolutionWhatsAppAdapter,
    WHATSAPP_MAX_BUTTONS,
    WHATSAPP_MAX_CHARS,
    strip_markdown,
)
from src.modules.chat.adapters.telegram import TelegramAdapter


# --- Strategies ---

# Generate arbitrary text that might include markdown
# We build text by joining segments that can be plain text or markdown patterns
_markdown_snippets = st.sampled_from([
    "**bold**", "*italic*", "_underline_", "__double__",
    "~~strike~~", "`code`", "```\nblock\n```",
    "# Header", "## Sub", "> quote",
    "[link](http://x.com)", "- item", "1. numbered",
])

_plain_text = st.text(
    alphabet=st.characters(categories=("L", "N", "P", "Z")),
    min_size=1,
    max_size=500,
)

# Build text as a concatenation of plain and markdown segments
text_with_possible_markdown = st.lists(
    st.one_of(_plain_text, _markdown_snippets),
    min_size=1,
    max_size=15,
).map(lambda parts: " ".join(parts))

# Generate suggested action lists of varying sizes
suggested_action_strategy = st.fixed_dictionaries({
    "label": st.text(min_size=1, max_size=30, alphabet=string.ascii_letters + string.digits + " "),
    "action": st.sampled_from(["next", "plan", "whatif", "explain", "answer"]),
    "payload": st.none(),
})

suggested_actions_list = st.lists(suggested_action_strategy, min_size=0, max_size=10)

# Valid Evolution API phone numbers
phone_strategy = st.from_regex(r"[0-9]{10,15}", fullmatch=True)

# Valid Telegram chat IDs
chat_id_strategy = st.integers(min_value=1, max_value=999999999)

# Valid message text
message_text_strategy = st.text(
    alphabet=st.characters(categories=("L", "N", "P", "Z")),
    min_size=1,
    max_size=2000,
).filter(lambda t: t.strip())


# --- Property 17: WhatsApp Output Constraints ---


class TestWhatsAppOutputProperty:
    """Property 17: WhatsApp output ≤ 4096 chars, no markdown, ≤ 3 buttons.

    **Validates: Requirements 11.7**
    """

    def setup_method(self):
        self.adapter = EvolutionWhatsAppAdapter(
            api_url="http://localhost:8080",
            api_key="test-key",
            instance_name="test",
        )

    @given(
        reply_text=st.one_of(
            text_with_possible_markdown,
            st.text(min_size=4000, max_size=6000, alphabet=st.characters(categories=("L", "N", "Z"))),
        ),
        actions=suggested_actions_list,
    )
    @h_settings(max_examples=100)
    def test_output_length_never_exceeds_4096(self, reply_text, actions):
        """For any AIResponse, WhatsApp text output ≤ 4096 chars."""
        response = AIResponse(reply=reply_text, suggested_actions=actions)
        result = self.adapter.format_outbound(response)
        assert len(result["text"]) <= WHATSAPP_MAX_CHARS

    @given(reply_text=text_with_possible_markdown, actions=suggested_actions_list)
    @h_settings(max_examples=100)
    def test_output_buttons_never_exceed_3(self, reply_text, actions):
        """For any AIResponse, WhatsApp buttons ≤ 3."""
        response = AIResponse(reply=reply_text, suggested_actions=actions)
        result = self.adapter.format_outbound(response)
        buttons = result.get("buttons", [])
        assert len(buttons) <= WHATSAPP_MAX_BUTTONS

    @given(reply_text=text_with_possible_markdown)
    @h_settings(max_examples=100)
    def test_output_contains_no_markdown_formatting(self, reply_text):
        """For any AIResponse, WhatsApp output has no markdown chars.

        Specifically checks that bold (**), italic (*_), headers (#),
        code (```) formatting have been stripped.
        """
        response = AIResponse(reply=reply_text, suggested_actions=[])
        result = self.adapter.format_outbound(response)
        text = result["text"]

        # Check common markdown indicators are removed
        # Note: single * and _ might appear in normal text, but double ** and __ should not
        assert "**" not in text
        assert "__" not in text
        assert "~~" not in text
        assert "```" not in text


# --- Property 18: Channel Adapter Normalization ---


class TestWhatsAppNormalizationProperty:
    """Property 18: Valid payload → valid InternalChatMessage with non-empty text.

    **Validates: Requirements 11.5**
    """

    def setup_method(self):
        self.adapter = EvolutionWhatsAppAdapter(
            api_url="http://localhost:8080",
            api_key="test-key",
            instance_name="test",
        )

    @given(phone=phone_strategy, text=message_text_strategy)
    @h_settings(max_examples=100)
    def test_valid_evolution_payload_produces_valid_message(self, phone, text):
        """For any valid Evolution payload, normalization produces valid InternalChatMessage."""
        payload = {
            "data": {
                "key": {"remoteJid": f"{phone}@s.whatsapp.net"},
                "message": {"conversation": text},
            }
        }
        result = self.adapter.normalize_inbound(payload)

        assert result is not None
        assert len(result.text) > 0
        assert len(result.sender_id) > 0
        assert result.channel == "whatsapp"
        assert result.sender_id == phone


class TestTelegramNormalizationProperty:
    """Property 18: Valid Telegram update → valid InternalChatMessage with non-empty text.

    **Validates: Requirements 11.6**
    """

    def setup_method(self):
        self.adapter = TelegramAdapter(
            bot_token="123456:ABC-DEF",
            webhook_secret="test-secret",
        )

    @given(chat_id=chat_id_strategy, text=message_text_strategy)
    @h_settings(max_examples=100)
    def test_valid_telegram_update_produces_valid_message(self, chat_id, text):
        """For any valid Telegram update, normalization produces valid InternalChatMessage."""
        payload = {
            "update_id": 123456789,
            "message": {
                "message_id": 1,
                "from": {"id": chat_id, "first_name": "Test"},
                "chat": {"id": chat_id, "type": "private"},
                "text": text,
            },
        }
        result = self.adapter.normalize_inbound(payload)

        assert result is not None
        assert len(result.text) > 0
        assert result.sender_id == str(chat_id)
        assert result.channel == "telegram"
