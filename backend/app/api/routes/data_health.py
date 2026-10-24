"""Data Health and Quality Route."""

from datetime import UTC, datetime

from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.api.dependencies import get_db_session
from app.repositories.ingestion_repo import IngestionRepository
from app.repositories.quality_repo import QualityRepository
from app.schemas.data_health import (
    DataHealthResponse,
    DataQualityIssueItem,
    RecentRunSummary,
)
from app.schemas.overview import IngestionStatusSummary

router = APIRouter(prefix="/api/v1", tags=["Data Health"])


@router.get("/data-health", response_model=DataHealthResponse)
def get_data_health(db: Session = Depends(get_db_session)):
    """Operational data quality, freshness, and ingestion reliability report."""
    ingestion_repo = IngestionRepository(db)
    quality_repo = QualityRepository(db)

    last_act_run = ingestion_repo.get_latest_successful_run("FUELHH")
    last_fc_run = ingestion_repo.get_latest_successful_run("WINDFOR")

    # Fetch recent failed or partial runs
    all_runs, _ = ingestion_repo.list_runs(limit=20)
    failed_or_partial = [
        RecentRunSummary(
            id=r.id,
            dataset=r.dataset,
            status=r.status,
            started_at=r.started_at,
            completed_at=r.completed_at,
            fetched_count=r.fetched_count,
            inserted_count=r.inserted_count,
            rejected_count=r.rejected_count,
            error_summary=r.error_summary,
        )
        for r in all_runs
        if r.status in ("FAILED", "PARTIAL")
    ]

    recent_issues_db = quality_repo.get_recent_issues(limit=25)
    total_issues = quality_repo.get_total_issues_count()

    recent_issues = [
        DataQualityIssueItem(
            id=i.id,
            dataset=i.dataset,
            issue_type=i.issue_type,
            severity=i.severity,
            description=i.description,
            record_identifier=i.record_identifier,
            detected_at=i.detected_at,
        )
        for i in recent_issues_db
    ]

    has_critical = any(i.severity == "CRITICAL" for i in recent_issues_db)
    status_str = "CRITICAL" if has_critical else ("DEGRADED" if failed_or_partial else "HEALTHY")

    return DataHealthResponse(
        status=status_str,
        timestamp_utc=datetime.now(UTC),
        ingestion_freshness=IngestionStatusSummary(
            last_successful_actual_utc=last_act_run.completed_at if last_act_run else None,
            last_successful_forecast_utc=last_fc_run.completed_at if last_fc_run else None,
        ),
        total_issues_count=total_issues,
        recent_failed_or_partial_runs=failed_or_partial,
        recent_issues=recent_issues,
        completeness_metrics={
            "failed_or_partial_runs_count": len(failed_or_partial),
            "unresolved_critical_flags": 1 if has_critical else 0,
        },
    )
