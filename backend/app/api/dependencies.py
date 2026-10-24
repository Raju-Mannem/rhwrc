"""API Dependencies."""

from collections.abc import Generator

from fastapi import Header, HTTPException, status
from sqlalchemy.orm import Session

from app.core.config import get_settings
from app.db.session import get_db
from app.services.integrations.cache_service import CacheService, get_cache_service
from app.services.integrations.llm_summary import LLMSummarizer, get_llm_summarizer


def get_db_session() -> Generator[Session, None, None]:
    """Dependency for obtaining a database session."""
    yield from get_db()


def get_cache() -> CacheService:
    """Dependency for analytical cache service."""
    return get_cache_service()


def get_llm() -> LLMSummarizer:
    """Dependency for LLM narrative summarizer."""
    return get_llm_summarizer()


def verify_admin_key(x_admin_key: str | None = Header(default=None)) -> None:
    """Optional security verification for admin / ingestion triggers."""
    settings = get_settings()
    if settings.API_KEY_ADMIN and x_admin_key != settings.API_KEY_ADMIN:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid or missing X-Admin-Key header",
        )
