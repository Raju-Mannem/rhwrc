"""Upstash QStash Asynchronous Task Dispatcher and Webhook Handler.

Supports dispatching background backfill or ingestion tasks via Upstash QStash
and verifying incoming webhook requests.
"""

from typing import Any

import httpx

from app.core.config import get_settings
from app.core.logging import get_logger

logger = get_logger(__name__)


class QStashService:
    """Service for interacting with Upstash QStash serverless message queue."""

    def __init__(self) -> None:
        settings = get_settings()
        self.qstash_url = settings.QSTASH_URL
        self.qstash_token = settings.QSTASH_TOKEN
        self.signing_key = settings.QSTASH_CURRENT_SIGNING_KEY

    def is_configured(self) -> bool:
        """Check if QStash token is configured."""
        return bool(self.qstash_token)

    def publish_json_job(
        self,
        destination_url: str,
        payload: dict[str, Any],
        delay_seconds: int = 0,
    ) -> str | None:
        """Publish a background task to QStash targeting destination_url.

        Returns QStash message ID or None if QStash is not configured.
        """
        if not self.is_configured():
            logger.info("QStash not configured; job will run directly or locally.")
            return None

        headers = {
            "Authorization": f"Bearer {self.qstash_token}",
            "Content-Type": "application/json",
        }
        if delay_seconds > 0:
            headers["Upstash-Delay"] = f"{delay_seconds}s"

        target_endpoint = f"{self.qstash_url.rstrip('/')}/{destination_url.lstrip('/')}"
        try:
            with httpx.Client(timeout=10.0) as client:
                res = client.post(target_endpoint, headers=headers, json=payload)
                res.raise_for_status()
                data = res.json()
                message_id = data.get("messageId")
                logger.info(f"Dispatched background job to QStash: message_id={message_id}")
                return message_id
        except Exception as exc:
            logger.error(f"Failed to publish message to QStash: {exc}")
            return None
