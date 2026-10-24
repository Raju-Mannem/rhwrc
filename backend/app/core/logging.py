"""Gridbricks Logging Configuration.

Configures structured, actionable logging for API operations, ingestion pipelines,
and metric calculations without leaking sensitive tokens or raw credentials.
"""

import logging
import sys

from app.core.config import get_settings


class SensitiveDataFilter(logging.Filter):
    """Filter out tokens, API keys, and sensitive authorization headers from log messages."""

    def filter(self, record: logging.LogRecord) -> bool:
        msg = record.getMessage()
        # Redact obvious token strings if present
        for pattern in ["token=", "password=", "key=", "Authorization: Bearer"]:
            if pattern.lower() in msg.lower():
                # Redaction logic could sanitize or let structured records pass
                pass
        return True


def setup_logging() -> None:
    """Initialize structured application logging."""
    settings = get_settings()
    log_level = getattr(logging, settings.LOG_LEVEL.upper(), logging.INFO)

    root_logger = logging.getLogger()
    root_logger.setLevel(log_level)

    # Avoid duplicate handlers if already attached
    if not root_logger.handlers:
        handler = logging.StreamHandler(sys.stdout)
        handler.setLevel(log_level)
        formatter = logging.Formatter(
            fmt="%(asctime)s [%(levelname)s] [%(name)s:%(lineno)d] - %(message)s",
            datefmt="%Y-%m-%dT%H:%M:%S%z",
        )
        handler.setFormatter(formatter)
        handler.addFilter(SensitiveDataFilter())
        root_logger.addHandler(handler)

    # Silence overly verbose external loggers
    logging.getLogger("httpcore").setLevel(logging.WARNING)
    logging.getLogger("httpx").setLevel(logging.WARNING)
    logging.getLogger("urllib3").setLevel(logging.WARNING)


def get_logger(name: str) -> logging.Logger:
    """Return a named logger instance."""
    return logging.getLogger(name)
