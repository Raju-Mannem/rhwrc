"""Critical Temporal Regression Test.

Validates that:
1. Decision snapshots select ONLY forecast vintages published at or before the decision cutoff.
2. Forecasts published after the decision cutoff are strictly excluded from the decision snapshot.
3. Adding or updating post-cutoff forecasts CANNOT mutate the historical decision's selected forecast or accuracy metrics.
"""

from datetime import UTC, date, datetime

from sqlalchemy.orm import Session

from app.repositories.actual_repo import ActualRepository
from app.repositories.forecast_repo import ForecastRepository
from app.services.normalization.normalizer import compute_decision_cutoff_utc
from app.services.snapshots.snapshot_engine import SnapshotEngine


def test_critical_temporal_leakage_regression(test_db_session: Session):
    """Verify that future forecasts cannot leak into a historical decision snapshot."""
    decision_date = date(2026, 1, 15)
    delivery_date = date(2026, 1, 16)
    interval_utc = datetime(2026, 1, 16, 12, 0, tzinfo=UTC)

    forecast_repo = ForecastRepository(test_db_session)
    actual_repo = ActualRepository(test_db_session)
    engine = SnapshotEngine(test_db_session)

    # 1. Ingest an eligible forecast published BEFORE cutoff (07:30 UTC) -> 12,000 MW
    forecast_repo.upsert_records(
        [
            {
                "start_time_utc": interval_utc,
                "publish_time_utc": datetime(2026, 1, 15, 7, 30, tzinfo=UTC),
                "generation_mw": 12000.0,
                "source_identity": "WINDFOR:2026-01-15T07:30:00Z:2026-01-16T12:00:00Z",
            }
        ]
    )

    # 2. Ingest another eligible forecast published closer to cutoff (09:30 UTC) -> 12,500 MW
    forecast_repo.upsert_records(
        [
            {
                "start_time_utc": interval_utc,
                "publish_time_utc": datetime(2026, 1, 15, 9, 30, tzinfo=UTC),
                "generation_mw": 12500.0,
                "source_identity": "WINDFOR:2026-01-15T09:30:00Z:2026-01-16T12:00:00Z",
            }
        ]
    )

    # 3. Ingest a forecast published AFTER the cutoff (14:30 UTC) -> 14,000 MW
    forecast_repo.upsert_records(
        [
            {
                "start_time_utc": interval_utc,
                "publish_time_utc": datetime(2026, 1, 15, 14, 30, tzinfo=UTC),
                "generation_mw": 14000.0,
                "source_identity": "WINDFOR:2026-01-15T14:30:00Z:2026-01-16T12:00:00Z",
            }
        ]
    )

    # 4. Ingest an outturn actual generation -> 13,000 MW
    actual_repo.upsert_records(
        [
            {
                "start_time_utc": interval_utc,
                "settlement_date": delivery_date,
                "settlement_period": 25,
                "fuel_type": "WIND",
                "generation_mw": 13000.0,
                "source_identity": f"FUELHH:{interval_utc.isoformat()}:WIND",
            }
        ]
    )

    # Build snapshot
    snapshot1 = engine.build_snapshot_for_date(decision_date, force_rebuild=True)
    target_iv1 = next(iv for iv in snapshot1.intervals if iv.start_time_utc == interval_utc)

    # PROVE: Selected forecast must be 12,500 MW (published at 09:30 UTC <= 10:00 UTC)
    # NOT 14,000 MW (published after cutoff at 14:30 UTC)!
    assert target_iv1.forecast_mw == 12500.0
    assert target_iv1.forecast_publish_time_utc == datetime(2026, 1, 15, 9, 30, tzinfo=UTC)
    # Signed error = F - A = 12500 - 13000 = -500 MW (underforecast)
    assert target_iv1.signed_error_mw == -500.0

    # 5. Now simulate the arrival of an even later forecast published on delivery day!
    # (e.g. 2026-01-16 06:00 UTC -> 13,100 MW, which is much closer to actual)
    forecast_repo.upsert_records(
        [
            {
                "start_time_utc": interval_utc,
                "publish_time_utc": datetime(2026, 1, 16, 6, 0, tzinfo=UTC),
                "generation_mw": 13100.0,
                "source_identity": "WINDFOR:2026-01-16T06:00:00Z:2026-01-16T12:00:00Z",
            }
        ]
    )

    # Rebuild snapshot from stored data
    snapshot2 = engine.build_snapshot_for_date(decision_date, force_rebuild=True)
    target_iv2 = next(iv for iv in snapshot2.intervals if iv.start_time_utc == interval_utc)

    # PROVE: Historical decision snapshot remains UNMUTATED at 12,500 MW!
    assert target_iv2.forecast_mw == 12500.0
    assert target_iv2.forecast_publish_time_utc == datetime(2026, 1, 15, 9, 30, tzinfo=UTC)
    assert target_iv2.signed_error_mw == -500.0


def test_forecast_published_exactly_at_cutoff(test_db_session: Session):
    """Under default inclusive policy, a forecast published exactly at the cutoff IS eligible."""
    decision_date = date(2026, 1, 20)
    cutoff_utc = compute_decision_cutoff_utc(decision_date)  # 10:00:00 UTC
    interval_utc = datetime(2026, 1, 21, 14, 0, tzinfo=UTC)

    forecast_repo = ForecastRepository(test_db_session)
    engine = SnapshotEngine(test_db_session)

    # Published exactly at 10:00:00 UTC
    forecast_repo.upsert_records(
        [
            {
                "start_time_utc": interval_utc,
                "publish_time_utc": cutoff_utc,
                "generation_mw": 9999.0,
                "source_identity": "WINDFOR:AT_CUTOFF",
            }
        ]
    )

    snapshot = engine.build_snapshot_for_date(decision_date, force_rebuild=True)
    target_iv = next(iv for iv in snapshot.intervals if iv.start_time_utc == interval_utc)

    assert target_iv.forecast_mw == 9999.0
    assert target_iv.forecast_publish_time_utc == cutoff_utc
