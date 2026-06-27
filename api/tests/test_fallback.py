"""Tests for the Deterministic Fallback Provider.

Tests cover:
- Completeness: all 11 questions return non-empty explanations
- Completeness: all score ranges return non-empty interpretations
- Ordering: plan returns gaps in weight-descending priority order
- Intent dispatch: generate_response routes to correct handler
- Property-based tests using Hypothesis for Property 16
"""

import pytest
from hypothesis import given, settings, strategies as st

from src.modules.ai.fallback import DeterministicFallbackProvider
from src.modules.ai.prompts import ChatContext, CompanyContext, DiagnosticState
from src.modules.diagnostico.questions import QUESTIONS
from src.modules.diagnostico.scoring import MATURITY_THRESHOLDS


@pytest.fixture
def provider():
    """Create a FallbackProvider instance."""
    return DeterministicFallbackProvider()


# --- Unit Tests: explain ---


class TestExplain:
    """Test explain method for all 11 questions."""

    def test_all_11_questions_return_nonempty(self, provider):
        """Every question ID from 1 to 11 must produce a non-empty explanation."""
        for q_id in range(1, 12):
            result = provider.explain(q_id)
            assert result, f"explain({q_id}) returned empty string"
            assert len(result) > 50, f"explain({q_id}) seems too short: {result[:30]}"

    def test_explain_includes_question_text(self, provider):
        """Explanation should include the original question text."""
        for q in QUESTIONS:
            result = provider.explain(q["id"])
            assert q["text"] in result

    def test_explain_includes_guidance(self, provider):
        """Explanation should include the guidance text."""
        for q in QUESTIONS:
            result = provider.explain(q["id"])
            assert q["guide"] in result

    def test_explain_includes_explanation(self, provider):
        """Explanation should include the explain text."""
        for q in QUESTIONS:
            result = provider.explain(q["id"])
            assert q["explain"] in result

    def test_explain_invalid_question_id(self, provider):
        """Out-of-range question IDs return a helpful message, not empty."""
        for q_id in [0, 12, 99, -1]:
            result = provider.explain(q_id)
            assert result
            assert "no se encuentra" in result.lower() or len(result) > 10

    def test_explain_gate_question_has_note(self, provider):
        """Question 1 (gate) should mention it's a control question."""
        result = provider.explain(1)
        assert "control" in result.lower() or "condiciona" in result.lower()

    def test_explain_complementary_question_has_note(self, provider):
        """Question 11 (complementary) should mention it doesn't score."""
        result = provider.explain(11)
        assert "complementaria" in result.lower() or "no suma" in result.lower()


# --- Unit Tests: interpret ---


class TestInterpret:
    """Test interpret method for all score ranges and maturity levels."""

    def test_all_maturity_levels_return_nonempty(self, provider):
        """Every known maturity level produces a non-empty interpretation."""
        test_cases = [
            (100, "Líder"),
            (80, "Optimizado"),
            (60, "Gestionado"),
            (30, "Básico"),
            (10, "Inicial"),
        ]
        for score, maturity in test_cases:
            result = provider.interpret(score, maturity, {})
            assert result, f"interpret({score}, {maturity}) returned empty"
            assert str(score) in result

    def test_interpret_score_zero(self, provider):
        """Score 0 should produce a non-empty result."""
        result = provider.interpret(0, "Inicial", {})
        assert result
        assert "0" in result

    def test_interpret_score_100(self, provider):
        """Score 100 should produce a non-empty result."""
        result = provider.interpret(100, "Líder", {})
        assert result
        assert "100" in result

    def test_interpret_with_blocks(self, provider):
        """Interpretation with block data should include block breakdown."""
        blocks = {
            "A": {"earned": 30, "max": 40},
            "B": {"earned": 24, "max": 36},
            "C": {"earned": 16, "max": 24},
        }
        result = provider.interpret(70, "Gestionado", blocks)
        assert "Bloque A" in result
        assert "Bloque B" in result
        assert "Bloque C" in result
        assert "30/40" in result

    def test_interpret_unknown_maturity_label(self, provider):
        """Unknown maturity label should still produce non-empty output."""
        result = provider.interpret(50, "UnknownLevel", {})
        assert result
        assert "50" in result

    def test_interpret_boundary_scores(self, provider):
        """Boundary scores (0, 25, 50, 75, 95, 100) all produce results."""
        boundaries = [0, 25, 50, 75, 95, 100]
        for score in boundaries:
            result = provider.interpret(score, "Test", {})
            assert result, f"interpret({score}) returned empty"


# --- Unit Tests: plan ---


class TestPlan:
    """Test plan method for ordering and completeness."""

    def test_empty_gaps_returns_congratulations(self, provider):
        """Empty gap list should return a congratulatory message."""
        result = provider.plan([], None)
        assert result
        assert "felicitaciones" in result.lower() or "no se identificaron" in result.lower()

    def test_single_gap(self, provider):
        """Single gap should produce a non-empty plan."""
        gaps = [{"question_id": 9, "weight": 16, "text": "Test gap"}]
        result = provider.plan(gaps)
        assert result
        assert "16" in result

    def test_gaps_ordered_by_weight_descending(self, provider):
        """Plan should present gaps in weight-descending order."""
        gaps = [
            {"question_id": 2, "weight": 10, "text": "Low priority"},
            {"question_id": 9, "weight": 16, "text": "High priority"},
            {"question_id": 6, "weight": 12, "text": "Medium priority"},
        ]
        result = provider.plan(gaps)
        # Find positions of priorities in the output
        pos_16 = result.find("Prioridad 16%")
        pos_12 = result.find("Prioridad 12%")
        pos_10 = result.find("Prioridad 10%")
        assert pos_16 < pos_12 < pos_10, (
            f"Plan not in descending weight order: 16@{pos_16}, 12@{pos_12}, 10@{pos_10}"
        )

    def test_plan_with_sector(self, provider):
        """Plan with sector should include sector context."""
        gaps = [{"question_id": 6, "weight": 12, "text": "Test"}]
        result = provider.plan(gaps, sector="Financiero")
        assert "Financiero" in result

    def test_plan_includes_guidance(self, provider):
        """Plan should include guidance from questions.py for known question IDs."""
        gaps = [{"question_id": 9, "weight": 16, "text": "Test"}]
        result = provider.plan(gaps)
        # Question 9's guidance mentions "gestión de incidentes"
        assert "incidentes" in result.lower()

    def test_plan_all_possible_gaps(self, provider):
        """Plan with all scored questions as gaps should be non-empty."""
        gaps = [
            {"question_id": q_id, "weight": w, "text": f"Q{q_id}"}
            for q_id, w in [(9, 16), (6, 12), (7, 12), (8, 12), (2, 10), (3, 10), (4, 10), (5, 10), (10, 8)]
        ]
        result = provider.plan(gaps)
        assert result
        assert len(result) > 100  # Should be substantial


# --- Unit Tests: generate_response ---


class TestGenerateResponse:
    """Test generate_response intent detection and dispatch."""

    def test_explain_intent_with_question_id(self, provider):
        """Message with explain intent + question ID dispatches to explain."""
        result = provider.generate_response("Explícame la pregunta 6")
        assert result
        # Should contain Q6's content
        assert "6" in result

    def test_explain_intent_without_question_id(self, provider):
        """Explain intent without question ID lists all questions."""
        result = provider.generate_response("Explícame el diagnóstico")
        assert result
        assert "P1" in result or "pregunta" in result.lower()

    def test_interpret_intent_with_context(self, provider):
        """Interpret intent with diagnostic context dispatches to interpret."""
        context = ChatContext(
            company=CompanyContext(nombre="Test Co", sector="Tecnología"),
            diagnostic=DiagnosticState(score=70, maturity="Gestionado"),
        )
        result = provider.generate_response("Interpreta mi resultado", context)
        assert result
        assert "70" in result

    def test_plan_intent_with_context(self, provider):
        """Plan intent with diagnostic context dispatches to plan."""
        context = ChatContext(
            company=CompanyContext(nombre="Test Co", sector="Salud"),
            diagnostic=DiagnosticState(
                score=50,
                maturity="Gestionado",
                gaps=[
                    {"question_id": 9, "weight": 16, "text": "Q9"},
                    {"question_id": 6, "weight": 12, "text": "Q6"},
                ],
            ),
        )
        result = provider.generate_response("Genera un plan de mejora", context)
        assert result
        assert "Salud" in result

    def test_whatif_intent(self, provider):
        """What-if intent returns helpful message about simulation endpoint."""
        result = provider.generate_response("Qué pasa si mejoro la pregunta 6")
        assert result
        assert "simulación" in result.lower() or "simulate" in result.lower()

    def test_freeform_returns_generic(self, provider):
        """Unrecognized intent returns generic fallback message."""
        result = provider.generate_response("Buenos días, necesito información general")
        assert result
        assert "Habeas Check" in result or "1581" in result

    def test_no_context_interpret_intent(self, provider):
        """Interpret intent without context returns helpful guidance."""
        result = provider.generate_response("Interpreta mi resultado")
        assert result
        assert "diagnóstico" in result.lower()

    def test_generate_response_never_returns_empty(self, provider):
        """No input combination should produce an empty response."""
        test_messages = [
            "",
            "hola",
            "pregunta 1",
            "plan",
            "resultado",
            "???",
            "a" * 500,
        ]
        for msg in test_messages:
            result = provider.generate_response(msg)
            assert result, f"generate_response('{msg[:20]}') returned empty"


# --- Property-Based Tests (Hypothesis) ---
# Validates: Requirements 10.2, 10.3, 10.4 (Property 16)


class TestFallbackCompleteness:
    """Property-based tests for fallback completeness (Property 16).

    **Validates: Requirements 10.2, 10.3, 10.4**
    """

    @given(question_id=st.integers(min_value=1, max_value=11))
    @settings(max_examples=100)
    def test_explain_nonempty_for_all_valid_ids(self, question_id):
        """For any question ID in {1..11}, explain SHALL return non-empty.

        **Validates: Requirements 10.2**
        """
        provider = DeterministicFallbackProvider()
        result = provider.explain(question_id)
        assert isinstance(result, str)
        assert len(result) > 0

    @given(
        score=st.integers(min_value=0, max_value=100),
        maturity=st.sampled_from(["Líder", "Optimizado", "Gestionado", "Básico", "Inicial"]),
    )
    @settings(max_examples=100)
    def test_interpret_nonempty_for_all_scores_and_maturities(self, score, maturity):
        """For any score in [0, 100] and maturity label, interpret SHALL return non-empty.

        **Validates: Requirements 10.3**
        """
        provider = DeterministicFallbackProvider()
        blocks = {
            "A": {"earned": min(score, 40), "max": 40},
            "B": {"earned": min(max(score - 40, 0), 36), "max": 36},
            "C": {"earned": min(max(score - 76, 0), 24), "max": 24},
        }
        result = provider.interpret(score, maturity, blocks)
        assert isinstance(result, str)
        assert len(result) > 0

    @given(
        gaps=st.lists(
            st.fixed_dictionaries({
                "question_id": st.sampled_from([2, 3, 4, 5, 6, 7, 8, 9, 10]),
                "weight": st.sampled_from([8, 10, 12, 16]),
                "text": st.text(min_size=5, max_size=50),
            }),
            min_size=1,
            max_size=9,
        ),
    )
    @settings(max_examples=100)
    def test_plan_nonempty_and_ordered_for_any_gaps(self, gaps):
        """For any non-empty gap list, plan SHALL return items in weight-descending order.

        **Validates: Requirements 10.4**
        """
        provider = DeterministicFallbackProvider()
        result = provider.plan(gaps)
        assert isinstance(result, str)
        assert len(result) > 0

        # Verify ordering: items should appear in weight-descending order
        sorted_gaps = sorted(gaps, key=lambda g: g["weight"], reverse=True)
        weights_in_order = [g["weight"] for g in sorted_gaps]

        # Check that the plan text mentions priorities in descending order
        # by verifying the positions of "Prioridad X%" markers
        positions = []
        for w in weights_in_order:
            pos = result.find(f"Prioridad {w}%")
            if pos != -1:
                positions.append(pos)

        # The positions list should be sorted (ascending) since we read top-to-bottom
        # and priorities are highest-first
        if len(positions) > 1:
            for i in range(len(positions) - 1):
                assert positions[i] <= positions[i + 1], (
                    f"Plan not ordered by weight desc: {weights_in_order}"
                )

    @given(message=st.text(min_size=0, max_size=200))
    @settings(max_examples=100)
    def test_generate_response_never_empty(self, message):
        """For any message, generate_response SHALL return non-empty string.

        **Validates: Requirements 10.2, 10.3, 10.4**
        """
        provider = DeterministicFallbackProvider()
        result = provider.generate_response(message)
        assert isinstance(result, str)
        assert len(result) > 0
