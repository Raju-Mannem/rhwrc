"""Data Health and Quality Schemas."""

from datetime import datetime

from pydantic import BaseModel, Field

from app.schemas.overview import IngestionStatusSummary


class DataQualityIssueItem(BaseModel):
    """An identified data quality or validation finding."""

    id: str
    dataset: str
    issue_type: str
    severity: str
    description: str
    record_identifier: str | None
    detected_at: datetime


class RecentRunSummary(BaseModel):
    """Compact summary of a recent ingestion run."""

    id: str
    dataset: str
    status: str
    started_at: datetime
    completed_at: datetime | None
    fetched_count: int
    inserted_count: int
    rejected_count: int
    error_summary: str | None


class DataHealthResponse(BaseModel):
    """Response schema for GET /api/v1/data-health."""

    status: str = Field(description="'HEALTHY', 'DEGRADED', or 'CRITICAL'")
    timestamp_utc: datetime
    ingestion_freshness: IngestionStatusSummary
    total_issues_count: int
    recent_failed_or_partial_runs: list[RecentRunSummary]
    recent_issues: list[DataQualityIssueItem]
    completeness_metrics: dict[str, float | int]
