"""Pure scoring engine for Law 1581 compliance diagnostic.

Implements the deterministic scoring logic as specified in Requirement 4.
All functions are pure (no side effects, no I/O).
"""

from dataclasses import dataclass

from src.modules.diagnostico.questions import QUESTIONS, get_question


# --- Constants ---

WEIGHTS: dict[int, int] = {
    2: 10, 3: 10, 4: 10, 5: 10,  # Block A
    6: 12, 7: 12, 8: 12,          # Block B
    9: 16, 10: 8,                  # Block C
}

BLOCKS: dict[str, dict] = {
    "A": {"name": "Política de datos personales", "questions": [2, 3, 4, 5], "max": 40},
    "B": {"name": "Privacidad desde el diseño", "questions": [6, 7, 8], "max": 36},
    "C": {"name": "Gobernanza", "questions": [9, 10], "max": 24},
}

MATURITY_THRESHOLDS: list[tuple[int, str, str, str]] = [
    (95, "Líder", "#15803d", "#dcfce7"),
    (75, "Optimizado", "#1d4ed8", "#dbeafe"),
    (50, "Gestionado", "#ca8a04", "#fef9c3"),
    (25, "Básico", "#ea580c", "#ffedd5"),
    (0, "Inicial", "#dc2626", "#fee2e2"),
]

SCORED_QUESTIONS: list[int] = [2, 3, 4, 5, 6, 7, 8, 9, 10]


# --- Dataclasses ---


@dataclass(frozen=True)
class BlockResult:
    name: str
    earned: int
    max: int


@dataclass(frozen=True)
class Gap:
    question_id: int
    weight: int
    text: str


@dataclass(frozen=True)
class MaturityLevel:
    label: str  # Líder | Optimizado | Gestionado | Básico | Inicial
    color: str
    bg_color: str


@dataclass(frozen=True)
class ScoreResult:
    score: int                          # 0-100
    maturity: MaturityLevel
    blocks: dict[str, BlockResult]      # A, B, C
    gaps: list[Gap]                     # sorted by weight desc
    notes: list[str]                    # consistency warnings


# --- Helper Functions ---


def _is_applicable(question_id: int, answers: dict[int, bool]) -> bool:
    """Determine if a question is applicable given the answers.

    Rules:
    - Q2-Q5 are only applicable if Q1=True
    - Q11 is only applicable if Q10=True
    - All other scored questions are always applicable
    """
    if question_id in (2, 3, 4, 5):
        return answers.get(1, False) is True
    if question_id == 11:
        return answers.get(10, False) is True
    return True


def _classify_maturity(score: int) -> MaturityLevel:
    """Classify score into maturity level using descending precedence."""
    for threshold, label, color, bg_color in MATURITY_THRESHOLDS:
        if score >= threshold:
            return MaturityLevel(label=label, color=color, bg_color=bg_color)
    # Should never reach here since threshold 0 catches all
    return MaturityLevel(label="Inicial", color="#dc2626", bg_color="#fee2e2")


def _compute_block_results(answers: dict[int, bool]) -> dict[str, BlockResult]:
    """Compute earned points per block."""
    blocks: dict[str, BlockResult] = {}
    for block_key, block_def in BLOCKS.items():
        earned = 0
        for q_id in block_def["questions"]:
            if _is_applicable(q_id, answers) and answers.get(q_id, False) is True:
                earned += WEIGHTS[q_id]
        blocks[block_key] = BlockResult(
            name=block_def["name"],
            earned=earned,
            max=block_def["max"],
        )
    return blocks


def _identify_gaps(answers: dict[int, bool]) -> list[Gap]:
    """Identify scored questions answered negatively that are applicable.

    Returns gaps sorted by weight in descending order.
    """
    gaps: list[Gap] = []
    for q_id in SCORED_QUESTIONS:
        if _is_applicable(q_id, answers) and answers.get(q_id, False) is not True:
            question = get_question(q_id)
            text = question["text"] if question else ""
            gaps.append(Gap(question_id=q_id, weight=WEIGHTS[q_id], text=text))
    # Sort by weight descending
    gaps.sort(key=lambda g: g.weight, reverse=True)
    return gaps


def _generate_notes(answers: dict[int, bool]) -> list[str]:
    """Generate consistency/inconsistency notes based on answer patterns."""
    notes: list[str] = []

    # Inconsistency: Q1=False but any Q2-Q5=True
    if answers.get(1, False) is not True:
        has_positive_block_a = any(
            answers.get(q_id, False) is True for q_id in (2, 3, 4, 5)
        )
        if has_positive_block_a:
            notes.append(
                "Inconsistencia: Se reportan elementos de política de datos (Q2-Q5) "
                "sin contar con una política adoptada (Q1=No). Verifique la coherencia "
                "de las respuestas."
            )

    # Consistency note: Q10=True but Q11=False
    if answers.get(10, False) is True and answers.get(11, False) is not True:
        notes.append(
            "Nota: Se ha designado un Oficial de Protección de Datos (Q10=Sí) "
            "pero no cuenta con designación formal documentada ni recursos asignados "
            "(Q11=No). Se recomienda formalizar la designación."
        )

    return notes


# --- Main Functions ---


def compute_score(answers: dict[int, bool]) -> ScoreResult:
    """Compute compliance score from diagnostic answers.

    Pure function. No side effects.

    Args:
        answers: Mapping of question_id (1-11) to boolean answer.

    Returns:
        Complete ScoreResult with score, maturity, blocks, gaps, notes.

    Rules:
        - Only Q2-Q10 contribute points (Q1 and Q11 never score)
        - If Q1=False, Q2-Q5 are treated as N/A (zero points)
        - If Q10=False, Q11 is treated as N/A
        - Weights: Q2=10, Q3=10, Q4=10, Q5=10, Q6=12, Q7=12, Q8=12, Q9=16, Q10=8
    """
    # Calculate total score
    score = 0
    for q_id in SCORED_QUESTIONS:
        if _is_applicable(q_id, answers) and answers.get(q_id, False) is True:
            score += WEIGHTS[q_id]

    # Classify maturity
    maturity = _classify_maturity(score)

    # Compute block results
    blocks = _compute_block_results(answers)

    # Identify gaps
    gaps = _identify_gaps(answers)

    # Generate notes
    notes = _generate_notes(answers)

    return ScoreResult(
        score=score,
        maturity=maturity,
        blocks=blocks,
        gaps=gaps,
        notes=notes,
    )


def simulate_improvements(
    current_answers: dict[int, bool],
    improvements: list[int],
) -> tuple[ScoreResult, int]:
    """Compute projected score if improvements are applied.

    Args:
        current_answers: Current set of answers.
        improvements: List of question IDs to toggle to True.

    Returns:
        Tuple of (projected ScoreResult, delta from current score).
    """
    current_result = compute_score(current_answers)

    # Create projected answers with improvements set to True
    projected_answers = dict(current_answers)
    for q_id in improvements:
        projected_answers[q_id] = True

    projected_result = compute_score(projected_answers)
    delta = projected_result.score - current_result.score

    return projected_result, delta
