"""Pydantic schemas for the diagnostic scoring module."""

from pydantic import BaseModel, Field, field_validator

from src.modules.diagnostico.scoring import SCORED_QUESTIONS


class ScoreRequest(BaseModel):
    """Request body for computing a diagnostic score."""

    answers: dict[int, bool] = Field(
        ...,
        description="Mapping of question_id (1-11) to boolean answer",
    )

    @field_validator("answers")
    @classmethod
    def validate_answers(cls, v: dict[int, bool]) -> dict[int, bool]:
        """Validate that answer keys are in valid range (1-11)."""
        for key in v:
            if key < 1 or key > 11:
                raise ValueError(f"Question ID {key} is out of range (1-11)")
        return v


class SimulateRequest(BaseModel):
    """Request body for what-if simulation."""

    current_answers: dict[int, bool] = Field(
        ...,
        description="Current set of answers",
    )
    improvements: list[int] = Field(
        ...,
        min_length=1,
        description="List of question IDs to simulate as True",
    )

    @field_validator("current_answers")
    @classmethod
    def validate_current_answers(cls, v: dict[int, bool]) -> dict[int, bool]:
        """Validate that answer keys are in valid range (1-11)."""
        for key in v:
            if key < 1 or key > 11:
                raise ValueError(f"Question ID {key} is out of range (1-11)")
        return v

    @field_validator("improvements")
    @classmethod
    def validate_improvements(cls, v: list[int]) -> list[int]:
        """Only scored questions (2-10) can be improved."""
        for q_id in v:
            if q_id not in SCORED_QUESTIONS:
                raise ValueError(
                    f"Question {q_id} is not a scored question. "
                    f"Only questions {SCORED_QUESTIONS} can be improved."
                )
        return v


class BlockResultResponse(BaseModel):
    """Block-level scoring result."""

    name: str
    earned: int
    max: int


class GapResponse(BaseModel):
    """A compliance gap identified in the evaluation."""

    question_id: int
    weight: int
    text: str


class MaturityLevelResponse(BaseModel):
    """Maturity level classification."""

    label: str
    color: str
    bg_color: str


class ScoreResultResponse(BaseModel):
    """Complete scoring result response."""

    score: int = Field(..., ge=0, le=100)
    maturity: MaturityLevelResponse
    blocks: dict[str, BlockResultResponse]
    gaps: list[GapResponse]
    notes: list[str]


class SimulateResultResponse(BaseModel):
    """What-if simulation result response."""

    projected: ScoreResultResponse
    delta: int
