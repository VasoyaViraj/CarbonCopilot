"""MCP HTTP client — shared async HTTP client for all tool calls to Express backend.

All MCP tools call the Express backend for authoritative data.
No business logic is duplicated here; this module only handles transport.
"""

import logging
from contextvars import ContextVar, Token
from typing import Any, Dict, Optional

import httpx

from app.config import get_settings

logger = logging.getLogger("ecotrace.ai.mcp.server")

# ---------------------------------------------------------------------------
# Shared async client (reused across all tool calls in a request lifecycle)
# ---------------------------------------------------------------------------
_settings = get_settings()

# Default headers for all calls to the Express backend.
_DEFAULT_HEADERS: Dict[str, str] = {
    "Content-Type": "application/json",
    "Accept": "application/json",
}

# If AI_SERVICE_TOKEN is configured, attach it so Express can authenticate
# service-to-service calls without requiring a user JWT.
if _settings.ai_service_token:
    _DEFAULT_HEADERS["X-AI-Service-Token"] = _settings.ai_service_token


# The user on whose behalf the current copilot request runs. Set per request by the
# /copilot endpoint from the X-Acting-User-Id header Express sends; the backend loads
# that user and applies its normal organization/factory authorization to every call.
_acting_user_id: ContextVar[Optional[int]] = ContextVar("acting_user_id", default=None)


def set_acting_user(user_id: int) -> Token:
    """Scope backend calls made in the current context to `user_id`."""
    return _acting_user_id.set(user_id)


def reset_acting_user(token: Token) -> None:
    _acting_user_id.reset(token)


def _request_headers() -> Dict[str, str]:
    headers = dict(_DEFAULT_HEADERS)
    user_id = _acting_user_id.get()
    if user_id is not None:
        headers["X-Acting-User-Id"] = str(user_id)
    return headers


def _get_base_url() -> str:
    return _settings.backend_internal_url.rstrip("/")


def _unwrap(body: Any) -> Any:
    """Return the payload of Express's `{ success, data }` envelope (API_CONTRACT §1)."""
    if isinstance(body, dict) and body.get("success") is True and "data" in body:
        return body["data"]
    return body


async def backend_get(path: str, params: Optional[Dict[str, Any]] = None) -> Any:
    """Perform an authenticated GET against the Express backend.

    Args:
        path: API path relative to BACKEND_INTERNAL_URL, e.g. "/factories/1".
        params: Optional query-string parameters.

    Returns:
        Parsed JSON response body.

    Raises:
        httpx.HTTPStatusError: when the backend returns a 4xx/5xx response.
        RuntimeError: for connection / timeout failures.
    """
    url = f"{_get_base_url()}{path}"
    logger.debug("MCP GET %s params=%s", url, params)

    try:
        async with httpx.AsyncClient(
            headers=_request_headers(),
            timeout=_settings.llm_timeout_seconds,
        ) as client:
            response = await client.get(url, params=params)
            response.raise_for_status()
            return _unwrap(response.json())
    except httpx.HTTPStatusError as exc:
        logger.error("Backend returned %s for GET %s: %s", exc.response.status_code, url, exc.response.text)
        raise
    except httpx.RequestError as exc:
        logger.error("Connection error on GET %s: %s", url, exc)
        raise RuntimeError(f"Cannot reach Express backend at {url}: {exc}") from exc


async def backend_post(path: str, payload: Dict[str, Any]) -> Any:
    """Perform an authenticated POST against the Express backend.

    Args:
        path: API path relative to BACKEND_INTERNAL_URL.
        payload: JSON request body.

    Returns:
        Parsed JSON response body.
    """
    url = f"{_get_base_url()}{path}"
    logger.debug("MCP POST %s body=%s", url, payload)

    try:
        async with httpx.AsyncClient(
            headers=_request_headers(),
            timeout=_settings.llm_timeout_seconds,
        ) as client:
            response = await client.post(url, json=payload)
            response.raise_for_status()
            return _unwrap(response.json())
    except httpx.HTTPStatusError as exc:
        logger.error("Backend returned %s for POST %s: %s", exc.response.status_code, url, exc.response.text)
        raise
    except httpx.RequestError as exc:
        logger.error("Connection error on POST %s: %s", url, exc)
        raise RuntimeError(f"Cannot reach Express backend at {url}: {exc}") from exc
