"""Shared Base HTTP Client for Elexon BMRS API.

Provides bounded retries, explicit timeouts, exponential backoff,
and diagnostic metadata logging.
"""

from typing import Any

import httpx
from tenacity import (
    RetryCallState,
    retry,
    retry_if_exception,
    stop_after_attempt,
    wait_exponential,
)

from app.core.config import get_settings
from app.core.exceptions import ElexonSourceError
from app.core.logging import get_logger

logger = get_logger(__name__)


def should_retry_request(exception: BaseException) -> bool:
    """Predicate for transient failures: network errors, timeouts, HTTP 429 and 5xx."""
    if isinstance(exception, (httpx.NetworkError, httpx.TimeoutException)):
        return True
    if isinstance(exception, httpx.HTTPStatusError):
        code = exception.response.status_code
        return code == 429 or 500 <= code <= 599
    return False


def log_retry_attempt(retry_state: RetryCallState) -> None:
    """Log retry diagnostic details."""
    logger.warning(
        f"Retrying Elexon API call (attempt {retry_state.attempt_number}) "
        f"due to: {retry_state.outcome.exception()}"
    )


class ElexonBaseClient:
    """Base client for Elexon BMRS endpoints."""

    def __init__(
        self,
        base_url: str | None = None,
        timeout_seconds: float | None = None,
        max_retries: int | None = None,
        backoff_factor: float | None = None,
    ) -> None:
        settings = get_settings()
        self.base_url = (base_url or settings.ELEXON_BASE_URL).rstrip("/")
        self.timeout = timeout_seconds or settings.ELEXON_TIMEOUT_SECONDS
        self.max_retries = max_retries or settings.ELEXON_MAX_RETRIES
        self.backoff_factor = backoff_factor or settings.ELEXON_BACKOFF_FACTOR
        self.user_agent = settings.ELEXON_USER_AGENT

        self._client: httpx.Client | None = None

    def get_http_client(self) -> httpx.Client:
        """Create or return reusable HTTP client with explicit connection pooling."""
        if self._client is None or self._client.is_closed:
            headers = {
                "User-Agent": self.user_agent,
                "Accept": "application/json",
            }
            self._client = httpx.Client(
                base_url=self.base_url,
                headers=headers,
                timeout=httpx.Timeout(self.timeout, connect=10.0),
                limits=httpx.Limits(max_keepalive_connections=5, max_connections=10),
            )
        return self._client

    def close(self) -> None:
        """Close underlying HTTP client."""
        if self._client is not None and not self._client.is_closed:
            self._client.close()

    def __enter__(self):
        return self

    def __exit__(self, exc_type, exc_val, exc_tb):
        self.close()

    def get(self, path: str, params: dict[str, Any] | None = None) -> Any:
        """Execute a GET request with bounded retries and exponential backoff."""
        client = self.get_http_client()

        @retry(
            retry=retry_if_exception(should_retry_request),
            stop=stop_after_attempt(self.max_retries),
            wait=wait_exponential(multiplier=self.backoff_factor, min=1, max=10),
            before_sleep=log_retry_attempt,
            reraise=True,
        )
        def _execute_with_retry():
            try:
                response = client.get(path, params=params)
                response.raise_for_status()
                return response.json()
            except httpx.HTTPStatusError as exc:
                status = exc.response.status_code
                logger.error(
                    f"Elexon upstream error {status} for path '{path}': {exc.response.text[:200]}"
                )
                raise ElexonSourceError(
                    message=f"Elexon upstream returned HTTP {status}",
                    status_code=502,
                    upstream_status=status,
                ) from exc
            except (httpx.NetworkError, httpx.TimeoutException) as exc:
                logger.error(f"Elexon network failure for path '{path}': {exc}")
                raise ElexonSourceError(
                    message=f"Failed to communicate with Elexon API: {exc}",
                    status_code=504,
                ) from exc
            except ValueError as exc:
                logger.error(f"Invalid JSON response from Elexon for path '{path}': {exc}")
                raise ElexonSourceError(
                    message="Malformed JSON response received from Elexon",
                    status_code=502,
                ) from exc

        return _execute_with_retry()
