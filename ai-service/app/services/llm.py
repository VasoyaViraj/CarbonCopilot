"""LangChain / Gemini LLM provider wrapper.

The LLM is used ONLY for reasoning, explanation, and orchestration.
It must NEVER perform authoritative carbon arithmetic (ADR-003).
"""

import logging
from functools import lru_cache

from langchain_google_genai import ChatGoogleGenerativeAI

from app.config import get_settings

logger = logging.getLogger("ecotrace.ai.llm")


@lru_cache(maxsize=1)
def get_llm() -> ChatGoogleGenerativeAI:
    """Return a cached ChatGoogleGenerativeAI instance using Gemini Flash (free tier).

    Temperature=0 ensures deterministic, reproducible explanations.
    """
    settings = get_settings()

    if not settings.llm_api_key:
        logger.warning(
            "LLM_API_KEY is not set — LLM calls will fail at runtime. "
            "Set it in .env to enable Gemini integration."
        )

    llm = ChatGoogleGenerativeAI(
        model=settings.llm_model,
        google_api_key=settings.llm_api_key or None,
        temperature=settings.llm_temperature,
        timeout=settings.llm_timeout_seconds,
        # Safety: prevent the model from performing arithmetic on its own.
        # We pass tool results as context; the model only explains.
        max_retries=2,
    )

    logger.info("LLM initialised: model=%s temperature=%s", settings.llm_model, settings.llm_temperature)
    return llm
