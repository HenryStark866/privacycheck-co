"""Pydantic schemas for empresa (company) management."""

import uuid
from datetime import datetime

from pydantic import BaseModel, Field, field_validator

from src.modules.empresas.validators import validate_nit_format


class EmpresaCreate(BaseModel):
    """Request schema for creating a new empresa."""

    nombre: str = Field(..., min_length=1, max_length=255, description="Company name")
    nit: str = Field(..., min_length=9, max_length=13, description="Colombian NIT")
    sector: str | None = Field(None, max_length=100, description="Business sector")
    tamano: str | None = Field(None, max_length=50, description="Company size")

    @field_validator("nit")
    @classmethod
    def nit_must_be_valid(cls, v: str) -> str:
        """Validate NIT format matches Colombian standard."""
        if not validate_nit_format(v):
            raise ValueError(
                "NIT must be 9-10 digits optionally followed by a hyphen and one verification digit"
            )
        return v


class EmpresaUpdate(BaseModel):
    """Request schema for updating an empresa. NIT is immutable."""

    nombre: str | None = Field(None, min_length=1, max_length=255)
    sector: str | None = Field(None, max_length=100)
    tamano: str | None = Field(None, max_length=50)


class EmpresaResponse(BaseModel):
    """Response schema for an empresa."""

    id: uuid.UUID
    nombre: str
    nit: str
    sector: str | None = None
    tamano: str | None = None
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}


class MemberAssign(BaseModel):
    """Request schema for assigning a user to an empresa with a role."""

    user_id: uuid.UUID = Field(..., description="User ID to assign")
    rol: str = Field(..., description="Role to assign (admin, evaluador, auditor)")

    @field_validator("rol")
    @classmethod
    def rol_must_be_valid(cls, v: str) -> str:
        """Validate that role is one of the allowed values."""
        allowed = {"admin", "evaluador", "auditor"}
        if v not in allowed:
            raise ValueError(f"Role must be one of: {', '.join(sorted(allowed))}")
        return v


class MemberResponse(BaseModel):
    """Response schema for an empresa membership."""

    id: uuid.UUID
    user_id: uuid.UUID
    empresa_id: uuid.UUID
    rol: str

    model_config = {"from_attributes": True}


class PaginatedEmpresaResponse(BaseModel):
    """Paginated response for empresa listings."""

    items: list[EmpresaResponse]
    pagination: dict
