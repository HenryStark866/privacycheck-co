"""AI Gateway orchestrator using DeepSeek via OpenAI SDK.

Implements the main AI interaction flow:
cache check → DeepSeek call with tools → tool execution loop → cache store → return AIResponse

Uses the OpenAI Python SDK with base_url="https://api.deepseek.com" for
DeepSeek's OpenAI-compatible API.
"""

import json
import logging
from collections.abc import AsyncGenerator, Callable
from dataclasses import dataclass, field
from typing import Any, Protocol

from openai import AsyncOpenAI

from src.modules.ai.prompts import ChatContext, build_system_prompt
from src.modules.ai.tools import get_tool_definitions
from src.modules.diagnostico.questions import get_question
from src.modules.diagnostico.scoring import compute_score, simulate_improvements

logger = logging.getLogger(__name__)


# --- Protocols for dependencies (placeholders for Tasks 8 & 9) ---


class SemanticCache(Protocol):
    """Protocol for semantic cache (implemented in Task 8)."""

    async def get(self, message: str, context: ChatContext | None = None) -> str | None:
        """Look up a cached response for the given message and context."""
        ...

    async def set(
        self, message: str, context: ChatContext | None, response: str
    ) -> None:
        """Store a response in the cache."""
        ...


class FallbackProvider(Protocol):
    """Protocol for deterministic fallback (implemented in Task 9)."""

    def generate_response(self, message: str, context: ChatContext | None = None) -> str:
        """Generate a deterministic fallback response."""
        ...


# --- Response dataclass ---


@dataclass
class AIResponse:
    """Response from the AI Gateway."""

    reply: str
    response_type: str = "freeform"  # explanation | interpretation | plan | whatif | freeform
    metadata: dict = field(default_factory=dict)
    suggested_actions: list[dict] = field(default_factory=list)


# --- Tool execution ---


def _execute_tool(name: str, arguments: dict[str, Any]) -> str:
    """Execute a tool call and return the result as a JSON string.

    Args:
        name: The tool function name.
        arguments: The parsed arguments for the tool.

    Returns:
        JSON string with the tool result.
    """
    if name == "explain_question":
        question_id = arguments.get("question_id", 0)
        question = get_question(question_id)
        if question:
            result = {
                "question_id": question["id"],
                "text": question["text"],
                "explain": question["explain"],
                "guide": question["guide"],
                "block": question["block"],
                "weight": question["weight"],
                "role": question["role"],
            }
        else:
            result = {"error": f"Pregunta {question_id} no encontrada."}
        return json.dumps(result, ensure_ascii=False)

    elif name == "calculate_score":
        raw_answers = arguments.get("answers", {})
        # Convert string keys to int keys
        answers = {int(k): v for k, v in raw_answers.items()}
        score_result = compute_score(answers)
        result = {
            "score": score_result.score,
            "maturity": score_result.maturity.label,
            "blocks": {
                k: {"name": v.name, "earned": v.earned, "max": v.max}
                for k, v in score_result.blocks.items()
            },
            "gaps": [
                {"question_id": g.question_id, "weight": g.weight, "text": g.text}
                for g in score_result.gaps
            ],
            "notes": score_result.notes,
        }
        return json.dumps(result, ensure_ascii=False)

    elif name == "generate_plan":
        gaps = arguments.get("gaps", [])
        sector = arguments.get("sector", "General")
        size = arguments.get("size", "Mediana")
        # Generate prioritized plan based on gaps
        plan_items = []
        for i, gap in enumerate(gaps, 1):
            q_id = gap.get("question_id", 0)
            question = get_question(q_id)
            guide = question["guide"] if question else "Consulte la normativa aplicable."
            plan_items.append({
                "priority": i,
                "question_id": q_id,
                "weight": gap.get("weight", 0),
                "action": guide,
                "sector_note": f"Relevante para el sector {sector}." if sector else None,
            })
        result = {
            "plan": plan_items,
            "total_potential_improvement": sum(g.get("weight", 0) for g in gaps),
            "company_size": size,
        }
        return json.dumps(result, ensure_ascii=False)

    elif name == "simulate_whatif":
        raw_answers = arguments.get("current_answers", {})
        improvements = arguments.get("improvements", [])
        # Convert string keys to int keys
        answers = {int(k): v for k, v in raw_answers.items()}
        projected, delta = simulate_improvements(answers, improvements)
        result = {
            "current_score": compute_score(answers).score,
            "projected_score": projected.score,
            "delta": delta,
            "projected_maturity": projected.maturity.label,
            "improvements_applied": improvements,
        }
        return json.dumps(result, ensure_ascii=False)

    else:
        return json.dumps({"error": f"Herramienta '{name}' no reconocida."})


def _determine_response_type(tool_calls_made: list[str]) -> str:
    """Determine response type based on which tools were called."""
    if "explain_question" in tool_calls_made:
        return "explanation"
    if "calculate_score" in tool_calls_made:
        return "interpretation"
    if "generate_plan" in tool_calls_made:
        return "plan"
    if "simulate_whatif" in tool_calls_made:
        return "whatif"
    return "freeform"


# --- AI Gateway class ---


class AIGateway:
    """Orchestrates AI interactions via DeepSeek's OpenAI-compatible API.

    Flow: cache check → DeepSeek call with tools → tool execution loop → cache store → return AIResponse

    Args:
        client: AsyncOpenAI client configured with DeepSeek endpoint.
        cache: Semantic cache for avoiding redundant API calls.
        fallback: Deterministic fallback provider for when AI is unavailable.
        scoring_engine: The scoring function (defaults to compute_score).
        model: Model identifier for DeepSeek.
        timeout: Request timeout in seconds.
    """

    def __init__(
        self,
        client: AsyncOpenAI,
        cache: SemanticCache,
        fallback: FallbackProvider,
        scoring_engine: Callable | None = None,
        model: str = "deepseek-chat",
        timeout: float = 10.0,
    ):
        self.client = client
        self.cache = cache
        self.fallback = fallback
        self.scoring_engine = scoring_engine or compute_score
        self.model = model
        self.timeout = timeout

    async def chat(self, message: str, context: ChatContext | None = None) -> AIResponse:
        """Main entry point for AI chat interaction.

        1. Check cache for existing response
        2. Call DeepSeek with tools and conversation history
        3. Handle tool calls in a loop
        4. Store response in cache
        5. Return AIResponse

        Falls back to deterministic provider on timeout or error.

        Args:
            message: User message.
            context: Chat context with company/diagnostic state and history.

        Returns:
            AIResponse with reply, type, metadata, and suggested actions.
        """
        # 1. Check cache
        try:
            cached = await self.cache.get(message, context)
            if cached:
                return AIResponse(
                    reply=cached,
                    response_type="freeform",
                    metadata={"cached": True, "model": self.model},
                    suggested_actions=[],
                )
        except Exception as e:
            logger.warning("Cache lookup failed: %s", e)

        # 2. Build messages for the API call
        system_prompt = build_system_prompt(context)
        messages: list[dict[str, Any]] = [{"role": "system", "content": system_prompt}]

        # Add conversation history
        if context and context.history:
            for msg in context.history:
                messages.append({"role": msg["role"], "content": msg["content"]})

        # Add current user message
        messages.append({"role": "user", "content": message})

        # 3. Call DeepSeek with tools
        tool_calls_made: list[str] = []
        try:
            response = await self.client.chat.completions.create(
                model=self.model,
                messages=messages,
                tools=get_tool_definitions(),
                timeout=self.timeout,
            )

            # 4. Tool execution loop (max 5 iterations to prevent infinite loops)
            max_iterations = 5
            iteration = 0
            while iteration < max_iterations:
                choice = response.choices[0]

                # If no tool calls, we're done
                if not choice.message.tool_calls:
                    break

                # Process each tool call
                messages.append(choice.message)
                for tool_call in choice.message.tool_calls:
                    fn_name = tool_call.function.name
                    fn_args = json.loads(tool_call.function.arguments)
                    tool_calls_made.append(fn_name)

                    tool_result = _execute_tool(fn_name, fn_args)
                    messages.append({
                        "role": "tool",
                        "tool_call_id": tool_call.id,
                        "content": tool_result,
                    })

                # Call the model again with tool results
                response = await self.client.chat.completions.create(
                    model=self.model,
                    messages=messages,
                    tools=get_tool_definitions(),
                    timeout=self.timeout,
                )
                iteration += 1

            # Extract final response
            final_message = response.choices[0].message
            reply = final_message.content or ""

            # Compute metadata
            usage = response.usage
            metadata = {
                "cached": False,
                "model": self.model,
                "tokens_used": usage.total_tokens if usage else 0,
                "prompt_tokens": usage.prompt_tokens if usage else 0,
                "completion_tokens": usage.completion_tokens if usage else 0,
                "tool_calls": tool_calls_made,
            }

            # Determine response type
            response_type = _determine_response_type(tool_calls_made)

            # 5. Store in cache
            try:
                await self.cache.set(message, context, reply)
            except Exception as e:
                logger.warning("Cache store failed: %s", e)

            return AIResponse(
                reply=reply,
                response_type=response_type,
                metadata=metadata,
                suggested_actions=_generate_suggested_actions(response_type, context),
            )

        except Exception as e:
            # Timeout or API error → fallback
            logger.warning("DeepSeek API call failed: %s. Using fallback.", e)
            fallback_reply = self.fallback.generate_response(message, context)
            return AIResponse(
                reply=fallback_reply,
                response_type="freeform",
                metadata={"cached": False, "model": "fallback", "error": str(e)},
                suggested_actions=[],
            )

    async def chat_stream(
        self, message: str, context: ChatContext | None = None
    ) -> AsyncGenerator[str, None]:
        """Streaming variant for SSE. Yields text chunks as they arrive.

        Uses client.chat.completions.create(stream=True).
        Note: Streaming does not support tool calls in this implementation.
        Falls back to non-streaming on error.

        Args:
            message: User message.
            context: Chat context.

        Yields:
            Text chunks as they arrive from the model.
        """
        system_prompt = build_system_prompt(context)
        messages: list[dict[str, Any]] = [{"role": "system", "content": system_prompt}]

        if context and context.history:
            for msg in context.history:
                messages.append({"role": msg["role"], "content": msg["content"]})

        messages.append({"role": "user", "content": message})

        try:
            stream = await self.client.chat.completions.create(
                model=self.model,
                messages=messages,
                stream=True,
                timeout=self.timeout,
            )

            async for chunk in stream:
                if chunk.choices and chunk.choices[0].delta.content:
                    yield chunk.choices[0].delta.content

        except Exception as e:
            logger.warning("DeepSeek streaming failed: %s. Using fallback.", e)
            fallback_reply = self.fallback.generate_response(message, context)
            yield fallback_reply


# --- Helpers ---


def _generate_suggested_actions(
    response_type: str, context: ChatContext | None
) -> list[dict]:
    """Generate suggested next actions based on response type and context."""
    actions: list[dict] = []

    if response_type == "explanation":
        actions.append({"label": "Ver siguiente pregunta", "action": "next", "payload": None})
        actions.append({"label": "Generar plan", "action": "plan", "payload": None})

    elif response_type == "interpretation":
        actions.append({"label": "Ver plan de mejora", "action": "plan", "payload": None})
        actions.append({"label": "Simular mejora", "action": "whatif", "payload": None})

    elif response_type == "plan":
        actions.append({"label": "Simular impacto", "action": "whatif", "payload": None})

    elif response_type == "whatif":
        actions.append({"label": "Ver plan completo", "action": "plan", "payload": None})

    return actions
