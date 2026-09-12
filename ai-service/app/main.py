"""EcoTrace AI service — FastAPI application entry point.

Initializes the application, structured logging, health endpoint and global
exception handlers, and exposes POST /copilot to the Express backend.
"""

import hmac
import logging
import sys
import time
from contextlib import asynccontextmanager
from typing import Optional

from fastapi import FastAPI, Header, HTTPException, Request, status
from fastapi.responses import JSONResponse

from app.config import get_settings
from app.schemas.ai_response import CopilotRequest, CopilotResponse
from app.services.copilot import run_copilot

# ---------------------------------------------------------------------------
# Structured logging setup
# ---------------------------------------------------------------------------
settings = get_settings()

logging.basicConfig(
    level=settings.log_level,
    format="%(asctime)s [%(levelname)s] %(name)s — %(message)s",
    stream=sys.stdout,
)
logger = logging.getLogger("ecotrace.ai")


# ---------------------------------------------------------------------------
# Application lifecycle
# ---------------------------------------------------------------------------
@asynccontextmanager
async def lifespan(app: FastAPI):
    logger.info(
        "EcoTrace AI service starting — model=%s backend=%s",
        settings.llm_model,
        settings.backend_internal_url,
    )
    yield
    logger.info("EcoTrace AI service shutting down.")


# ---------------------------------------------------------------------------
# FastAPI application
# ---------------------------------------------------------------------------
app = FastAPI(
    title="EcoTrace AI Service",
    description=(
        "Python/FastAPI AI orchestration layer for EcoTrace AI. "
        "Uses LangChain + LangGraph with Gemini Flash (free tier). "
        "All authoritative arithmetic is delegated to the Express backend."
    ),
    version="0.1.0",
    lifespan=lifespan,
    docs_url="/docs",
    redoc_url="/redoc",
)


# ---------------------------------------------------------------------------
# Global exception handlers
# ---------------------------------------------------------------------------
@app.exception_handler(Exception)
async def unhandled_exception_handler(request: Request, exc: Exception) -> JSONResponse:
    logger.exception("Unhandled exception on %s %s", request.method, request.url.path)
    return JSONResponse(
        status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
        content={
            "error": "internal_server_error",
            "message": "An unexpected error occurred. Please try again.",
        },
    )


# ---------------------------------------------------------------------------
# Health endpoint
# ---------------------------------------------------------------------------
@app.get(
    "/health",
    tags=["health"],
    summary="Service health check",
    response_description="Returns service status and basic runtime metadata.",
)
async def health() -> dict:
    """Lightweight health probe — returns 200 when the service is running."""
    return {
        "status": "ok",
        "service": "ecotrace-ai",
        "llm_model": settings.llm_model,
        "backend_url": settings.backend_internal_url,
        "timestamp": time.time(),
    }


# ---------------------------------------------------------------------------
# Copilot endpoint — only the Express backend may call it
# ---------------------------------------------------------------------------
def _require_service_token(token: Optional[str]) -> None:
    expected = settings.ai_service_token
    if not expected or not token or not hmac.compare_digest(token.encode(), expected.encode()):
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid service credentials")


@app.post(
    "/copilot",
    tags=["copilot"],
    summary="Answer a copilot question for an authorized factory",
    response_model=CopilotResponse,
    response_model_by_alias=True,
)
async def copilot(
    body: CopilotRequest,
    x_ai_service_token: Optional[str] = Header(default=None),
    x_acting_user_id: Optional[int] = Header(default=None, gt=0),
):
    """Express authenticates the user and authorizes the factory before calling this.

    Backend calls made while answering carry the acting user's id so the backend
    re-applies that user's organization/factory authorization.
    """
    _require_service_token(x_ai_service_token)
    if x_acting_user_id is None:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="X-Acting-User-Id header is required")

    try:
        return await run_copilot(body, x_acting_user_id)
    except Exception:
        logger.exception("Copilot request failed for factory_id=%s", body.factory_id)
        return JSONResponse(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            content={"error": "ai_unavailable", "message": "The AI Copilot could not complete this request."},
        )
