"""Ingestion Run Repository."""

from datetime import UTC, datetime
from typing import Any

from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.db.models.ingestion_run import IngestionRun
from app.db.models.raw_record import RawSourceRecord


class IngestionRepository:
    """Repository for auditing ingestion runs and persisting raw payload traces."""

    def __init__(self, db: Session) -> None:
        self.db = db

    def create_run(
        self,
        dataset: str,
        requested_from: datetime,
        requested_to: datetime,
        metadata_json: dict[str, Any] | None = None,
    ) -> IngestionRun:
        """Create a new IngestionRun record initialized in RUNNING state."""
        run = IngestionRun(
            dataset=dataset,
            status="RUNNING",
            requested_from=requested_from,
            requested_to=requested_to,
            started_at=datetime.now(UTC),
            metadata_json=metadata_json,
        )
        self.db.add(run)
        self.db.commit()
        self.db.refresh(run)
        return run

    def complete_run(
        self,
        run_id: str,
        status: str,
        fetched: int,
        inserted: int,
        updated: int,
        duplicates: int,
        rejected: int,
        error_summary: str | None = None,
    ) -> IngestionRun:
        """Mark an ingestion run as completed with final metrics and status."""
        run = self.db.get(IngestionRun, run_id)
        if run:
            run.status = status
            run.completed_at = datetime.now(UTC)
            run.fetched_count = fetched
            run.inserted_count = inserted
            run.updated_count = updated
            run.duplicate_count = duplicates
            run.rejected_count = rejected
            run.error_summary = error_summary
            self.db.commit()
            self.db.refresh(run)
        return run

    def save_raw_records(
        self,
        records: list[dict[str, Any]],
        run_id: str,
    ) -> dict[str, str]:
        """Save raw JSON source payloads for audit lineage.

        Returns a dictionary mapping source_identity to raw_record_id.
        """
        now = datetime.now(UTC)
        identity_to_id: dict[str, str] = {}

        for r in records:
            raw = RawSourceRecord(
                dataset=r["dataset"],
                source_identity=r["source_identity"],
                payload_hash=r["payload_hash"],
                payload=r["raw_payload"],
                retrieval_timestamp=now,
                publish_time=r.get("publish_time_utc") or r.get("source_publish_time"),
                ingestion_run_id=run_id,
            )
            self.db.add(raw)
            identity_to_id[r["source_identity"]] = raw.id

        self.db.commit()
        return identity_to_id

    def list_runs(
        self,
        dataset: str | None = None,
        status: str | None = None,
        limit: int = 50,
        offset: int = 0,
    ) -> tuple[list[IngestionRun], int]:
        """List ingestion runs with optional filtering and pagination."""
        stmt = select(IngestionRun)
        count_stmt = select(func.count(IngestionRun.id))

        if dataset:
            stmt = stmt.where(IngestionRun.dataset == dataset)
            count_stmt = count_stmt.where(IngestionRun.dataset == dataset)
        if status:
            stmt = stmt.where(IngestionRun.status == status)
            count_stmt = count_stmt.where(IngestionRun.status == status)

        stmt = stmt.order_by(IngestionRun.started_at.desc()).limit(limit).offset(offset)
        total = self.db.scalar(count_stmt) or 0
        items = list(self.db.scalars(stmt).all())
        return items, total

    def get_latest_successful_run(self, dataset: str) -> IngestionRun | None:
        """Retrieve the most recent successful run for a dataset."""
        stmt = (
            select(IngestionRun)
            .where(
                IngestionRun.dataset == dataset,
                IngestionRun.status == "SUCCESS",
            )
            .order_by(IngestionRun.completed_at.desc())
            .limit(1)
        )
        return self.db.scalars(stmt).first()
