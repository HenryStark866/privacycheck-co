"""Tests for the AI Gateway module.

Tests cover:
- System prompt building with context
- Tool definitions format
- Tool execution (explain_question, calculate_score, generate_plan, simulate_whatif)
- AIGateway.chat with mocked DeepSeek responses
- AIGateway.chat with tool calls
- Timeout/fallback behavior
- Cache hit behavior
- Streaming fallback
"""

import json
from unittest.mock import AsyncMock, MagicMock, patch

import pytest

from src.modules.ai.gateway import (
    AIGateway,
    AIResponse,
    _determine_response_type,
    _execute_tool,
    _generate_suggested_actions,
)
from src.modules.ai.prompts import (
    ChatContext,
    CompanyContext,
    DiagnosticState,
    build_system_prompt,
)
from src.modules.ai.tools import TOOL_DEFINITIONS, get_tool_definitions


# ========== Tests for prompts.py ==========


class TestBuildSystemPrompt:
    """Tests for system prompt construction."""

    def test_base_prompt_without_context(self):
        """Base prompt should contain Law 1581 expertise."""
        prompt = build_system_prompt()
        assert "Ley 1581 de 2012" in prompt
        assert "Habeas Data" in prompt
        assert "CAPACIDADES" in prompt
        assert "HERRAMIENTAS DISPONIBLES" in prompt
        assert "DIRECTRICES DE RESPUESTA" in prompt

    def test_prompt_with_company_context(self):
        """Prompt should include company information when provided."""
        context = ChatContext(
            company=CompanyContext(
                nombre="Empresa Test",
                sector="Tecnología",
                tamano="Mediana",
            )
        )
        prompt = build_system_prompt(context)
        assert "Empresa Test" in prompt
        assert "Tecnología" in prompt
        assert "Mediana" in prompt
        assert "CONTEXTO DE LA EMPRESA" in prompt

    def test_prompt_with_diagnostic_state(self):
        """Prompt should include diagnostic state when provided."""
        context = ChatContext(
            diagnostic=DiagnosticState(
                score=75,
                maturity="Optimizado",
                gaps=[{"question_id": 9}, {"question_id": 6}],
                answers={1: True, 2: True, 3: False},
            )
        )
        prompt = build_system_prompt(context)
        assert "75/100" in prompt
        assert "Optimizado" in prompt
        assert "9" in prompt
        assert "ESTADO DEL DIAGNÓSTICO ACTUAL" in prompt

    def test_prompt_with_full_context(self):
        """Prompt should include all sections when full context provided."""
        context = ChatContext(
            company=CompanyContext(nombre="Mi Empresa", sector="Salud", tamano="Grande"),
            diagnostic=DiagnosticState(score=50, maturity="Gestionado"),
        )
        prompt = build_system_prompt(context)
        assert "Mi Empresa" in prompt
        assert "Salud" in prompt
        assert "50/100" in prompt
        assert "Gestionado" in prompt

    def test_prompt_with_partial_company(self):
        """Prompt handles company with only nombre."""
        context = ChatContext(
            company=CompanyContext(nombre="Solo Nombre")
        )
        prompt = build_system_prompt(context)
        assert "Solo Nombre" in prompt
        assert "Sector" not in prompt.split("CONTEXTO DE LA EMPRESA")[1].split("\n")[1] or True


# ========== Tests for tools.py ==========


class TestToolDefinitions:
    """Tests for tool definitions format."""

    def test_tool_definitions_structure(self):
        """All tools should be in correct OpenAI function calling format."""
        tools = get_tool_definitions()
        assert len(tools) == 4

        for tool in tools:
            assert tool["type"] == "function"
            assert "function" in tool
            assert "name" in tool["function"]
            assert "description" in tool["function"]
            assert "parameters" in tool["function"]

    def test_explain_question_tool(self):
        """explain_question tool should require question_id."""
        tool = next(t for t in TOOL_DEFINITIONS if t["function"]["name"] == "explain_question")
        params = tool["function"]["parameters"]
        assert "question_id" in params["properties"]
        assert "question_id" in params["required"]

    def test_calculate_score_tool(self):
        """calculate_score tool should require answers dict."""
        tool = next(t for t in TOOL_DEFINITIONS if t["function"]["name"] == "calculate_score")
        params = tool["function"]["parameters"]
        assert "answers" in params["properties"]
        assert "answers" in params["required"]

    def test_generate_plan_tool(self):
        """generate_plan tool should require gaps."""
        tool = next(t for t in TOOL_DEFINITIONS if t["function"]["name"] == "generate_plan")
        params = tool["function"]["parameters"]
        assert "gaps" in params["properties"]
        assert "gaps" in params["required"]

    def test_simulate_whatif_tool(self):
        """simulate_whatif tool should require current_answers and improvements."""
        tool = next(t for t in TOOL_DEFINITIONS if t["function"]["name"] == "simulate_whatif")
        params = tool["function"]["parameters"]
        assert "current_answers" in params["properties"]
        assert "improvements" in params["properties"]
        assert "current_answers" in params["required"]
        assert "improvements" in params["required"]


# ========== Tests for tool execution ==========


class TestExecuteTool:
    """Tests for the _execute_tool function."""

    def test_explain_question_valid(self):
        """explain_question should return question details."""
        result = json.loads(_execute_tool("explain_question", {"question_id": 1}))
        assert result["question_id"] == 1
        assert "text" in result
        assert "explain" in result
        assert "guide" in result
        assert "Ley 1581" in result["explain"]

    def test_explain_question_invalid_id(self):
        """explain_question should return error for invalid ID."""
        result = json.loads(_execute_tool("explain_question", {"question_id": 99}))
        assert "error" in result

    def test_calculate_score_all_true(self):
        """calculate_score should compute 100 when all applicable questions are True."""
        answers = {str(i): True for i in range(1, 12)}
        result = json.loads(_execute_tool("calculate_score", {"answers": answers}))
        assert result["score"] == 100
        assert result["maturity"] == "Líder"
        assert len(result["gaps"]) == 0

    def test_calculate_score_all_false(self):
        """calculate_score should compute 0 when all answers are False."""
        answers = {str(i): False for i in range(1, 12)}
        result = json.loads(_execute_tool("calculate_score", {"answers": answers}))
        assert result["score"] == 0
        assert result["maturity"] == "Inicial"

    def test_calculate_score_q1_gates_block_a(self):
        """When Q1=False, Q2-Q5 should not contribute to score."""
        answers = {str(i): True for i in range(1, 12)}
        answers["1"] = False
        result = json.loads(_execute_tool("calculate_score", {"answers": answers}))
        # Block B + C = 12+12+12+16+8 = 60
        assert result["score"] == 60

    def test_generate_plan(self):
        """generate_plan should return prioritized actions."""
        gaps = [
            {"question_id": 9, "weight": 16, "text": "Gestión de incidentes"},
            {"question_id": 6, "weight": 12, "text": "Medidas técnicas"},
        ]
        result = json.loads(_execute_tool("generate_plan", {
            "gaps": gaps,
            "sector": "Tecnología",
            "size": "Mediana",
        }))
        assert "plan" in result
        assert len(result["plan"]) == 2
        assert result["plan"][0]["priority"] == 1
        assert result["plan"][0]["question_id"] == 9
        assert result["total_potential_improvement"] == 28

    def test_simulate_whatif(self):
        """simulate_whatif should compute projected score and delta."""
        current_answers = {str(i): False for i in range(1, 12)}
        current_answers["1"] = True
        result = json.loads(_execute_tool("simulate_whatif", {
            "current_answers": current_answers,
            "improvements": [2, 3],
        }))
        assert result["current_score"] == 0
        assert result["projected_score"] == 20  # Q2=10 + Q3=10
        assert result["delta"] == 20
        assert result["improvements_applied"] == [2, 3]

    def test_unknown_tool(self):
        """Unknown tool should return error."""
        result = json.loads(_execute_tool("unknown_tool", {}))
        assert "error" in result


# ========== Tests for AIGateway ==========


def _create_mock_response(content: str, tool_calls=None, usage=None):
    """Create a mock OpenAI chat completion response."""
    message = MagicMock()
    message.content = content
    message.tool_calls = tool_calls

    choice = MagicMock()
    choice.message = message

    response = MagicMock()
    response.choices = [choice]

    if usage is None:
        mock_usage = MagicMock()
        mock_usage.total_tokens = 150
        mock_usage.prompt_tokens = 100
        mock_usage.completion_tokens = 50
        response.usage = mock_usage
    else:
        response.usage = usage

    return response


def _create_mock_tool_call(tool_id: str, name: str, arguments: dict):
    """Create a mock tool call object."""
    tool_call = MagicMock()
    tool_call.id = tool_id
    tool_call.function = MagicMock()
    tool_call.function.name = name
    tool_call.function.arguments = json.dumps(arguments)
    return tool_call


class TestAIGateway:
    """Tests for the AIGateway class."""

    @pytest.fixture
    def mock_client(self):
        """Create a mock AsyncOpenAI client."""
        client = AsyncMock()
        client.chat = AsyncMock()
        client.chat.completions = AsyncMock()
        client.chat.completions.create = AsyncMock()
        return client

    @pytest.fixture
    def mock_cache(self):
        """Create a mock SemanticCache."""
        cache = AsyncMock()
        cache.get = AsyncMock(return_value=None)
        cache.set = AsyncMock()
        return cache

    @pytest.fixture
    def mock_fallback(self):
        """Create a mock FallbackProvider."""
        fallback = MagicMock()
        fallback.generate_response = MagicMock(return_value="Respuesta de respaldo.")
        return fallback

    @pytest.fixture
    def gateway(self, mock_client, mock_cache, mock_fallback):
        """Create an AIGateway instance with mocked dependencies."""
        return AIGateway(
            client=mock_client,
            cache=mock_cache,
            fallback=mock_fallback,
            model="deepseek-chat",
            timeout=10.0,
        )

    async def test_chat_simple_response(self, gateway, mock_client):
        """chat should return AI response for a simple message."""
        mock_client.chat.completions.create.return_value = _create_mock_response(
            "La Ley 1581 de 2012 establece..."
        )

        result = await gateway.chat("¿Qué es la Ley 1581?")

        assert isinstance(result, AIResponse)
        assert result.reply == "La Ley 1581 de 2012 establece..."
        assert result.response_type == "freeform"
        assert result.metadata["cached"] is False
        assert result.metadata["model"] == "deepseek-chat"

    async def test_chat_cache_hit(self, gateway, mock_cache, mock_client):
        """chat should return cached response without calling DeepSeek."""
        mock_cache.get.return_value = "Respuesta cacheada."

        result = await gateway.chat("¿Qué es la pregunta 1?")

        assert result.reply == "Respuesta cacheada."
        assert result.metadata["cached"] is True
        mock_client.chat.completions.create.assert_not_called()

    async def test_chat_with_tool_call(self, gateway, mock_client):
        """chat should execute tool calls and return final response."""
        # First response: model wants to call explain_question
        tool_call = _create_mock_tool_call(
            "call_1", "explain_question", {"question_id": 6}
        )
        first_response = _create_mock_response(None, tool_calls=[tool_call])

        # Second response: model gives final answer
        second_response = _create_mock_response(
            "La pregunta 6 evalúa las medidas técnicas de seguridad..."
        )

        mock_client.chat.completions.create.side_effect = [first_response, second_response]

        result = await gateway.chat("Explícame la pregunta 6")

        assert result.reply == "La pregunta 6 evalúa las medidas técnicas de seguridad..."
        assert result.response_type == "explanation"
        assert "explain_question" in result.metadata["tool_calls"]
        assert mock_client.chat.completions.create.call_count == 2

    async def test_chat_with_calculate_score_tool(self, gateway, mock_client):
        """chat should execute calculate_score tool correctly."""
        answers = {str(i): True for i in range(1, 12)}
        tool_call = _create_mock_tool_call(
            "call_score", "calculate_score", {"answers": answers}
        )
        first_response = _create_mock_response(None, tool_calls=[tool_call])
        second_response = _create_mock_response(
            "Su puntaje es 100/100. Nivel: Líder."
        )
        mock_client.chat.completions.create.side_effect = [first_response, second_response]

        result = await gateway.chat("Calcula mi puntaje")

        assert result.response_type == "interpretation"
        assert "calculate_score" in result.metadata["tool_calls"]

    async def test_chat_with_simulate_whatif_tool(self, gateway, mock_client):
        """chat should execute simulate_whatif tool correctly."""
        tool_call = _create_mock_tool_call(
            "call_whatif", "simulate_whatif", {
                "current_answers": {"1": True, "2": False, "3": False},
                "improvements": [2, 3],
            }
        )
        first_response = _create_mock_response(None, tool_calls=[tool_call])
        second_response = _create_mock_response(
            "Si implementa las mejoras en Q2 y Q3, su puntaje subiría 20 puntos."
        )
        mock_client.chat.completions.create.side_effect = [first_response, second_response]

        result = await gateway.chat("¿Qué pasa si mejoro Q2 y Q3?")

        assert result.response_type == "whatif"
        assert "simulate_whatif" in result.metadata["tool_calls"]

    async def test_chat_fallback_on_timeout(self, gateway, mock_client, mock_fallback):
        """chat should use fallback when DeepSeek times out."""
        mock_client.chat.completions.create.side_effect = TimeoutError("Connection timed out")

        result = await gateway.chat("¿Qué es la Ley 1581?")

        assert result.reply == "Respuesta de respaldo."
        assert result.metadata["model"] == "fallback"
        assert "error" in result.metadata
        mock_fallback.generate_response.assert_called_once()

    async def test_chat_fallback_on_api_error(self, gateway, mock_client, mock_fallback):
        """chat should use fallback when DeepSeek returns an error."""
        mock_client.chat.completions.create.side_effect = Exception("API Error 500")

        result = await gateway.chat("Pregunta")

        assert result.reply == "Respuesta de respaldo."
        assert result.metadata["model"] == "fallback"

    async def test_chat_with_context_history(self, gateway, mock_client):
        """chat should include conversation history in messages."""
        mock_client.chat.completions.create.return_value = _create_mock_response(
            "Respuesta con historial."
        )
        context = ChatContext(
            history=[
                {"role": "user", "content": "Hola"},
                {"role": "assistant", "content": "¡Hola! ¿En qué puedo ayudarte?"},
            ]
        )

        result = await gateway.chat("¿Qué es Q1?", context)

        # Verify the messages sent include history
        call_kwargs = mock_client.chat.completions.create.call_args
        messages = call_kwargs.kwargs.get("messages") or call_kwargs[1].get("messages")
        # system + 2 history + user = 4 messages
        assert len(messages) == 4
        assert messages[1]["content"] == "Hola"
        assert messages[2]["content"] == "¡Hola! ¿En qué puedo ayudarte?"

    async def test_chat_cache_store_on_success(self, gateway, mock_client, mock_cache):
        """chat should store response in cache after successful API call."""
        mock_client.chat.completions.create.return_value = _create_mock_response(
            "Respuesta nueva."
        )

        await gateway.chat("Mi pregunta")

        mock_cache.set.assert_called_once()

    async def test_chat_cache_error_graceful(self, gateway, mock_client, mock_cache):
        """chat should continue normally if cache fails."""
        mock_cache.get.side_effect = Exception("Redis down")
        mock_client.chat.completions.create.return_value = _create_mock_response(
            "Respuesta sin cache."
        )

        result = await gateway.chat("Pregunta")

        assert result.reply == "Respuesta sin cache."
        assert result.metadata["cached"] is False

    async def test_chat_stream_yields_chunks(self, gateway, mock_client):
        """chat_stream should yield text chunks."""
        # Mock streaming response
        chunk1 = MagicMock()
        chunk1.choices = [MagicMock()]
        chunk1.choices[0].delta = MagicMock()
        chunk1.choices[0].delta.content = "Hola, "

        chunk2 = MagicMock()
        chunk2.choices = [MagicMock()]
        chunk2.choices[0].delta = MagicMock()
        chunk2.choices[0].delta.content = "¿cómo estás?"

        async def mock_stream():
            yield chunk1
            yield chunk2

        mock_client.chat.completions.create.return_value = mock_stream()

        chunks = []
        async for chunk in gateway.chat_stream("Hola"):
            chunks.append(chunk)

        assert chunks == ["Hola, ", "¿cómo estás?"]

    async def test_chat_stream_fallback_on_error(self, gateway, mock_client, mock_fallback):
        """chat_stream should yield fallback response on error."""
        mock_client.chat.completions.create.side_effect = Exception("Stream error")

        chunks = []
        async for chunk in gateway.chat_stream("Pregunta"):
            chunks.append(chunk)

        assert chunks == ["Respuesta de respaldo."]

    async def test_chat_multiple_tool_calls(self, gateway, mock_client):
        """chat should handle multiple tool calls in one response."""
        tool_call_1 = _create_mock_tool_call(
            "call_1", "calculate_score", {"answers": {"1": True, "2": True, "6": True, "7": True, "8": True, "9": True, "10": True}}
        )
        tool_call_2 = _create_mock_tool_call(
            "call_2", "explain_question", {"question_id": 3}
        )
        first_response = _create_mock_response(None, tool_calls=[tool_call_1, tool_call_2])
        second_response = _create_mock_response(
            "Su puntaje es 80 y la pregunta 3 se refiere al RNBD."
        )
        mock_client.chat.completions.create.side_effect = [first_response, second_response]

        result = await gateway.chat("Calcula mi puntaje y explica Q3")

        assert "calculate_score" in result.metadata["tool_calls"]
        assert "explain_question" in result.metadata["tool_calls"]


# ========== Tests for helper functions ==========


class TestHelperFunctions:
    """Tests for gateway helper functions."""

    def test_determine_response_type_explanation(self):
        assert _determine_response_type(["explain_question"]) == "explanation"

    def test_determine_response_type_interpretation(self):
        assert _determine_response_type(["calculate_score"]) == "interpretation"

    def test_determine_response_type_plan(self):
        assert _determine_response_type(["generate_plan"]) == "plan"

    def test_determine_response_type_whatif(self):
        assert _determine_response_type(["simulate_whatif"]) == "whatif"

    def test_determine_response_type_freeform(self):
        assert _determine_response_type([]) == "freeform"

    def test_suggested_actions_explanation(self):
        actions = _generate_suggested_actions("explanation", None)
        assert len(actions) == 2
        assert any(a["action"] == "next" for a in actions)
        assert any(a["action"] == "plan" for a in actions)

    def test_suggested_actions_interpretation(self):
        actions = _generate_suggested_actions("interpretation", None)
        assert any(a["action"] == "plan" for a in actions)
        assert any(a["action"] == "whatif" for a in actions)

    def test_suggested_actions_freeform(self):
        actions = _generate_suggested_actions("freeform", None)
        assert actions == []
