"""Pydantic schemas for evaluaciones (evaluation) module."""

import uuid
from datetime import datetime

from pydantic import BaseModel, Field, field_validator


# Required questions that must always be present
ALWAYS_REQUIRED = {1, 6, 7, 8, 9, 10}
# Questions required only when Q1 is True
CONDITIONAL_BLOCK_A = {2, 3, 4, 5}


class EvaluacionCreate(BaseModel):
    """Request schema for submitting an evaluation."""

    empresa_id: uuid.UUID = Field(..., description="Company ID to evaluate")
    answers: dict[int, bool] = Field(
        ...,
        description="Mapping of question_id (1-11) to boolean answer",
    )

    @field_validator("answers")
    @classmethod
    def validate_answers(cls, v: dict[int, bool]) -> dict[int, bool]:
        """
        Validate answer completeness based on conditional logic:
        - Always require Q1, Q6, Q7, Q8, Q9, Q10
        - If Q1=True, additionally require Q2, Q3, Q4, Q5
        - Q11 accepted only if Q10=True; reject if Q10=False and Q11 is present
        """
        # Validate keys are in range 1-11
        for key in v:
            if key < 1 or key > 11:
                raise ValueError(f"Question ID {key} is out of range (1-11)")

        # Check always-required questions
        missing = ALWAYS_REQUIRED - set(v.keys())
        if missing:
            raise ValueError(
                f"Missing required answers for questions: {sorted(missing)}"
            )

        # If Q1=True, require Q2-Q5
        if v.get(1) is True:
            missing_block_a = CONDITIONAL_BLOCK_A - set(v.keys())
            if missing_block_a:
                raise ValueError(
                    f"When Q1 is True, answers for questions {sorted(missing_block_a)} are required"
                )

        # Q11 accepted only if Q10=True
        if 11 in v and v.get(10) is not True:
            raise ValueError(
                "Q11 can only be provided when Q10 is True"
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


class EvaluacionResponse(BaseModel):
    """Full evaluation response including score details."""

    id: uuid.UUID
    empresa_id: uuid.UUID
    user_id: uuid.UUID | None = None
    answers: dict[int, bool] | None = None
    score: int | None = None
    maturity: str | None = None
    blocks: dict | None = None
    gaps: list | None = None
    notes: list | None = None
    created_at: datetime

    model_config = {"from_attributes": True}


class EvaluacionListItem(BaseModel):
    """Summarized evaluation for list responses."""

    id: uuid.UUID
    empresa_id: uuid.UUID
    user_id: uuid.UUID | None = None
    score: int | None = None
    maturity: str | None = None
    created_at: datetime

    model_config = {"from_attributes": True}


class PaginatedEvaluacionResponse(BaseModel):
    """Paginated response for evaluation listings."""

    items: list[EvaluacionListItem]
    pagination: dict
