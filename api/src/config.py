"""Application configuration using Pydantic Settings."""

from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    """Application settings loaded from environment variables."""

    # Application
    app_name: str = "Habeas Check API"
    app_version: str = "0.1.0"
    debug: bool = False

    # Database
    database_url: str = "postgresql+asyncpg://postgres:postgres@localhost:5432/habeas_check"

    # Redis
    redis_url: str = "redis://localhost:6379/0"

    # Supabase Auth
    supabase_jwt_secret: str = ""

    # AI Provider
    ai_api_key: str = ""
    ai_base_url: str = "https://api.deepseek.com"
    ai_model: str = "deepseek-chat"
    ai_timeout_seconds: int = 10

    # CORS
    cors_origins: str = "http://localhost:3000,http://localhost:5173"

    # Channel Adapters
    channel_whatsapp_enabled: bool = False
    channel_telegram_enabled: bool = False

    # Evolution API (WhatsApp)
    evolution_api_url: str = "http://localhost:8080"
    evolution_api_key: str = ""
    evolution_instance_name: str = "habeas-check"

    # Telegram
    telegram_bot_token: str = ""
    telegram_webhook_secret: str = ""

    # Rate Limiting (requests per minute)
    rate_limit_auth: int = 10
    rate_limit_chat: int = 30
    rate_limit_webhooks: int = 100
    rate_limit_default: int = 60

    # Cache TTL (seconds) - default 7 days
    cache_ttl_seconds: int = 604800

    @property
    def cors_origins_list(self) -> list[str]:
        """Parse CORS origins from comma-separated string."""
        return [origin.strip() for origin in self.cors_origins.split(",") if origin.strip()]

    model_config = {"env_file": ".env", "env_file_encoding": "utf-8", "extra": "ignore"}


settings = Settings()
