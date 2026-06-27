"""Unit tests for the diagnostic scoring engine.

Covers:
- All-True scenario (maximum score)
- All-False scenario (minimum score)
- Boundary scores for maturity classification
- Q1 gates Q2-Q5 (conditional gating)
- Q10 gates Q11
- Q11 never scores
- Gap identification and ordering
- Consistency/inconsistency notes
- simulate_improvements function
"""

import pytest

from src.modules.diagnostico.scoring import (
    BLOCKS,
    MATURITY_THRESHOLDS,
    SCORED_QUESTIONS,
    WEIGHTS,
    BlockResult,
    Gap,
    MaturityLevel,
    ScoreResult,
    compute_score,
    simulate_improvements,
    _classify_maturity,
    _is_applicable,
)
from src.modules.diagnostico.questions import QUESTIONS, get_question


# --- Helpers ---


def all_true_answers() -> dict[int, bool]:
    """All 11 questions answered True."""
    return {i: True for i in range(1, 12)}


def all_false_answers() -> dict[int, bool]:
    """All 11 questions answered False."""
    return {i: False for i in range(1, 12)}


# --- Test: All-True Scenario ---


class TestAllTrue:
    """When all questions are answered True, score should be maximum (100)."""

    def test_score_is_100(self):
        result = compute_score(all_true_answers())
        assert result.score == 100

    def test_maturity_is_lider(self):
        result = compute_score(all_true_answers())
        assert result.maturity.label == "Líder"

    def test_no_gaps(self):
        result = compute_score(all_true_answers())
        assert result.gaps == []

    def test_block_a_full(self):
        result = compute_score(all_true_answers())
        assert result.blocks["A"].earned == 40
        assert result.blocks["A"].max == 40

    def test_block_b_full(self):
        result = compute_score(all_true_answers())
        assert result.blocks["B"].earned == 36
        assert result.blocks["B"].max == 36

    def test_block_c_full(self):
        result = compute_score(all_true_answers())
        assert result.blocks["C"].earned == 24
        assert result.blocks["C"].max == 24

    def test_no_notes_when_all_true(self):
        result = compute_score(all_true_answers())
        assert result.notes == []


# --- Test: All-False Scenario ---


class TestAllFalse:
    """When all questions are answered False, score should be minimum."""

    def test_score_is_zero_blocked(self):
        """Q1=False gates Q2-Q5, only Q6-Q10 are applicable but all False → scored at 0."""
        result = compute_score(all_false_answers())
        # Q2-Q5 gated by Q1=False → N/A
        # Q6, Q7, Q8, Q9, Q10 all False → 0 points each
        assert result.score == 0

    def test_maturity_is_inicial(self):
        result = compute_score(all_false_answers())
        assert result.maturity.label == "Inicial"

    def test_gaps_are_applicable_negatives(self):
        """Gaps should only include applicable questions answered negatively."""
        result = compute_score(all_false_answers())
        # Q1=False means Q2-Q5 are N/A, not gaps
        # Only Q6, Q7, Q8, Q9, Q10 are applicable and negative
        gap_ids = [g.question_id for g in result.gaps]
        assert 2 not in gap_ids
        assert 3 not in gap_ids
        assert 4 not in gap_ids
        assert 5 not in gap_ids
        assert set(gap_ids) == {6, 7, 8, 9, 10}

    def test_block_a_zero_when_gated(self):
        result = compute_score(all_false_answers())
        assert result.blocks["A"].earned == 0

    def test_block_b_zero(self):
        result = compute_score(all_false_answers())
        assert result.blocks["B"].earned == 0

    def test_block_c_zero(self):
        result = compute_score(all_false_answers())
        assert result.blocks["C"].earned == 0

    def test_no_inconsistency_note_when_q2_q5_all_false(self):
        """No inconsistency when Q1=False and Q2-Q5 are also False."""
        result = compute_score(all_false_answers())
        assert not any("Inconsistencia" in note for note in result.notes)


# --- Test: Q1 Gating Logic ---


class TestQ1Gating:
    """Q1=False should make Q2-Q5 not applicable (zero points)."""

    def test_q1_false_gates_block_a(self):
        """Even if Q2-Q5 are True, they contribute 0 when Q1=False."""
        answers = all_false_answers()
        answers[2] = True
        answers[3] = True
        answers[4] = True
        answers[5] = True
        # Q6-Q10 still False
        result = compute_score(answers)
        assert result.blocks["A"].earned == 0

    def test_q1_true_enables_block_a(self):
        """Q1=True makes Q2-Q5 applicable."""
        answers = all_false_answers()
        answers[1] = True
        answers[2] = True
        answers[3] = True
        answers[4] = True
        answers[5] = True
        result = compute_score(answers)
        assert result.blocks["A"].earned == 40

    def test_q1_false_score_independent_of_q2_q5(self):
        """Score should be the same regardless of Q2-Q5 values when Q1=False."""
        answers_base = all_false_answers()
        answers_with_block_a = dict(answers_base)
        answers_with_block_a[2] = True
        answers_with_block_a[3] = True
        answers_with_block_a[4] = True
        answers_with_block_a[5] = True

        result_base = compute_score(answers_base)
        result_with = compute_score(answers_with_block_a)
        assert result_base.score == result_with.score

    def test_q1_false_q2_true_generates_inconsistency(self):
        """Q1=False + any Q2-Q5=True → inconsistency note."""
        answers = all_false_answers()
        answers[2] = True
        result = compute_score(answers)
        assert any("Inconsistencia" in note for note in result.notes)

    def test_q1_false_q2_q5_not_in_gaps(self):
        """Non-applicable questions should not appear in gaps."""
        answers = all_false_answers()
        result = compute_score(answers)
        gap_ids = [g.question_id for g in result.gaps]
        for q_id in (2, 3, 4, 5):
            assert q_id not in gap_ids


# --- Test: Q10 Gates Q11 ---


class TestQ10GatesQ11:
    """Q10=False should make Q11 not applicable."""

    def test_q10_true_q11_false_consistency_note(self):
        """Q10=True and Q11=False should generate a consistency note."""
        answers = all_true_answers()
        answers[11] = False
        result = compute_score(answers)
        assert any("Oficial de Protección" in note for note in result.notes)

    def test_q10_false_q11_irrelevant(self):
        """Q10=False means Q11 doesn't matter - no consistency note for it."""
        answers = all_false_answers()
        answers[1] = True  # Enable block A
        answers[11] = True  # Q11=True but Q10=False
        result = compute_score(answers)
        # Should NOT produce a consistency note about Q11
        assert not any("Oficial de Protección" in note for note in result.notes)


# --- Test: Q11 Never Scores ---


class TestQ11NeverScores:
    """Q11 should never contribute to the total score."""

    def test_q11_toggle_no_score_change(self):
        """Toggling Q11 should not change the score."""
        answers_true = all_true_answers()
        answers_false = dict(answers_true)
        answers_false[11] = False

        result_true = compute_score(answers_true)
        result_false = compute_score(answers_false)
        assert result_true.score == result_false.score

    def test_q11_weight_is_zero(self):
        """Q11 should have zero weight in the WEIGHTS dict (not present)."""
        assert 11 not in WEIGHTS

    def test_q11_not_in_scored_questions(self):
        """Q11 should not be in the scored questions list."""
        assert 11 not in SCORED_QUESTIONS


# --- Test: Boundary Scores for Maturity ---


class TestMaturityBoundaries:
    """Test maturity classification at exact boundary values."""

    def test_score_95_is_lider(self):
        assert _classify_maturity(95).label == "Líder"

    def test_score_100_is_lider(self):
        assert _classify_maturity(100).label == "Líder"

    def test_score_94_is_optimizado(self):
        assert _classify_maturity(94).label == "Optimizado"

    def test_score_75_is_optimizado(self):
        assert _classify_maturity(75).label == "Optimizado"

    def test_score_74_is_gestionado(self):
        assert _classify_maturity(74).label == "Gestionado"

    def test_score_50_is_gestionado(self):
        assert _classify_maturity(50).label == "Gestionado"

    def test_score_49_is_basico(self):
        assert _classify_maturity(49).label == "Básico"

    def test_score_25_is_basico(self):
        assert _classify_maturity(25).label == "Básico"

    def test_score_24_is_inicial(self):
        assert _classify_maturity(24).label == "Inicial"

    def test_score_0_is_inicial(self):
        assert _classify_maturity(0).label == "Inicial"


# --- Test: Gaps Identification ---


class TestGaps:
    """Test gap identification and sorting."""

    def test_gaps_sorted_by_weight_desc(self):
        """Gaps should be sorted by weight in descending order."""
        answers = all_false_answers()
        answers[1] = True  # Enable block A
        result = compute_score(answers)
        weights = [g.weight for g in result.gaps]
        assert weights == sorted(weights, reverse=True)

    def test_gaps_include_all_applicable_negatives(self):
        """When Q1=True and all Q2-Q10=False, all scored questions are gaps."""
        answers = all_false_answers()
        answers[1] = True
        result = compute_score(answers)
        gap_ids = {g.question_id for g in result.gaps}
        assert gap_ids == set(SCORED_QUESTIONS)

    def test_gaps_exclude_positive_answers(self):
        """Questions answered True should not appear in gaps."""
        answers = all_true_answers()
        answers[9] = False  # Only Q9 is negative
        result = compute_score(answers)
        gap_ids = [g.question_id for g in result.gaps]
        assert gap_ids == [9]

    def test_gap_text_is_not_empty(self):
        """Each gap should have non-empty text."""
        answers = all_false_answers()
        answers[1] = True
        result = compute_score(answers)
        for gap in result.gaps:
            assert gap.text != ""

    def test_q9_highest_weight_gap(self):
        """Q9 has weight 16 so should be first when present."""
        answers = all_false_answers()
        answers[1] = True
        result = compute_score(answers)
        assert result.gaps[0].question_id == 9
        assert result.gaps[0].weight == 16


# --- Test: Score Computation Correctness ---


class TestScoreComputation:
    """Test specific score calculations."""

    def test_only_block_b_true(self):
        """Q6, Q7, Q8 = True → score = 36."""
        answers = all_false_answers()
        answers[6] = True
        answers[7] = True
        answers[8] = True
        result = compute_score(answers)
        assert result.score == 36

    def test_only_q9_true(self):
        """Q9=True → score = 16."""
        answers = all_false_answers()
        answers[9] = True
        result = compute_score(answers)
        assert result.score == 16

    def test_score_equals_sum_of_block_earned(self):
        """Score should equal sum of all block earned values."""
        answers = {1: True, 2: True, 3: False, 4: True, 5: False,
                   6: True, 7: False, 8: True, 9: True, 10: True, 11: False}
        result = compute_score(answers)
        total_from_blocks = sum(b.earned for b in result.blocks.values())
        assert result.score == total_from_blocks

    def test_blocks_max_sum_to_100(self):
        """The sum of all block max values should be 100."""
        answers = all_true_answers()
        result = compute_score(answers)
        total_max = sum(b.max for b in result.blocks.values())
        assert total_max == 100

    def test_partial_block_a(self):
        """Q1=True, Q2=True, Q3=False → Block A earned = 10."""
        answers = all_false_answers()
        answers[1] = True
        answers[2] = True
        result = compute_score(answers)
        assert result.blocks["A"].earned == 10


# --- Test: simulate_improvements ---


class TestSimulateImprovements:
    """Test the what-if simulator."""

    def test_simulate_all_improvements(self):
        """Simulating all scored questions as True from all-False baseline."""
        answers = all_false_answers()
        answers[1] = True  # Enable block A
        improvements = SCORED_QUESTIONS[:]
        projected, delta = simulate_improvements(answers, improvements)
        assert projected.score == 100
        assert delta == 100

    def test_simulate_single_improvement(self):
        """Simulating a single improvement."""
        answers = all_false_answers()
        answers[1] = True
        improvements = [9]  # Q9 has weight 16
        projected, delta = simulate_improvements(answers, improvements)
        assert projected.score == 16
        assert delta == 16

    def test_simulate_no_change_when_already_true(self):
        """Simulating an improvement on a question already answered True."""
        answers = all_true_answers()
        improvements = [9]
        projected, delta = simulate_improvements(answers, improvements)
        assert delta == 0
        assert projected.score == 100

    def test_simulate_delta_is_difference(self):
        """Delta should equal projected - current."""
        answers = all_false_answers()
        answers[1] = True
        answers[6] = True  # Already has 12 points
        improvements = [7]  # Add 12 more
        projected, delta = simulate_improvements(answers, improvements)
        current = compute_score(answers)
        assert delta == projected.score - current.score
        assert delta == 12

    def test_simulate_maturity_change(self):
        """Simulation can change maturity level."""
        answers = all_false_answers()
        answers[1] = True
        answers[6] = True
        answers[7] = True
        # Current score = 24 → Inicial
        current = compute_score(answers)
        assert current.maturity.label == "Inicial"

        # Improve Q8 → +12 = 36 → Básico
        projected, delta = simulate_improvements(answers, [8])
        assert projected.maturity.label == "Básico"

    def test_simulate_equivalence_with_compute(self):
        """simulate should produce same result as compute with merged answers."""
        answers = {1: True, 2: False, 3: True, 4: False, 5: False,
                   6: True, 7: False, 8: False, 9: True, 10: False, 11: False}
        improvements = [2, 7, 10]

        projected, _ = simulate_improvements(answers, improvements)

        merged = dict(answers)
        for q_id in improvements:
            merged[q_id] = True
        expected = compute_score(merged)

        assert projected.score == expected.score
        assert projected.maturity.label == expected.maturity.label


# --- Test: Notes Generation ---


class TestNotes:
    """Test consistency and inconsistency note generation."""

    def test_inconsistency_q1_false_q2_true(self):
        answers = all_false_answers()
        answers[2] = True
        result = compute_score(answers)
        assert any("Inconsistencia" in n for n in result.notes)

    def test_inconsistency_q1_false_q5_true(self):
        answers = all_false_answers()
        answers[5] = True
        result = compute_score(answers)
        assert any("Inconsistencia" in n for n in result.notes)

    def test_no_inconsistency_q1_true(self):
        """No inconsistency note when Q1=True."""
        answers = all_true_answers()
        result = compute_score(answers)
        assert not any("Inconsistencia" in n for n in result.notes)

    def test_consistency_q10_true_q11_false(self):
        answers = all_true_answers()
        answers[11] = False
        result = compute_score(answers)
        assert any("designación formal" in n for n in result.notes)

    def test_no_consistency_note_q10_true_q11_true(self):
        answers = all_true_answers()
        result = compute_score(answers)
        assert not any("designación formal" in n for n in result.notes)

    def test_no_consistency_note_q10_false(self):
        """When Q10=False, no note about Q11 regardless of Q11 value."""
        answers = all_false_answers()
        answers[11] = False
        result = compute_score(answers)
        assert not any("designación formal" in n for n in result.notes)


# --- Test: Questions Data Integrity ---


class TestQuestionsData:
    """Validate the questions data is well-formed."""

    def test_11_questions_exist(self):
        assert len(QUESTIONS) == 11

    def test_question_ids_sequential(self):
        ids = [q["id"] for q in QUESTIONS]
        assert ids == list(range(1, 12))

    def test_all_questions_have_required_fields(self):
        required_fields = {"id", "block", "text", "weight", "role", "explain", "guide"}
        for q in QUESTIONS:
            assert required_fields.issubset(set(q.keys()))

    def test_weights_match_scoring_constants(self):
        """Question weights should match the WEIGHTS constant."""
        for q in QUESTIONS:
            if q["id"] in WEIGHTS:
                assert q["weight"] == WEIGHTS[q["id"]]
            else:
                assert q["weight"] == 0

    def test_get_question_returns_correct(self):
        q = get_question(1)
        assert q is not None
        assert q["id"] == 1

    def test_get_question_invalid_returns_none(self):
        assert get_question(99) is None


# --- Test: _is_applicable helper ---


class TestIsApplicable:
    """Test the applicability logic."""

    def test_q2_applicable_when_q1_true(self):
        assert _is_applicable(2, {1: True}) is True

    def test_q2_not_applicable_when_q1_false(self):
        assert _is_applicable(2, {1: False}) is False

    def test_q5_not_applicable_when_q1_missing(self):
        """Missing Q1 defaults to False."""
        assert _is_applicable(5, {}) is False

    def test_q11_applicable_when_q10_true(self):
        assert _is_applicable(11, {10: True}) is True

    def test_q11_not_applicable_when_q10_false(self):
        assert _is_applicable(11, {10: False}) is False

    def test_q6_always_applicable(self):
        assert _is_applicable(6, {}) is True
        assert _is_applicable(6, {1: False}) is True

    def test_q9_always_applicable(self):
        assert _is_applicable(9, {1: False, 10: False}) is True
