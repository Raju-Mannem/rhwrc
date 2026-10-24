"""Ingestion run schemas and job trigger models."""

from datetime import date, datetime
from typing import Any

from pydantic import BaseModel, Field

from app.schemas.common import PaginationMeta


class IngestionRunItem(BaseModel):
    """Detailed view of an individual ingestion run."""

    id: str
    dataset: str
    status: str
    requested_from: datetime
    requested_to: datetime
    started_at: datetime
    completed_at: datetime | None
    fetched_count: int
    inserted_count: int
    updated_count: int
    duplicate_count: int
    rejected_count: int
    error_summary: str | None
    metadata_json: dict[str, Any] | None


class IngestionRunListResponse(BaseModel):
    """Paginated list response for GET /api/v1/ingestion/runs."""

    items: list[IngestionRunItem]
    pagination: PaginationMeta


class TriggerJobRequest(BaseModel):
    """Payload to trigger background ingestion or backfill via API/QStash."""

    job_type: str = Field(
        description="'BACKFILL', 'INGEST_ACTUALS', 'INGEST_FORECASTS', or 'REBUILD_SNAPSHOTS'"
    )
    date_from: date
    date_to: date
    selection_policy: str | None = None


class TriggerJobResponse(BaseModel):
    """Response returned when a job is scheduled or executed."""

    job_id: str
    status: str
    message: str
