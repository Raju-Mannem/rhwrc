"""Health check response schemas."""

from datetime import datetime

from pydantic import BaseModel, Field


class HealthLiveResponse(BaseModel):
    """Liveness probe response."""

    status: str = Field(default="ok", description="Process liveness state")
    timestamp_utc: datetime = Field(description="Current UTC timestamp")
    app: str = Field(default="gridbricks-backend")


class DependencyStatus(BaseModel):
    """Status of an individual dependent service."""

    status: str
    details: str | None = None


class HealthReadyResponse(BaseModel):
    """Readiness probe response."""

    status: str = Field(description="Readiness state: 'ready' or 'not_ready'")
    timestamp_utc: datetime
    database: DependencyStatus
    redis: DependencyStatus
    qstash: DependencyStatus
    elexon_api: DependencyStatus
