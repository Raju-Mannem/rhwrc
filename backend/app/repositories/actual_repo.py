"""Actual Generation Repository for persistence and queries."""

from datetime import datetime
from typing import Any

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.db.models.actual_observation import ActualObservation


class ActualRepository:
    """Repository managing actual generation outturn persistence and queries."""

    def __init__(self, db: Session) -> None:
        self.db = db

    def upsert_records(
        self,
        records: list[dict[str, Any]],
        ingestion_run_id: str | None = None,
    ) -> tuple[int, int, int]:
        """Idempotently insert or update actual observations.

        Returns (inserted_count, updated_count, duplicate_count).
        """
        if not records:
            return 0, 0, 0

        inserted = 0
        updated = 0
        duplicates = 0

        for r in records:
            start_utc = r["start_time_utc"]
            fuel_type = r.get("fuel_type", "WIND")

            existing = self.db.scalars(
                select(ActualObservation).where(
                    ActualObservation.start_time_utc == start_utc,
                    ActualObservation.fuel_type == fuel_type,
                )
            ).first()

            if existing:
                if existing.generation_mw == r["generation_mw"]:
                    duplicates += 1
                else:
                    existing.generation_mw = r["generation_mw"]
                    existing.raw_record_id = r.get("raw_record_id")
                    existing.ingestion_run_id = ingestion_run_id
                    existing.quality_status = "FLAGGED" if r.get("warnings") else "VALID"
                    updated += 1
            else:
                obs = ActualObservation(
                    start_time_utc=start_utc,
                    settlement_date=r["settlement_date"],
                    settlement_period=r["settlement_period"],
                    fuel_type=fuel_type,
                    generation_mw=r["generation_mw"],
                    source_identity=r["source_identity"],
                    source_publish_time=r.get("source_publish_time"),
                    raw_record_id=r.get("raw_record_id"),
                    ingestion_run_id=ingestion_run_id,
                    quality_status="FLAGGED" if r.get("warnings") else "VALID",
                )
                self.db.add(obs)
                inserted += 1

        self.db.commit()
        return inserted, updated, duplicates

    def get_actuals_for_intervals(
        self,
        interval_starts: list[datetime],
        fuel_type: str = "WIND",
    ) -> dict[datetime, float]:
        """Fetch actual generation keyed by delivery interval start time."""
        if not interval_starts:
            return {}

        stmt = select(ActualObservation).where(
            ActualObservation.start_time_utc.in_(interval_starts),
            ActualObservation.fuel_type == fuel_type,
        )
        results = self.db.scalars(stmt).all()
        return {obs.start_time_utc: obs.generation_mw for obs in results}

    def get_actual_for_interval(
        self,
        start_time_utc: datetime,
        fuel_type: str = "WIND",
    ) -> float | None:
        """Fetch single actual observation for an interval."""
        stmt = select(ActualObservation.generation_mw).where(
            ActualObservation.start_time_utc == start_time_utc,
            ActualObservation.fuel_type == fuel_type,
        )
        return self.db.scalars(stmt).first()

    def get_latest_actual_timestamp(self) -> datetime | None:
        """Get the latest recorded actual observation start time."""
        stmt = (
            select(ActualObservation.start_time_utc)
            .order_by(ActualObservation.start_time_utc.desc())
            .limit(1)
        )
        return self.db.scalars(stmt).first()
