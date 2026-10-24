"""Data Quality Issues Repository."""

from datetime import UTC, datetime

from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.db.models.data_quality import DataQualityIssue


class QualityRepository:
    """Repository managing data quality findings and anomaly records."""

    def __init__(self, db: Session) -> None:
        self.db = db

    def record_issue(
        self,
        dataset: str,
        issue_type: str,
        description: str,
        severity: str = "WARNING",
        record_identifier: str | None = None,
        ingestion_run_id: str | None = None,
    ) -> DataQualityIssue:
        """Record a validation anomaly or missing delivery interval."""
        issue = DataQualityIssue(
            dataset=dataset,
            issue_type=issue_type,
            severity=severity,
            description=description,
            record_identifier=record_identifier,
            ingestion_run_id=ingestion_run_id,
            detected_at=datetime.now(UTC),
        )
        self.db.add(issue)
        self.db.commit()
        return issue

    def get_recent_issues(self, limit: int = 50) -> list[DataQualityIssue]:
        """Fetch the most recent data quality findings."""
        stmt = select(DataQualityIssue).order_by(DataQualityIssue.detected_at.desc()).limit(limit)
        return list(self.db.scalars(stmt).all())

    def get_total_issues_count(self) -> int:
        """Count total recorded data quality issues."""
        stmt = select(func.count(DataQualityIssue.id))
        return self.db.scalar(stmt) or 0
