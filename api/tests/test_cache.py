"""Tests for the Semantic Cache module.

Covers:
- Intent classification determinism (Property 14)
- Cache key determinism and collision resistance (Property 15)
- TTL enforcement
- Redis-down graceful degradation
- Question ID extraction
"""

import hashlib
import json
from unittest.mock import AsyncMock, patch, MagicMock

import pytest
from hypothesis import given, settings as hyp_settings
from hypothesis import strategies as st

from src.modules.ai.cache import (
    RedisSemanticCache,
    classify_intent,
    extract_question_id,
    generate_cache_key,
)
from src.modules.ai.prompts import ChatContext, CompanyContext, DiagnosticState


# =============================================================================
# Unit Tests: classify_intent
# =============================================================================


class TestClassifyIntent:
    """Unit tests for intent classification."""

    @pytest.mark.parametrize(
        "message,expected",
        [
            ("Explícame la pregunta 6", "explain"),
            ("explicar qué significa eso", "explain"),
            ("qué es la pregunta 3", "explain"),
            ("Que es el tratamiento de datos", "explain"),
            ("qué significa habeas data", "explain"),
            ("describe la pregunta 1", "explain"),
            ("Guía para implementar", "guide"),
            ("guia de cumplimiento", "guide"),
            ("cómo implementar esto", "guide"),
            ("como cumplir con la ley", "guide"),
            ("pasos para mejorar", "guide"),
            ("interpretar mi resultado", "interpret"),
            ("cuál es mi puntaje", "interpret"),
            ("mi nivel de madurez", "interpret"),
            ("cuál es mi score", "interpret"),
            ("resultado del diagnóstico", "interpret"),
            ("plan de acción", "plan"),
            ("acciones para mejorar", "plan"),
            ("mejora continua", "plan"),
            ("prioridades de cumplimiento", "plan"),
            ("qué pasa si mejoro la pregunta 6", "whatif"),
            ("que pasa si implemento eso", "whatif"),
            ("simular una mejora", "whatif"),
            ("impacto de mejorar Q9", "whatif"),
            ("si mejoro la pregunta 8", "whatif"),
            ("hola, buenos días", "freeform"),
            ("algo completamente diferente", "freeform"),
            ("12345", "freeform"),
        ],
    )
    def test_intent_classification(self, message: str, expected: str):
        """Each message should classify to the expected intent."""
        assert classify_intent(message) == expected

    def test_classification_is_deterministic(self):
        """Same message always returns the same intent."""
        messages = [
            "Explícame la pregunta 6",
            "plan de acción",
            "simular mejora",
            "hola",
        ]
        for msg in messages:
            first = classify_intent(msg)
            for _ in range(10):
                assert classify_intent(msg) == first

    def test_valid_intent_values(self):
        """classify_intent always returns one of the valid intent strings."""
        valid_intents = {"explain", "guide", "interpret", "plan", "whatif", "freeform"}
        test_messages = [
            "", "x", "pregunta", "explicar", "plan", "simular",
            "algo random", "12345", "¿?!", "cómo cumplir",
        ]
        for msg in test_messages:
            assert classify_intent(msg) in valid_intents


# =============================================================================
# Unit Tests: extract_question_id
# =============================================================================


class TestExtractQuestionId:
    """Unit tests for question ID extraction."""

    @pytest.mark.parametrize(
        "message,expected",
        [
            ("pregunta 6", 6),
            ("Pregunta 11", 11),
            ("la pregunta 1", 1),
            ("P 3", 3),
            ("Q 9", 9),
            ("la 7", 7),
            ("algo sin número", None),
            ("pregunta 0", None),
            ("pregunta 12", None),
            ("pregunta 99", None),
        ],
    )
    def test_extraction(self, message: str, expected: int | None):
        """Should extract valid question IDs or return None."""
        assert extract_question_id(message) == expected

    def test_boundary_ids(self):
        """IDs must be in range 1-11."""
        assert extract_question_id("pregunta 1") == 1
        assert extract_question_id("pregunta 11") == 11
        assert extract_question_id("pregunta 0") is None
        assert extract_question_id("pregunta 12") is None


# =============================================================================
# Unit Tests: generate_cache_key
# =============================================================================


class TestGenerateCacheKey:
    """Unit tests for cache key generation."""

    def test_deterministic(self):
        """Same inputs always produce the same key."""
        key1 = generate_cache_key("explain", 6, "salud", "abc12345")
        key2 = generate_cache_key("explain", 6, "salud", "abc12345")
        assert key1 == key2

    def test_key_format(self):
        """Key should be a 64-char hex string (SHA-256)."""
        key = generate_cache_key("explain", 6, "salud", "abc12345")
        assert len(key) == 64
        assert all(c in "0123456789abcdef" for c in key)

    def test_different_intent_different_key(self):
        """Different intents produce different keys."""
        k1 = generate_cache_key("explain", 6, "salud", "abc12345")
        k2 = generate_cache_key("guide", 6, "salud", "abc12345")
        assert k1 != k2

    def test_different_question_id_different_key(self):
        """Different question IDs produce different keys."""
        k1 = generate_cache_key("explain", 6, "salud", "abc12345")
        k2 = generate_cache_key("explain", 7, "salud", "abc12345")
        assert k1 != k2

    def test_none_question_id_different_from_any_number(self):
        """None question_id is distinct from any numeric ID."""
        k_none = generate_cache_key("explain", None, "salud", "abc12345")
        for qid in range(1, 12):
            k_num = generate_cache_key("explain", qid, "salud", "abc12345")
            assert k_none != k_num

    def test_different_sector_different_key(self):
        """Different sectors produce different keys."""
        k1 = generate_cache_key("explain", 6, "salud", "abc12345")
        k2 = generate_cache_key("explain", 6, "finanzas", "abc12345")
        assert k1 != k2

    def test_different_answers_hash_different_key(self):
        """Different answer hashes produce different keys."""
        k1 = generate_cache_key("explain", 6, "salud", "abc12345")
        k2 = generate_cache_key("explain", 6, "salud", "xyz98765")
        assert k1 != k2

    def test_answers_hash_truncated_to_8(self):
        """Only first 8 chars of answers_hash matter."""
        k1 = generate_cache_key("explain", 6, "salud", "abcdefgh_extra_stuff")
        k2 = generate_cache_key("explain", 6, "salud", "abcdefgh_different")
        assert k1 == k2


# =============================================================================
# Unit Tests: RedisSemanticCache
# =============================================================================


class TestRedisSemanticCache:
    """Unit tests for the RedisSemanticCache class."""

    @pytest.fixture
    def mock_redis(self):
        """Create a mock Redis client."""
        mock = AsyncMock()
        mock.get = AsyncMock(return_value=None)
        mock.set = AsyncMock(return_value=True)
        mock.close = AsyncMock()
        return mock

    @pytest.fixture
    def cache(self, mock_redis):
        """Create a cache instance with mocked Redis."""
        cache_instance = RedisSemanticCache(
            redis_url="redis://localhost:6379/0",
            ttl_seconds=604800,
        )
        cache_instance._redis = mock_redis
        return cache_instance

    @pytest.fixture
    def sample_context(self):
        """Sample chat context for testing."""
        return ChatContext(
            company=CompanyContext(nombre="TestCo", sector="salud", tamano="Grande"),
            diagnostic=DiagnosticState(
                score=75,
                maturity="Optimizado",
                answers={1: True, 2: True, 3: False, 6: True, 7: True, 8: True, 9: True, 10: True},
            ),
        )

    @pytest.mark.asyncio
    async def test_get_cache_miss(self, cache, mock_redis):
        """get() returns None on cache miss."""
        mock_redis.get.return_value = None
        result = await cache.get("Explícame la pregunta 6")
        assert result is None

    @pytest.mark.asyncio
    async def test_get_cache_hit(self, cache, mock_redis):
        """get() returns cached response on hit."""
        mock_redis.get.return_value = "Cached explanation response"
        result = await cache.get("Explícame la pregunta 6")
        assert result == "Cached explanation response"

    @pytest.mark.asyncio
    async def test_set_stores_with_ttl(self, cache, mock_redis):
        """set() stores response in Redis with correct TTL."""
        await cache.set("Explícame la pregunta 6", None, "Response text")
        mock_redis.set.assert_called_once()
        call_args = mock_redis.set.call_args
        # Verify TTL (ex parameter)
        assert call_args.kwargs.get("ex") == 604800 or call_args[1].get("ex") == 604800 or 604800 in call_args[0]

    @pytest.mark.asyncio
    async def test_get_with_context(self, cache, mock_redis, sample_context):
        """get() uses context for key generation."""
        mock_redis.get.return_value = "Cached with context"
        result = await cache.get("Explícame la pregunta 6", sample_context)
        assert result == "Cached with context"
        # Should have called Redis with a key that includes context info
        mock_redis.get.assert_called_once()

    @pytest.mark.asyncio
    async def test_set_with_context(self, cache, mock_redis, sample_context):
        """set() uses context for key generation."""
        await cache.set("Explícame la pregunta 6", sample_context, "Response")
        mock_redis.set.assert_called_once()

    @pytest.mark.asyncio
    async def test_get_redis_down_returns_none(self, cache, mock_redis):
        """get() returns None gracefully when Redis is down."""
        mock_redis.get.side_effect = ConnectionError("Redis unavailable")
        result = await cache.get("Explícame la pregunta 6")
        assert result is None

    @pytest.mark.asyncio
    async def test_set_redis_down_does_not_crash(self, cache, mock_redis):
        """set() silently skips when Redis is down."""
        mock_redis.set.side_effect = ConnectionError("Redis unavailable")
        # Should not raise
        await cache.set("Explícame la pregunta 6", None, "Response")

    @pytest.mark.asyncio
    async def test_get_redis_timeout_returns_none(self, cache, mock_redis):
        """get() returns None on Redis timeout."""
        mock_redis.get.side_effect = TimeoutError("Redis timeout")
        result = await cache.get("Something")
        assert result is None

    @pytest.mark.asyncio
    async def test_set_redis_timeout_does_not_crash(self, cache, mock_redis):
        """set() does not crash on Redis timeout."""
        mock_redis.set.side_effect = TimeoutError("Redis timeout")
        await cache.set("Something", None, "Response")

    @pytest.mark.asyncio
    async def test_semantically_equivalent_messages_same_key(self, cache, mock_redis):
        """Two semantically equivalent messages should hit the same cache key."""
        # Both should classify as intent="explain", question_id=6
        calls = []
        mock_redis.get.side_effect = lambda key: calls.append(key) or None

        await cache.get("¿Qué es la pregunta 6?")
        await cache.get("Explícame la 6")

        # Both should use the same Redis key
        assert len(calls) == 2
        assert calls[0] == calls[1]

    @pytest.mark.asyncio
    async def test_close(self, cache, mock_redis):
        """close() shuts down Redis connection."""
        await cache.close()
        mock_redis.close.assert_called_once()
        assert cache._redis is None


# =============================================================================
# Property-Based Tests
# =============================================================================


class TestPropertyIntentDeterminism:
    """Property 14: Intent classification is deterministic.

    **Validates: Requirements 9.4**

    For any user message string, classify_intent SHALL return one of the defined
    intents, and the same input SHALL always map to the same intent.
    """

    VALID_INTENTS = {"explain", "guide", "interpret", "plan", "whatif", "freeform"}

    @given(message=st.text(min_size=0, max_size=200))
    @hyp_settings(max_examples=100)
    def test_always_returns_valid_intent(self, message: str):
        """classify_intent always returns one of the 6 valid intents."""
        result = classify_intent(message)
        assert result in self.VALID_INTENTS

    @given(message=st.text(min_size=0, max_size=200))
    @hyp_settings(max_examples=100)
    def test_deterministic_same_input_same_output(self, message: str):
        """Same message always produces the same intent classification."""
        first = classify_intent(message)
        second = classify_intent(message)
        assert first == second


class TestPropertyCacheKeyDeterminismAndCollisionResistance:
    """Property 15: Cache key determinism and collision resistance.

    **Validates: Requirements 9.1, 9.5**

    Same (intent, question_id, sector, answers_hash) → same key.
    Different params → different key.
    """

    intents = st.sampled_from(["explain", "guide", "interpret", "plan", "whatif", "freeform"])
    question_ids = st.one_of(st.none(), st.integers(min_value=1, max_value=11))
    sectors = st.text(min_size=0, max_size=50, alphabet=st.characters(whitelist_categories=("L", "N")))
    hashes = st.text(min_size=8, max_size=32, alphabet="0123456789abcdef")

    @given(
        intent=intents,
        qid=question_ids,
        sector=sectors,
        answers_hash=hashes,
    )
    @hyp_settings(max_examples=100)
    def test_same_params_same_key(self, intent, qid, sector, answers_hash):
        """Identical parameters always produce the same cache key."""
        k1 = generate_cache_key(intent, qid, sector, answers_hash)
        k2 = generate_cache_key(intent, qid, sector, answers_hash)
        assert k1 == k2

    @given(
        intent1=intents,
        intent2=intents,
        qid1=question_ids,
        qid2=question_ids,
        sector1=sectors,
        sector2=sectors,
        hash1=hashes,
        hash2=hashes,
    )
    @hyp_settings(max_examples=100)
    def test_different_params_different_key(
        self, intent1, intent2, qid1, qid2, sector1, sector2, hash1, hash2
    ):
        """Different parameter tuples produce different cache keys."""
        # Only test when at least one parameter differs (considering truncation)
        if (intent1, qid1, sector1, hash1[:8]) == (intent2, qid2, sector2, hash2[:8]):
            # Same effective params → same key (tested above)
            return
        k1 = generate_cache_key(intent1, qid1, sector1, hash1)
        k2 = generate_cache_key(intent2, qid2, sector2, hash2)
        assert k1 != k2

    @given(
        intent=intents,
        qid=question_ids,
        sector=sectors,
        answers_hash=hashes,
    )
    @hyp_settings(max_examples=100)
    def test_key_is_valid_sha256(self, intent, qid, sector, answers_hash):
        """Generated key is always a valid 64-char hex SHA-256 hash."""
        key = generate_cache_key(intent, qid, sector, answers_hash)
        assert len(key) == 64
        assert all(c in "0123456789abcdef" for c in key)
