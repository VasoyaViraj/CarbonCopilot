"""Application configuration loaded from environment variables / .env file."""

from functools import lru_cache
from typing import Literal

from pydantic import Field, field_validator
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    """All runtime configuration for the EcoTrace AI service.

    Values are read (in order) from:
    1. Real environment variables.
    2. The .env file in the project root.
    Defaults are safe for local development.
    """

    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        extra="ignore",
    )

    # -------------------------------------------------------------------------
    # Server
    # -------------------------------------------------------------------------
    ai_service_port: int = Field(default=8000, alias="AI_SERVICE_PORT")
    log_level: Literal["DEBUG", "INFO", "WARNING", "ERROR", "CRITICAL"] = Field(
        default="INFO", alias="LOG_LEVEL"
    )

    # -------------------------------------------------------------------------
    # Express backend — source of all deterministic business data
    # -------------------------------------------------------------------------
    backend_internal_url: str = Field(
        default="http://localhost:5000/api", alias="BACKEND_INTERNAL_URL"
    )
    # Shared secret used when the AI service calls Express internal APIs.
    ai_service_token: str = Field(default="", alias="AI_SERVICE_TOKEN")

    # -------------------------------------------------------------------------
    # LLM — used ONLY for reasoning / explanation; never for authoritative arithmetic
    # -------------------------------------------------------------------------
    llm_provider: str = Field(default="google", alias="LLM_PROVIDER")
    # Free Gemini Flash model — fast, capable, zero cost on the free tier.
    llm_model: str = Field(default="gemini-1.5-flash", alias="LLM_MODEL")
    llm_api_key: str = Field(default="", alias="LLM_API_KEY")
    llm_temperature: float = Field(default=0.0, alias="LLM_TEMPERATURE")
    llm_timeout_seconds: int = Field(default=30, alias="LLM_TIMEOUT_SECONDS")

    @field_validator("llm_temperature")
    @classmethod
    def _clamp_temperature(cls, v: float) -> float:
        if not 0.0 <= v <= 1.0:
            raise ValueError("LLM_TEMPERATURE must be between 0 and 1")
        return v


@lru_cache(maxsize=1)
def get_settings() -> Settings:
    """Return a cached singleton Settings instance."""
    return Settings()
