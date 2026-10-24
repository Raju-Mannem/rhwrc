"""Data Ingestion Service.

Orchestrates repeatable, auditable, and idempotent ingestion of FUELHH actuals
and WINDFOR forecasts from Elexon BMRS into persistent storage.
"""

from datetime import date, datetime, timedelta
from typing import Any

from sqlalchemy.orm import Session

from app.core.config import get_settings
from app.core.logging import get_logger
from app.repositories.actual_repo import ActualRepository
from app.repositories.forecast_repo import ForecastRepository
from app.repositories.ingestion_repo import IngestionRepository
from app.repositories.quality_repo import QualityRepository
from app.services.elexon.fuelhh_client import FuelHHClient
from app.services.elexon.windfor_client import WindforClient
from app.services.normalization.normalizer import (
    compute_decision_cutoff_utc,
    derive_delivery_date,
    parse_to_utc_datetime,
)

logger = get_logger(__name__)


class IngestionService:
    """Coordinates fetching, validating, auditing, and persisting Elexon datasets."""

    def __init__(self, db: Session) -> None:
        self.db = db
        self.ingestion_repo = IngestionRepository(db)
        self.actual_repo = ActualRepository(db)
        self.forecast_repo = ForecastRepository(db)
        self.quality_repo = QualityRepository(db)
        self.settings = get_settings()

    def ingest_actuals_range(
        self,
        date_from: date,
        date_to: date,
        client: FuelHHClient | None = None,
    ) -> str:
        """Fetch and persist actual wind generation outturn (FUELHH) for the given date range.

        Returns ingestion run ID.
        """
        req_from_utc = parse_to_utc_datetime(datetime.combine(date_from, datetime.min.time()))
        req_to_utc = parse_to_utc_datetime(datetime.combine(date_to, datetime.max.time()))

        run = self.ingestion_repo.create_run(
            dataset="FUELHH",
            requested_from=req_from_utc,
            requested_to=req_to_utc,
            metadata_json={"date_from": date_from.isoformat(), "date_to": date_to.isoformat()},
        )

        fuel_client = client or FuelHHClient()
        try:
            records = fuel_client.fetch_actual_wind(date_from, date_to)
            fetched_count = len(records)

            if fetched_count == 0:
                self.ingestion_repo.complete_run(
                    run_id=run.id,
                    status="PARTIAL",
                    fetched=0,
                    inserted=0,
                    updated=0,
                    duplicates=0,
                    rejected=0,
                    error_summary="Zero records returned by FUELHH for requested range",
                )
                return run.id

            # Save raw records for lineage
            identity_map = self.ingestion_repo.save_raw_records(records, run.id)
            for r in records:
                r["raw_record_id"] = identity_map.get(r["source_identity"])

            # Check for data quality warnings
            rejected_count = 0
            for r in records:
                for w in r.get("warnings", []):
                    self.quality_repo.record_issue(
                        dataset="FUELHH",
                        issue_type=w,
                        description=f"Record {r['source_identity']} triggered validation flag {w}",
                        severity="WARNING" if w != "NEGATIVE_GENERATION" else "ERROR",
                        record_identifier=r["source_identity"],
                        ingestion_run_id=run.id,
                    )

            # Idempotently upsert observations
            inserted, updated, duplicates = self.actual_repo.upsert_records(records, run.id)

            self.ingestion_repo.complete_run(
                run_id=run.id,
                status="SUCCESS",
                fetched=fetched_count,
                inserted=inserted,
                updated=updated,
                duplicates=duplicates,
                rejected=rejected_count,
            )
            logger.info(
                f"Completed FUELHH ingestion run {run.id}: +{inserted}, ~{updated}, ={duplicates}"
            )
            return run.id

        except Exception as exc:
            logger.error(f"FUELHH ingestion run {run.id} failed: {exc}", exc_info=True)
            self.ingestion_repo.complete_run(
                run_id=run.id,
                status="FAILED",
                fetched=0,
                inserted=0,
                updated=0,
                duplicates=0,
                rejected=0,
                error_summary=str(exc),
            )
            raise

    def ingest_forecasts_range(
        self,
        publish_from_utc: datetime,
        publish_to_utc: datetime,
        client: WindforClient | None = None,
    ) -> str:
        """Fetch and persist forecast generation records (WINDFOR) across a publication window.

        Preserves all historical publications. Returns ingestion run ID.
        """
        run = self.ingestion_repo.create_run(
            dataset="WINDFOR",
            requested_from=publish_from_utc,
            requested_to=publish_to_utc,
            metadata_json={
                "publish_from_utc": publish_from_utc.isoformat(),
                "publish_to_utc": publish_to_utc.isoformat(),
            },
        )

        wf_client = client or WindforClient()
        try:
            records = wf_client.fetch_forecasts_in_chunks(
                publish_from_utc, publish_to_utc, chunk_hours=24
            )
            fetched_count = len(records)

            if fetched_count == 0:
                self.ingestion_repo.complete_run(
                    run_id=run.id,
                    status="PARTIAL",
                    fetched=0,
                    inserted=0,
                    updated=0,
                    duplicates=0,
                    rejected=0,
                    error_summary="Zero records returned by WINDFOR for requested publication window",
                )
                return run.id

            identity_map = self.ingestion_repo.save_raw_records(records, run.id)
            for r in records:
                r["raw_record_id"] = identity_map.get(r["source_identity"])

            for r in records:
                for w in r.get("warnings", []):
                    self.quality_repo.record_issue(
                        dataset="WINDFOR",
                        issue_type=w,
                        description=f"Forecast {r['source_identity']} triggered validation flag {w}",
                        severity="WARNING",
                        record_identifier=r["source_identity"],
                        ingestion_run_id=run.id,
                    )

            inserted, updated, duplicates = self.forecast_repo.upsert_records(records, run.id)

            self.ingestion_repo.complete_run(
                run_id=run.id,
                status="SUCCESS",
                fetched=fetched_count,
                inserted=inserted,
                updated=updated,
                duplicates=duplicates,
                rejected=0,
            )
            logger.info(
                f"Completed WINDFOR ingestion run {run.id}: +{inserted}, ~{updated}, ={duplicates}"
            )
            return run.id

        except Exception as exc:
            logger.error(f"WINDFOR ingestion run {run.id} failed: {exc}", exc_info=True)
            self.ingestion_repo.complete_run(
                run_id=run.id,
                status="FAILED",
                fetched=0,
                inserted=0,
                updated=0,
                duplicates=0,
                rejected=0,
                error_summary=str(exc),
            )
            raise

    def execute_backfill(
        self,
        decision_from: date,
        decision_to: date,
        fuel_client: FuelHHClient | None = None,
        windfor_client: WindforClient | None = None,
    ) -> dict[str, Any]:
        """Perform full historical backfill covering decision dates from decision_from to decision_to.

        Derives required delivery range and publication lookback windows from business rules.
        """
        # Delivery dates
        delivery_start = derive_delivery_date(decision_from, self.settings.DECISION_LEAD_DAYS)
        delivery_end = derive_delivery_date(decision_to, self.settings.DECISION_LEAD_DAYS)

        # Publication window: earliest cutoff minus lookback hours up to latest delivery end
        earliest_cutoff = compute_decision_cutoff_utc(decision_from)
        lookback_start = earliest_cutoff - timedelta(hours=self.settings.FORECAST_LOOKBACK_HOURS)
        # We also ingest up to delivery_end to allow forecast evolution analysis
        publication_end = parse_to_utc_datetime(
            datetime.combine(delivery_end + timedelta(days=1), datetime.min.time())
        )

        logger.info(
            f"Executing Backfill: Decisions {decision_from} to {decision_to} | "
            f"Deliveries {delivery_start} to {delivery_end} | "
            f"Publications {lookback_start.isoformat()} to {publication_end.isoformat()}"
        )

        # 1. Ingest Actuals
        actual_run_id = self.ingest_actuals_range(delivery_start, delivery_end, client=fuel_client)

        # 2. Ingest Forecasts
        forecast_run_id = self.ingest_forecasts_range(
            lookback_start, publication_end, client=windfor_client
        )

        return {
            "decision_from": decision_from.isoformat(),
            "decision_to": decision_to.isoformat(),
            "delivery_start": delivery_start.isoformat(),
            "delivery_end": delivery_end.isoformat(),
            "actual_run_id": actual_run_id,
            "forecast_run_id": forecast_run_id,
        }
