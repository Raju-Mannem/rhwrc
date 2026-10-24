"""Decision Snapshot Selection Engine.

Constructs reproducible historical decision-time forecast snapshots.
Guarantees that no forecast published after the decision cutoff can leak
into an earlier day-ahead procurement decision.
"""

from collections import defaultdict
from datetime import date, datetime

from sqlalchemy.orm import Session

from app.core.config import get_settings
from app.core.logging import get_logger
from app.db.models.decision_snapshot import DecisionSnapshot, DecisionSnapshotInterval
from app.repositories.actual_repo import ActualRepository
from app.repositories.forecast_repo import ForecastRepository
from app.repositories.snapshot_repo import SnapshotRepository
from app.services.metrics.metrics_engine import (
    compute_absolute_error,
    compute_energy_error_mwh,
    compute_signed_error,
)
from app.services.normalization.normalizer import (
    build_expected_delivery_intervals,
    compute_decision_cutoff_utc,
    derive_delivery_date,
)

logger = get_logger(__name__)


class SnapshotEngine:
    """Engine for selecting eligible forecasts at purchasing cutoff and building snapshots."""

    def __init__(self, db: Session) -> None:
        self.db = db
        self.snapshot_repo = SnapshotRepository(db)
        self.forecast_repo = ForecastRepository(db)
        self.actual_repo = ActualRepository(db)
        self.settings = get_settings()

    def select_forecasts_for_cutoff(
        self,
        cutoff_utc: datetime,
        expected_intervals: list[datetime],
        selection_policy: str = "latest_complete_publication",
    ) -> tuple[dict[datetime, tuple[float, datetime]], str, datetime | None, str]:
        """Pure selection routine: returns {interval_utc: (forecast_mw, publish_time_utc)},

        applied_policy, selected_publication_time_utc, completeness_status.
        """
        # Build candidate interval list (including hourly floor if step forward is active)
        query_intervals = set(expected_intervals)
        if self.settings.FORECAST_INTERVAL_ALIGNMENT == "STEP_FORWARD":
            for dt in expected_intervals:
                # Add hour start :00
                hour_start = dt.replace(minute=0, second=0, microsecond=0)
                query_intervals.add(hour_start)

        eligible_records = self.forecast_repo.get_eligible_forecasts_for_cutoff(
            cutoff_utc=cutoff_utc,
            interval_starts=list(query_intervals),
            inclusive=self.settings.DECISION_CUTOFF_INCLUSIVE,
        )

        if not eligible_records:
            return {}, selection_policy, None, "INCOMPLETE"

        # Group eligible records by publication timestamp
        publications: dict[datetime, dict[datetime, float]] = defaultdict(dict)
        for rec in eligible_records:
            publications[rec.publish_time_utc][rec.start_time_utc] = rec.generation_mw

        threshold = self.settings.SNAPSHOT_COMPLETENESS_THRESHOLD
        expected_count = len(expected_intervals)

        # Helper to look up an interval in a publication's records
        def get_from_pub(pub_map: dict[datetime, float], interval_dt: datetime) -> float | None:
            if interval_dt in pub_map:
                return pub_map[interval_dt]
            if self.settings.FORECAST_INTERVAL_ALIGNMENT == "STEP_FORWARD":
                hour_start = interval_dt.replace(minute=0, second=0, microsecond=0)
                if hour_start in pub_map:
                    return pub_map[hour_start]
            return None

        # Preferred policy: latest_complete_publication
        if selection_policy == "latest_complete_publication":
            qualifying_pubs: list[tuple[datetime, int]] = []
            for pub_time in sorted(publications.keys(), reverse=True):
                pub_map = publications[pub_time]
                covered = sum(
                    1 for dt in expected_intervals if get_from_pub(pub_map, dt) is not None
                )
                if (covered / expected_count) >= threshold:
                    qualifying_pubs.append((pub_time, covered))

            if qualifying_pubs:
                best_pub_time, best_covered = qualifying_pubs[0]
                pub_map = publications[best_pub_time]
                selected_forecasts: dict[datetime, tuple[float, datetime]] = {}
                for dt in expected_intervals:
                    val = get_from_pub(pub_map, dt)
                    if val is not None:
                        selected_forecasts[dt] = (val, best_pub_time)

                status = "COMPLETE" if best_covered >= expected_count else "MIXED_OR_PARTIAL"
                return selected_forecasts, "latest_complete_publication", best_pub_time, status

        # Fallback policy: latest_per_interval
        selected_forecasts = {}
        for dt in expected_intervals:
            candidates: list[tuple[datetime, float]] = []
            for rec in eligible_records:
                if rec.start_time_utc == dt:
                    candidates.append((rec.publish_time_utc, rec.generation_mw))
                elif self.settings.FORECAST_INTERVAL_ALIGNMENT == "STEP_FORWARD":
                    hour_start = dt.replace(minute=0, second=0, microsecond=0)
                    if rec.start_time_utc == hour_start:
                        candidates.append((rec.publish_time_utc, rec.generation_mw))

            if candidates:
                # pick the latest publication for this interval
                candidates.sort(key=lambda x: x[0], reverse=True)
                latest_pub, gen_mw = candidates[0]
                selected_forecasts[dt] = (gen_mw, latest_pub)

        covered_count = len(selected_forecasts)
        status = (
            "COMPLETE"
            if covered_count == expected_count
            else ("MIXED_OR_PARTIAL" if covered_count > 0 else "INCOMPLETE")
        )
        return selected_forecasts, "latest_per_interval", None, status

    def build_snapshot_for_date(
        self,
        decision_date: date,
        selection_policy: str | None = None,
        force_rebuild: bool = False,
    ) -> DecisionSnapshot:
        """Construct, persist, and return the official decision snapshot for a given decision date."""
        policy = selection_policy or self.settings.FORECAST_SELECTION_POLICY

        if not force_rebuild:
            existing = self.snapshot_repo.get_snapshot_by_decision_date(
                decision_date=decision_date,
                selection_policy=policy,
            )
            if existing:
                return existing

        delivery_date = derive_delivery_date(decision_date, self.settings.DECISION_LEAD_DAYS)
        cutoff_utc = compute_decision_cutoff_utc(decision_date)
        expected_intervals = build_expected_delivery_intervals(delivery_date)

        (
            selected_forecasts,
            applied_policy,
            selected_pub_time,
            completeness_status,
        ) = self.select_forecasts_for_cutoff(
            cutoff_utc=cutoff_utc,
            expected_intervals=expected_intervals,
            selection_policy=policy,
        )

        # Retrieve actuals for matching
        actuals = self.actual_repo.get_actuals_for_intervals(expected_intervals, fuel_type="WIND")

        snapshot = DecisionSnapshot(
            decision_date=decision_date,
            decision_cutoff_utc=cutoff_utc,
            decision_cutoff_local_time=f"{self.settings.DECISION_CUTOFF_LOCAL_TIME} {self.settings.DECISION_TIMEZONE}",
            delivery_date=delivery_date,
            selection_policy=applied_policy,
            selected_publication_time_utc=selected_pub_time,
            completeness_status=completeness_status,
            expected_intervals=len(expected_intervals),
            matched_intervals=0,
            missing_intervals=0,
            coverage_ratio=0.0,
            calculation_version="1.0",
        )

        matched_count = 0
        interval_rows: list[DecisionSnapshotInterval] = []

        for dt in expected_intervals:
            forecast_tuple = selected_forecasts.get(dt)
            actual_mw = actuals.get(dt)

            if forecast_tuple is not None and actual_mw is not None:
                forecast_mw, pub_time = forecast_tuple
                signed_err = compute_signed_error(forecast_mw, actual_mw)
                abs_err = compute_absolute_error(forecast_mw, actual_mw)
                energy_err = compute_energy_error_mwh(forecast_mw, actual_mw, duration_hours=0.5)
                match_status = "MATCHED"
                matched_count += 1
            elif forecast_tuple is not None:
                forecast_mw, pub_time = forecast_tuple
                signed_err = None
                abs_err = None
                energy_err = None
                match_status = "MISSING_ACTUAL"
            elif actual_mw is not None:
                forecast_mw = None
                pub_time = None
                signed_err = None
                abs_err = None
                energy_err = None
                match_status = "MISSING_FORECAST"
            else:
                forecast_mw = None
                pub_time = None
                signed_err = None
                abs_err = None
                energy_err = None
                match_status = "MISSING_BOTH"

            interval_rows.append(
                DecisionSnapshotInterval(
                    start_time_utc=dt,
                    forecast_mw=forecast_mw,
                    actual_mw=actual_mw,
                    signed_error_mw=signed_err,
                    absolute_error_mw=abs_err,
                    error_mwh=energy_err,
                    forecast_publish_time_utc=pub_time,
                    match_status=match_status,
                )
            )

        snapshot.matched_intervals = matched_count
        snapshot.missing_intervals = len(expected_intervals) - matched_count
        snapshot.coverage_ratio = (
            round(matched_count / len(expected_intervals), 4) if expected_intervals else 0.0
        )

        saved = self.snapshot_repo.save_snapshot(snapshot, interval_rows)
        logger.info(
            f"Built snapshot for decision {decision_date} (delivery {delivery_date}): "
            f"{matched_count}/{len(expected_intervals)} matched [{completeness_status}]"
        )
        return saved
