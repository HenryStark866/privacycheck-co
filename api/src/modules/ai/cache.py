"""Semantic Cache backed by Redis.

Implements intent-based caching that identifies semantically equivalent queries
using keyword classification (no AI tokens consumed). Two queries like
"¿Qué es la pregunta 6?" and "Explícame la 6" resolve to the same cache key
because both classify as intent="explain", question_id=6.

Graceful degradation: Redis connection errors are treated as cache misses,
never as crashes.
"""

import hashlib
import json
import logging
import re
from typing import Any

import redis.asyncio as aioredis

from src.config import settings
from src.modules.ai.prompts import ChatContext

logger = logging.getLogger(__name__)

# --- Intent classification patterns ---
# Each intent maps to a list of keyword patterns (Spanish).
# Patterns are checked in order; first match wins. "freeform" is the default.

INTENT_PATTERNS: dict[str, list[str]] = {
    "explain": [
        r"expl[ií]c(?:ar|[aá]me|a)",
        r"qu[ée]\s+es",
        r"qu[ée]\s+significa",
        r"describe",
    ],
    "whatif": [
        r"qu[ée]\s+pasa\s+si",
        r"que\s+pasa\s+si",
        r"simular",
        r"impacto",
        r"si\s+mejoro",
    ],
    "guide": [
        r"gu[ií]a",
        r"c[oó]mo",
        r"como\s+implementar",
        r"como\s+cumplir",
        r"pasos",
    ],
    "interpret": [
        r"interpretar",
        r"resultado",
        r"puntaje",
        r"nivel",
        r"score",
        r"madurez",
    ],
    "plan": [
        r"plan",
        r"acci[oó]n(?:es)?",
        r"mejorar",
        r"mejora",
        r"prioridades",
    ],
}

# Compiled regex per intent for performance
_COMPILED_PATTERNS: dict[str, list[re.Pattern[str]]] = {
    intent: [re.compile(pattern, re.IGNORECASE) for pattern in patterns]
    for intent, patterns in INTENT_PATTERNS.items()
}

# Pattern to extract question IDs from messages
_QUESTION_ID_PATTERN = re.compile(
    r"(?:pregunta\s+(\d{1,2}))|(?:[PpQq]\s*(\d{1,2}))|(?:\bla\s+(\d{1,2})\b)|(?:^(\d{1,2})$)",
    re.IGNORECASE,
)


def classify_intent(message: str) -> str:
    """Classify the user's intent using keyword-based pattern matching.

    Checks message against known intent patterns in priority order.
    Returns "freeform" if no pattern matches.

    Args:
        message: The user's raw message text.

    Returns:
        One of: "explain", "guide", "interpret", "plan", "whatif", "freeform".
    """
    normalized = message.lower().strip()
    for intent, patterns in _COMPILED_PATTERNS.items():
        for pattern in patterns:
            if pattern.search(normalized):
                return intent
    return "freeform"


def extract_question_id(message: str) -> int | None:
    """Extract a question ID from the user message.

    Looks for patterns like "pregunta 6", "P6", "Q6", "la 6",
    or a standalone number (1-11).

    Args:
        message: The user's raw message text.

    Returns:
        Integer question ID (1-11) if found, None otherwise.
    """
    match = _QUESTION_ID_PATTERN.search(message)
    if match:
        # Get the first non-None group
        for group in match.groups():
            if group is not None:
                num = int(group)
                if 1 <= num <= 11:
                    return num
    return None


def generate_cache_key(
    intent: str,
    question_id: int | None,
    sector: str,
    answers_hash: str,
) -> str:
    """Generate a deterministic SHA-256 cache key from normalized parameters.

    Two semantically equivalent queries produce the same key when they resolve
    to the same intent and parameters.

    Args:
        intent: Classified intent (explain, guide, interpret, plan, whatif, freeform).
        question_id: Extracted question ID or None.
        sector: Company sector string.
        answers_hash: MD5 hash of current answers (truncated to first 8 chars).

    Returns:
        64-character hexadecimal SHA-256 hash string.
    """
    normalized = {
        "intent": intent,
        "question_id": question_id,
        "sector": sector,
        "answers_hash": answers_hash[:8],
    }
    payload = json.dumps(normalized, sort_keys=True).encode()
    return hashlib.sha256(payload).hexdigest()


class RedisSemanticCache:
    """Redis-backed semantic cache implementing the SemanticCache protocol.

    Classifies user intent via keyword patterns, generates deterministic cache keys,
    and stores/retrieves responses from Redis with a configurable TTL.

    Graceful degradation: all Redis errors are caught and logged. On failure,
    get() returns None (cache miss) and set() silently skips storage.
    """

    def __init__(
        self,
        redis_url: str | None = None,
        ttl_seconds: int | None = None,
    ):
        """Initialize the semantic cache.

        Args:
            redis_url: Redis connection URL. Defaults to settings.redis_url.
            ttl_seconds: Cache TTL in seconds. Defaults to settings.cache_ttl_seconds (7 days).
        """
        self._redis_url = redis_url or settings.redis_url
        self._ttl = ttl_seconds or settings.cache_ttl_seconds
        self._redis: aioredis.Redis | None = None

    async def _get_redis(self) -> aioredis.Redis:
        """Get or create the Redis connection.

        Returns:
            Active Redis client instance.

        Raises:
            Exception: If Redis connection cannot be established.
        """
        if self._redis is None:
            self._redis = aioredis.from_url(
                self._redis_url,
                decode_responses=True,
            )
        return self._redis

    def _extract_context_params(
        self, message: str, context: ChatContext | None
    ) -> tuple[str, int | None, str, str]:
        """Extract cache key parameters from message and context.

        Args:
            message: User message.
            context: Optional chat context.

        Returns:
            Tuple of (intent, question_id, sector, answers_hash).
        """
        intent = classify_intent(message)
        question_id = extract_question_id(message)
        sector = ""
        answers_hash = ""

        if context:
            if context.company and context.company.sector:
                sector = context.company.sector
            if context.diagnostic and context.diagnostic.answers:
                # Generate a stable hash of the answers
                answers_payload = json.dumps(
                    context.diagnostic.answers, sort_keys=True
                ).encode()
                answers_hash = hashlib.md5(answers_payload).hexdigest()

        return intent, question_id, sector, answers_hash

    async def get(
        self, message: str, context: ChatContext | None = None
    ) -> str | None:
        """Look up a cached response for the given message and context.

        Flow: classify_intent → extract_question_id → generate_cache_key → Redis GET.

        Args:
            message: User message.
            context: Optional chat context with company/diagnostic state.

        Returns:
            Cached response string if found, None on miss or error.
        """
        try:
            intent, question_id, sector, answers_hash = self._extract_context_params(
                message, context
            )
            key = generate_cache_key(intent, question_id, sector, answers_hash)

            redis_client = await self._get_redis()
            cached = await redis_client.get(f"ai_cache:{key}")
            if cached:
                logger.debug("Cache hit for key %s (intent=%s, q=%s)", key[:12], intent, question_id)
                return cached
            return None
        except Exception as e:
            logger.warning("Cache GET failed (graceful miss): %s", e)
            return None

    async def set(
        self, message: str, context: ChatContext | None, response: str
    ) -> None:
        """Store a response in the cache with TTL.

        Flow: classify_intent → extract_question_id → generate_cache_key → Redis SET with TTL.

        Args:
            message: User message.
            context: Optional chat context.
            response: AI response to cache.
        """
        try:
            intent, question_id, sector, answers_hash = self._extract_context_params(
                message, context
            )
            key = generate_cache_key(intent, question_id, sector, answers_hash)

            redis_client = await self._get_redis()
            await redis_client.set(f"ai_cache:{key}", response, ex=self._ttl)
            logger.debug("Cache SET for key %s (TTL=%ds)", key[:12], self._ttl)
        except Exception as e:
            logger.warning("Cache SET failed (graceful skip): %s", e)

    async def close(self) -> None:
        """Close the Redis connection if open."""
        if self._redis:
            await self._redis.close()
            self._redis = None
