"""Pydantic schemas for authentication responses."""

import uuid
from datetime import datetime

from pydantic import BaseModel


class UserResponse(BaseModel):
    """Response schema for user profile."""

    id: uuid.UUID
    email: str
    name: str
    provider: str
    provider_id: str
    avatar_url: str | None = None
    is_active: bool
    created_at: datetime

    model_config = {"from_attributes": True}
