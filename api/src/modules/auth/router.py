"""Auth router: user profile endpoint."""

from fastapi import APIRouter, Depends

from src.models import User
from src.modules.auth.dependencies import get_current_user
from src.modules.auth.schemas import UserResponse

router = APIRouter()


@router.get("/me", response_model=UserResponse)
async def get_me(
    current_user: User = Depends(get_current_user),
) -> UserResponse:
    """
    Returns the current user's profile.

    On first call, creates a local User record linked to the Supabase user.
    Subsequent calls return the existing record.
    Requires a valid Supabase JWT in the Authorization header.
    """
    return UserResponse.model_validate(current_user)
