"""SQLAlchemy ORM models for Habeas Check API."""

import enum
import uuid
from datetime import datetime

from sqlalchemy import (
    Boolean,
    DateTime,
    Enum,
    ForeignKey,
    Index,
    Integer,
    String,
    Text,
    UniqueConstraint,
)
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship
from sqlalchemy.types import JSON

from src.database import Base


class RolEnum(str, enum.Enum):
    """Roles available for empresa membership."""

    admin = "admin"
    evaluador = "evaluador"
    auditor = "auditor"


class ProviderEnum(str, enum.Enum):
    """OAuth provider options."""

    google = "google"
    microsoft = "microsoft"


class User(Base):
    """Application user linked to Supabase auth."""

    __tablename__ = "users"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    email: Mapped[str] = mapped_column(String(255), unique=True, nullable=False)
    name: Mapped[str] = mapped_column(String(255), nullable=False)
    provider: Mapped[ProviderEnum] = mapped_column(
        Enum(ProviderEnum, name="provider_enum"), nullable=False
    )
    provider_id: Mapped[str] = mapped_column(String(255), nullable=False)
    avatar_url: Mapped[str | None] = mapped_column(String(512), nullable=True)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)
    created_at: Mapped[datetime] = mapped_column(
        DateTime, default=datetime.utcnow, nullable=False
    )

    # Relationships
    memberships: Mapped[list["EmpresaUser"]] = relationship(
        back_populates="user", cascade="all, delete-orphan"
    )
    evaluaciones: Mapped[list["Evaluacion"]] = relationship(back_populates="user")
    chat_sessions: Mapped[list["ChatSession"]] = relationship(back_populates="user")


class Empresa(Base):
    """Company registered for compliance evaluation."""

    __tablename__ = "empresas"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    nombre: Mapped[str] = mapped_column(String(255), nullable=False)
    nit: Mapped[str] = mapped_column(String(20), unique=True, nullable=False)
    sector: Mapped[str | None] = mapped_column(String(100), nullable=True)
    tamano: Mapped[str | None] = mapped_column(String(50), nullable=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime, default=datetime.utcnow, nullable=False
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime, default=datetime.utcnow, onupdate=datetime.utcnow, nullable=False
    )

    # Relationships
    members: Mapped[list["EmpresaUser"]] = relationship(
        back_populates="empresa", cascade="all, delete-orphan"
    )
    evaluaciones: Mapped[list["Evaluacion"]] = relationship(back_populates="empresa")
    chat_sessions: Mapped[list["ChatSession"]] = relationship(back_populates="empresa")


class EmpresaUser(Base):
    """Membership linking users to empresas with a specific role."""

    __tablename__ = "empresa_users"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    user_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), nullable=False
    )
    empresa_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("empresas.id", ondelete="CASCADE"),
        nullable=False,
    )
    rol: Mapped[RolEnum] = mapped_column(
        Enum(RolEnum, name="rol_enum"), nullable=False
    )

    # Unique constraint: one membership per user per empresa
    __table_args__ = (
        UniqueConstraint("user_id", "empresa_id", name="uq_empresa_user"),
    )

    # Relationships
    user: Mapped["User"] = relationship(back_populates="memberships")
    empresa: Mapped["Empresa"] = relationship(back_populates="members")


class Evaluacion(Base):
    """Compliance evaluation record with computed scores."""

    __tablename__ = "evaluaciones"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    empresa_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("empresas.id", ondelete="CASCADE"),
        nullable=False,
    )
    user_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("users.id", ondelete="SET NULL"), nullable=True
    )
    answers: Mapped[dict | None] = mapped_column(JSON, nullable=True)
    score: Mapped[int | None] = mapped_column(Integer, nullable=True)
    maturity: Mapped[str | None] = mapped_column(String(50), nullable=True)
    blocks: Mapped[dict | None] = mapped_column(JSON, nullable=True)
    gaps: Mapped[list | None] = mapped_column(JSON, nullable=True)
    notes: Mapped[list | None] = mapped_column(JSON, nullable=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime, default=datetime.utcnow, nullable=False
    )

    __table_args__ = (
        Index("ix_evaluaciones_empresa_created", "empresa_id", "created_at"),
    )

    # Relationships
    empresa: Mapped["Empresa"] = relationship(back_populates="evaluaciones")
    user: Mapped["User | None"] = relationship(back_populates="evaluaciones")
    chat_sessions: Mapped[list["ChatSession"]] = relationship(
        back_populates="evaluacion"
    )


class ChatSession(Base):
    """Chat conversation session."""

    __tablename__ = "chat_sessions"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    user_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), nullable=False
    )
    empresa_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), ForeignKey("empresas.id", ondelete="SET NULL"), nullable=True
    )
    evaluacion_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("evaluaciones.id", ondelete="SET NULL"),
        nullable=True,
    )
    channel: Mapped[str | None] = mapped_column(String(50), nullable=True)
    context: Mapped[dict | None] = mapped_column(JSON, nullable=True)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)
    created_at: Mapped[datetime] = mapped_column(
        DateTime, default=datetime.utcnow, nullable=False
    )

    # Relationships
    user: Mapped["User"] = relationship(back_populates="chat_sessions")
    empresa: Mapped["Empresa | None"] = relationship(back_populates="chat_sessions")
    evaluacion: Mapped["Evaluacion | None"] = relationship(
        back_populates="chat_sessions"
    )
    messages: Mapped[list["ChatMessage"]] = relationship(
        back_populates="session", cascade="all, delete-orphan"
    )


class ChatMessage(Base):
    """Individual message within a chat session."""

    __tablename__ = "chat_messages"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    session_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("chat_sessions.id", ondelete="CASCADE"),
        nullable=False,
    )
    role: Mapped[str] = mapped_column(String(20), nullable=False)  # user | assistant
    content: Mapped[str] = mapped_column(Text, nullable=False)
    metadata_: Mapped[dict | None] = mapped_column(
        "metadata", JSON, nullable=True
    )
    created_at: Mapped[datetime] = mapped_column(
        DateTime, default=datetime.utcnow, nullable=False
    )

    __table_args__ = (
        Index("ix_chat_messages_session_created", "session_id", "created_at"),
    )

    # Relationships
    session: Mapped["ChatSession"] = relationship(back_populates="messages")


class AICache(Base):
    """Cache for AI responses to avoid redundant API calls."""

    __tablename__ = "ai_cache"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    intent: Mapped[str] = mapped_column(String(50), nullable=False)
    input_hash: Mapped[str] = mapped_column(String(64), unique=True, nullable=False)
    response: Mapped[str] = mapped_column(Text, nullable=False)
    created_at: Mapped[datetime] = mapped_column(
        DateTime, default=datetime.utcnow, nullable=False
    )
    expires_at: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)
