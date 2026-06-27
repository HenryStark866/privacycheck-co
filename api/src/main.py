"""FastAPI application entry point with middleware and router configuration."""

import logging
from contextlib import asynccontextmanager
from typing import Any

from fastapi import FastAPI, Request
from fastapi.exceptions import RequestValidationError
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from sqlalchemy import text

from src.config import settings
from src.database import engine
from src.shared.middleware.rate_limit import RateLimitMiddleware
from src.shared.middleware.security_headers import SecurityHeadersMiddleware
from src.shared.middleware.security_logging import log_validation_failure

# Configure security logger
logging.basicConfig(level=logging.INFO)
security_logger = logging.getLogger("habeas_check.security")
security_logger.setLevel(logging.WARNING)


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Application lifespan manager for startup/shutdown events."""
    yield
    await engine.dispose()


app = FastAPI(
    title=settings.app_name,
    version=settings.app_version,
    docs_url="/docs",
    openapi_url="/openapi.json",
    lifespan=lifespan,
)

# --- Middleware ---
# Starlette middleware: last added = outermost (runs first on request).
# We want SecurityHeaders to wrap everything so even 429 responses get headers.

# CORS (innermost - closest to handlers)
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins_list,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Rate limiting (Redis-backed sliding window)
app.add_middleware(RateLimitMiddleware)

# Security headers (OWASP) - outermost, applied to ALL responses including 429
app.add_middleware(SecurityHeadersMiddleware)


# --- Exception Handlers ---


@app.exception_handler(RequestValidationError)
async def validation_exception_handler(request: Request, exc: RequestValidationError):
    """Handle Pydantic validation errors with structured logging.

    Returns 422 with field-level errors and logs the event for security audit.
    """
    client_ip = request.client.host if request.client else "unknown"
    errors = exc.errors()

    log_validation_failure(
        ip=client_ip,
        path=str(request.url.path),
        errors=errors,
    )

    # Sanitize errors for JSON serialization (Pydantic v2 may include
    # non-serializable objects like ValueError in ctx)
    safe_errors = []
    for err in errors:
        safe_err = {
            "loc": err.get("loc"),
            "msg": err.get("msg"),
            "type": err.get("type"),
        }
        safe_errors.append(safe_err)

    return JSONResponse(
        status_code=422,
        content={
            "detail": safe_errors,
        },
    )


# --- Health Endpoint ---


@app.get("/health", tags=["Health"])
async def health_check() -> dict[str, Any]:
    """Health check endpoint. Returns service status and version.

    No authentication required. Reports degraded status when DB is unavailable.
    """
    db_status = "healthy"

    try:
        async with engine.connect() as conn:
            await conn.execute(text("SELECT 1"))
    except Exception:
        db_status = "unavailable"

    overall_status = "healthy" if db_status == "healthy" else "degraded"

    return {
        "status": overall_status,
        "version": settings.app_version,
        "service": settings.app_name,
        "dependencies": {
            "database": db_status,
        },
    }


# --- API Router stubs (versioned prefix) ---

from fastapi import APIRouter

api_v1_router = APIRouter(prefix="/api/v1")


# Sub-routers
from src.modules.auth.router import router as auth_router

api_v1_router.include_router(auth_router, prefix="/auth", tags=["Auth"])

# Dev-only auth (simulated login without Supabase)
if settings.debug:
    from src.modules.auth.dev_router import router as dev_auth_router

    api_v1_router.include_router(dev_auth_router, prefix="/auth", tags=["Dev Auth"])

from src.modules.empresas.router import router as empresas_router

api_v1_router.include_router(empresas_router, prefix="/empresas", tags=["Empresas"])

from src.modules.evaluaciones.router import router as evaluaciones_router

api_v1_router.include_router(evaluaciones_router, prefix="/evaluaciones", tags=["Evaluaciones"])

from src.modules.chat.router import router as chat_router

api_v1_router.include_router(chat_router, prefix="/chat", tags=["Chat"])

from src.modules.reportes.router import router as reportes_router

api_v1_router.include_router(reportes_router, prefix="/reportes", tags=["Reportes"])

from src.modules.diagnostico.router import router as diagnostico_router

api_v1_router.include_router(diagnostico_router, prefix="/diagnostico", tags=["Diagnostico"])

app.include_router(api_v1_router)

# --- Channel Adapter Webhooks (conditionally registered) ---

if settings.channel_whatsapp_enabled:
    from src.modules.chat.adapters.webhooks import create_whatsapp_webhook_router

    app.include_router(create_whatsapp_webhook_router())

if settings.channel_telegram_enabled:
    from src.modules.chat.adapters.webhooks import create_telegram_webhook_router

    app.include_router(create_telegram_webhook_router())
