"""Health and Readiness Probes."""

from datetime import UTC, datetime

from fastapi import APIRouter, Depends, Response, status
from sqlalchemy.orm import Session

from app.api.dependencies import get_cache, get_db_session
from app.db.session import check_database_health
from app.schemas.health import DependencyStatus, HealthLiveResponse, HealthReadyResponse
from app.services.integrations.cache_service import CacheService
from app.services.integrations.qstash_service import QStashService

router = APIRouter(tags=["Health"])


@router.get("/health/live", response_model=HealthLiveResponse)
def get_liveness():
    """Liveness probe confirming the application process is running."""
    return HealthLiveResponse(
        status="ok",
        timestamp_utc=datetime.now(UTC),
    )


@router.get("/health/ready", response_model=HealthReadyResponse)
def get_readiness(
    response: Response,
    db: Session = Depends(get_db_session),
    cache: CacheService = Depends(get_cache),
):
    """Readiness probe verifying essential dependencies (Database, Redis, QStash)."""
    db_ok = check_database_health()
    redis_ok = cache.is_redis_available()
    qstash_ok = QStashService().is_configured()

    db_status = DependencyStatus(
        status="healthy" if db_ok else "unhealthy",
        details="Connected to PostgreSQL / Neon Tech" if db_ok else "Database connection error",
    )
    redis_status = DependencyStatus(
        status="healthy" if redis_ok else "degraded",
        details="Connected to Upstash Redis" if redis_ok else "Using in-memory TTL cache fallback",
    )
    qstash_status = DependencyStatus(
        status="configured" if qstash_ok else "unconfigured",
        details="QStash token configured" if qstash_ok else "Local task execution mode",
    )
    elexon_status = DependencyStatus(
        status="available",
        details="Configured to https://data.elexon.co.uk/bmrs/api/v1",
    )

    is_ready = db_ok
    if not is_ready:
        response.status_code = status.HTTP_503_SERVICE_UNAVAILABLE

    return HealthReadyResponse(
        status="ready" if is_ready else "not_ready",
        timestamp_utc=datetime.now(UTC),
        database=db_status,
        redis=redis_status,
        qstash=qstash_status,
        elexon_api=elexon_status,
    )
