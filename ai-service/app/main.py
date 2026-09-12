"""EcoTrace AI service — FastAPI application entry point.

Phase 13: initializes the application, structured logging, health endpoint,
and global exception handlers.
"""

import logging
import sys
import time
from contextlib import asynccontextmanager

from fastapi import FastAPI, Request, status
from fastapi.responses import JSONResponse

from app.config import get_settings

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
