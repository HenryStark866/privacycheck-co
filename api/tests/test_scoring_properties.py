"""Property-based tests for the diagnostic scoring engine.

Uses Hypothesis to validate universal properties of the scoring system.

**Validates: Requirements 4, 6**
"""

import pytest
from hypothesis import given, strategies as st, settings, assume

from src.modules.diagnostico.scoring import (
    BLOCKS,
    SCORED_QUESTIONS,
    WEIGHTS,
    compute_score,
    simulate_improvements,
    _classify_maturity,
    _is_applicable,
)


# --- Strategies ---

# Strategy that generates valid answer sets (dict mapping 1-11 to bool)
answers_strategy = st.fixed_dictionaries(
    {i: st.booleans() for i in range(1, 12)}
)

# Strategy for scored question subsets (non-empty)
improvements_strategy = st.lists(
    st.sampled_from(SCORED_QUESTIONS),
    min_size=1,
    max_size=len(SCORED_QUESTIONS),
    unique=True,
)


# --- Property 5: Score = sum of weights for applicable positive answers ---


class TestProperty5ScoreComputation:
    """**Validates: Requirements 4.1, 4.6**

    For any valid set of answers, the computed score SHALL equal the sum of
    WEIGHTS[q] for each q in {2..10} where answers[q] is True AND the question
    is applicable. Furthermore, score SHALL equal sum of all block earned values,
    and each block's max SHALL sum to 100.
    """

    @given(answers=answers_strategy)
    @settings(max_examples=100)
    def test_score_equals_sum_of_applicable_weights(self, answers: dict[int, bool]):
        """Score equals sum of weights for applicable True answers."""
        result = compute_score(answers)

        expected = sum(
            WEIGHTS[q]
            for q in SCORED_QUESTIONS
            if _is_applicable(q, answers) and answers.get(q, False) is True
        )
        assert result.score == expected

    @given(answers=answers_strategy)
    @settings(max_examples=100)
    def test_score_equals_sum_of_block_earned(self, answers: dict[int, bool]):
        """Score equals sum of all block earned values."""
        result = compute_score(answers)
        total_from_blocks = sum(b.earned for b in result.blocks.values())
        assert result.score == total_from_blocks

    @given(answers=answers_strategy)
    @settings(max_examples=100)
    def test_blocks_max_sum_to_100(self, answers: dict[int, bool]):
        """Block max values always sum to 100."""
        result = compute_score(answers)
        total_max = sum(b.max for b in result.blocks.values())
        assert total_max == 100


# --- Property 6: Q1=False makes Q2-Q5 irrelevant to score ---


class TestProperty6Q1GatesBlockA:
    """**Validates: Requirements 4.2, 4.3**

    For any set of answers where Q1 is False, the score SHALL be identical
    regardless of the values of Q2, Q3, Q4, and Q5.
    """

    @given(
        base_answers=answers_strategy,
        q2=st.booleans(),
        q3=st.booleans(),
        q4=st.booleans(),
        q5=st.booleans(),
    )
    @settings(max_examples=100)
    def test_q1_false_makes_q2_q5_irrelevant(
        self,
        base_answers: dict[int, bool],
        q2: bool,
        q3: bool,
        q4: bool,
        q5: bool,
    ):
        """When Q1=False, changing Q2-Q5 does not change the score."""
        # Force Q1=False
        answers_a = dict(base_answers)
        answers_a[1] = False

        answers_b = dict(answers_a)
        answers_b[2] = q2
        answers_b[3] = q3
        answers_b[4] = q4
        answers_b[5] = q5

        result_a = compute_score(answers_a)
        result_b = compute_score(answers_b)
        assert result_a.score == result_b.score


# --- Property 7: Q11 never affects score ---


class TestProperty7Q11NeverScores:
    """**Validates: Requirements 4.4**

    For any set of answers, toggling Q11 between True and False SHALL NOT
    change the computed score.
    """

    @given(answers=answers_strategy)
    @settings(max_examples=100)
    def test_q11_toggle_no_score_change(self, answers: dict[int, bool]):
        """Toggling Q11 never changes the score."""
        answers_true = dict(answers)
        answers_true[11] = True

        answers_false = dict(answers)
        answers_false[11] = False

        result_true = compute_score(answers_true)
        result_false = compute_score(answers_false)
        assert result_true.score == result_false.score


# --- Property 8: Maturity classification correctness ---


class TestProperty8MaturityClassification:
    """**Validates: Requirements 4.5**

    For any integer score in [0, 100], the maturity classification SHALL return
    the correct label based on descending threshold evaluation.
    """

    @given(score=st.integers(min_value=0, max_value=100))
    @settings(max_examples=100)
    def test_maturity_classification_correct(self, score: int):
        """Maturity label matches the descending threshold rules."""
        maturity = _classify_maturity(score)

        if score >= 95:
            assert maturity.label == "Líder"
        elif score >= 75:
            assert maturity.label == "Optimizado"
        elif score >= 50:
            assert maturity.label == "Gestionado"
        elif score >= 25:
            assert maturity.label == "Básico"
        else:
            assert maturity.label == "Inicial"

    @given(score=st.integers(min_value=0, max_value=100))
    @settings(max_examples=100)
    def test_exactly_one_label_assigned(self, score: int):
        """Exactly one maturity label is assigned for any score."""
        maturity = _classify_maturity(score)
        valid_labels = {"Líder", "Optimizado", "Gestionado", "Básico", "Inicial"}
        assert maturity.label in valid_labels


# --- Property 9: Gaps are applicable negatives sorted by weight desc ---


class TestProperty9GapsSorted:
    """**Validates: Requirements 4.7**

    For any set of answers, the gaps list SHALL contain exactly the scored
    questions answered negatively that are applicable, and SHALL be sorted
    by weight in descending order.
    """

    @given(answers=answers_strategy)
    @settings(max_examples=100)
    def test_gaps_are_applicable_negatives(self, answers: dict[int, bool]):
        """Gaps contain exactly the applicable negative scored questions."""
        result = compute_score(answers)
        gap_ids = {g.question_id for g in result.gaps}

        expected_gaps = {
            q for q in SCORED_QUESTIONS
            if _is_applicable(q, answers) and answers.get(q, False) is not True
        }
        assert gap_ids == expected_gaps

    @given(answers=answers_strategy)
    @settings(max_examples=100)
    def test_gaps_sorted_by_weight_desc(self, answers: dict[int, bool]):
        """Gaps are sorted by weight in descending order."""
        result = compute_score(answers)
        weights = [g.weight for g in result.gaps]
        assert weights == sorted(weights, reverse=True)


# --- Property 10: Q1=False + any Q2-Q5=True generates inconsistency note ---


class TestProperty10InconsistencyNote:
    """**Validates: Requirements 4.9**

    For any set of answers where Q1 is False AND at least one of Q2-Q5 is True,
    the notes list SHALL contain an inconsistency warning.
    """

    @given(answers=answers_strategy)
    @settings(max_examples=100)
    def test_inconsistency_detected(self, answers: dict[int, bool]):
        """Inconsistency note generated when Q1=False and any Q2-Q5=True."""
        answers = dict(answers)
        answers[1] = False
        has_positive_block_a = any(answers.get(q, False) for q in (2, 3, 4, 5))

        result = compute_score(answers)
        has_inconsistency_note = any("Inconsistencia" in n for n in result.notes)

        if has_positive_block_a:
            assert has_inconsistency_note
        else:
            assert not has_inconsistency_note


# --- Property 11: Score computation idempotence ---


class TestProperty11Idempotence:
    """**Validates: Requirements 4.10**

    For any valid set of answers, computing the score, extracting the answers,
    and recomputing SHALL produce an identical ScoreResult.
    """

    @given(answers=answers_strategy)
    @settings(max_examples=100)
    def test_score_computation_idempotent(self, answers: dict[int, bool]):
        """Computing score twice with same answers produces identical results."""
        result1 = compute_score(answers)
        result2 = compute_score(answers)

        assert result1.score == result2.score
        assert result1.maturity.label == result2.maturity.label
        assert result1.notes == result2.notes
        assert len(result1.gaps) == len(result2.gaps)
        for g1, g2 in zip(result1.gaps, result2.gaps):
            assert g1.question_id == g2.question_id
            assert g1.weight == g2.weight


# --- Property 12: simulate_improvements equivalence with compute_score ---


class TestProperty12SimulateEquivalence:
    """**Validates: Requirements 6.1, 6.2, 6.3, 6.4**

    For any valid set of current answers and any non-empty subset of scored
    questions (2-10) as improvements, simulate(answers, improvements) SHALL
    produce a ScoreResult identical to compute_score(answers_merged) where
    answers_merged sets all improvement questions to True.
    """

    @given(answers=answers_strategy, improvements=improvements_strategy)
    @settings(max_examples=100)
    def test_simulate_equals_compute_with_merged(
        self, answers: dict[int, bool], improvements: list[int]
    ):
        """Simulation result equals direct computation with merged answers."""
        projected, delta = simulate_improvements(answers, improvements)

        # Merge improvements into answers
        merged = dict(answers)
        for q_id in improvements:
            merged[q_id] = True

        expected = compute_score(merged)
        current = compute_score(answers)

        assert projected.score == expected.score
        assert projected.maturity.label == expected.maturity.label
        assert delta == expected.score - current.score

    @given(answers=answers_strategy, improvements=improvements_strategy)
    @settings(max_examples=100)
    def test_simulate_delta_non_negative(
        self, answers: dict[int, bool], improvements: list[int]
    ):
        """Simulation delta is always >= 0 (improvements can't lower score)."""
        _, delta = simulate_improvements(answers, improvements)
        assert delta >= 0
