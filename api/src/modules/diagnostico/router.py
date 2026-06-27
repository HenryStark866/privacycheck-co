"""Router for diagnostic scoring endpoints."""

from fastapi import APIRouter

from src.modules.diagnostico.schemas import (
    ScoreRequest,
    ScoreResultResponse,
    SimulateRequest,
    SimulateResultResponse,
    BlockResultResponse,
    GapResponse,
    MaturityLevelResponse,
)
from src.modules.diagnostico.scoring import compute_score, simulate_improvements

router = APIRouter()


def _score_result_to_response(result) -> ScoreResultResponse:
    """Convert a ScoreResult dataclass to a Pydantic response model."""
    return ScoreResultResponse(
        score=result.score,
        maturity=MaturityLevelResponse(
            label=result.maturity.label,
            color=result.maturity.color,
            bg_color=result.maturity.bg_color,
        ),
        blocks={
            key: BlockResultResponse(
                name=block.name,
                earned=block.earned,
                max=block.max,
            )
            for key, block in result.blocks.items()
        },
        gaps=[
            GapResponse(
                question_id=gap.question_id,
                weight=gap.weight,
                text=gap.text,
            )
            for gap in result.gaps
        ],
        notes=result.notes,
    )


@router.post("/score", response_model=ScoreResultResponse)
async def score_diagnostic(request: ScoreRequest) -> ScoreResultResponse:
    """Compute compliance score from diagnostic answers without persisting.

    Accepts a set of boolean answers for questions 1-11 and returns
    the complete scoring result including maturity level, block breakdown,
    gaps, and consistency notes.
    """
    result = compute_score(request.answers)
    return _score_result_to_response(result)


@router.post("/simulate", response_model=SimulateResultResponse)
async def simulate_diagnostic(request: SimulateRequest) -> SimulateResultResponse:
    """What-if simulation: compute projected score with improvements.

    Accepts current answers and a list of question IDs to toggle as True,
    then returns the projected score and the delta from current.
    """
    projected_result, delta = simulate_improvements(
        request.current_answers, request.improvements
    )
    return SimulateResultResponse(
        projected=_score_result_to_response(projected_result),
        delta=delta,
    )
