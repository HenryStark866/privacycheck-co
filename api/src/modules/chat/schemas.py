"""Pydantic schemas for the Chat module."""

from typing import Literal

from pydantic import BaseModel, Field


class SuggestedAction(BaseModel):
    """A suggested follow-up action for the user."""

    label: str
    action: str  # "answer", "next", "explain", "plan", "whatif"
    payload: dict | None = None


class ChatMessageRequest(BaseModel):
    """Request body for sending a chat message."""

    session_id: str | None = None
    channel: Literal["web", "whatsapp", "telegram", "api"] = "web"
    message: str = Field(..., min_length=1, max_length=2000)
    context: dict | None = None  # empresa_id, current_step, answers


class ChatMessageResponse(BaseModel):
    """Response body for a chat message."""

    reply: str
    type: str  # explanation, interpretation, plan, whatif, freeform
    session_id: str
    metadata: dict
    suggested_actions: list[SuggestedAction]
