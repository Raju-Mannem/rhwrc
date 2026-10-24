"""Forecast Generation Repository for persistence and evolution queries."""

from datetime import datetime
from typing import Any

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.db.models.forecast_observation import ForecastObservation


class ForecastRepository:
    """Repository managing wind forecast persistence and temporal snapshot queries."""

    def __init__(self, db: Session) -> None:
        self.db = db

    def upsert_records(
        self,
        records: list[dict[str, Any]],
        ingestion_run_id: str | None = None,
    ) -> tuple[int, int, int]:
        """Idempotently insert forecast records while preserving all historical publication versions.

        Returns (inserted_count, updated_count, duplicate_count).
        """
        if not records:
            return 0, 0, 0

        inserted = 0
        updated = 0
        duplicates = 0

        for r in records:
            start_utc = r["start_time_utc"]
            pub_utc = r["publish_time_utc"]

            existing = self.db.scalars(
                select(ForecastObservation).where(
                    ForecastObservation.start_time_utc == start_utc,
                    ForecastObservation.publish_time_utc == pub_utc,
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
                obs = ForecastObservation(
                    start_time_utc=start_utc,
                    publish_time_utc=pub_utc,
                    generation_mw=r["generation_mw"],
                    dataset="WINDFOR",
                    source_identity=r["source_identity"],
                    raw_record_id=r.get("raw_record_id"),
                    ingestion_run_id=ingestion_run_id,
                    quality_status="FLAGGED" if r.get("warnings") else "VALID",
                )
                self.db.add(obs)
                inserted += 1

        self.db.commit()
        return inserted, updated, duplicates

    def get_eligible_forecasts_for_cutoff(
        self,
        cutoff_utc: datetime,
        interval_starts: list[datetime],
        inclusive: bool = True,
    ) -> list[ForecastObservation]:
        """Query forecast observations published at or before cutoff_utc for the given delivery intervals.

        Strictly excludes any forecasts published after cutoff_utc.
        """
        if not interval_starts:
            return []

        condition = (
            (ForecastObservation.publish_time_utc <= cutoff_utc)
            if inclusive
            else (ForecastObservation.publish_time_utc < cutoff_utc)
        )

        stmt = (
            select(ForecastObservation)
            .where(
                ForecastObservation.start_time_utc.in_(interval_starts),
                condition,
            )
            .order_by(
                ForecastObservation.publish_time_utc.desc(),
                ForecastObservation.start_time_utc.asc(),
            )
        )
        return list(self.db.scalars(stmt).all())

    def get_evolution_for_interval(
        self,
        start_time_utc: datetime,
    ) -> list[ForecastObservation]:
        """Retrieve all retained forecast versions for a specific delivery interval ordered chronologically."""
        stmt = (
            select(ForecastObservation)
            .where(ForecastObservation.start_time_utc == start_time_utc)
            .order_by(ForecastObservation.publish_time_utc.asc())
        )
        return list(self.db.scalars(stmt).all())

    def get_latest_forecast_publish_timestamp(self) -> datetime | None:
        """Get the latest recorded forecast publication timestamp."""
        stmt = (
            select(ForecastObservation.publish_time_utc)
            .order_by(ForecastObservation.publish_time_utc.desc())
            .limit(1)
        )
        return self.db.scalars(stmt).first()
