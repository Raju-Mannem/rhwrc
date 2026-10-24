"""Unit Tests for Snapshot Selection Engine."""

from datetime import UTC, date, datetime

from sqlalchemy.orm import Session

from app.repositories.forecast_repo import ForecastRepository
from app.services.normalization.normalizer import build_expected_delivery_intervals
from app.services.snapshots.snapshot_engine import SnapshotEngine


def test_latest_complete_publication_selection(test_db_session: Session):
    """Verify that latest_complete_publication selects the latest publication version covering intervals."""
    cutoff_utc = datetime(2026, 1, 10, 10, 0, tzinfo=UTC)
    delivery_date = date(2026, 1, 11)
    expected_intervals = build_expected_delivery_intervals(delivery_date)

    forecast_repo = ForecastRepository(test_db_session)
    engine = SnapshotEngine(test_db_session)

    # Ingest Publication A at 06:00 UTC covering all intervals
    pub_a_time = datetime(2026, 1, 10, 6, 0, tzinfo=UTC)
    recs_a = [
        {
            "start_time_utc": dt,
            "publish_time_utc": pub_a_time,
            "generation_mw": 8000.0,
            "source_identity": f"A:{dt.isoformat()}",
        }
        for dt in expected_intervals
    ]
    forecast_repo.upsert_records(recs_a)

    # Ingest Publication B at 08:30 UTC also covering all intervals with newer forecasts
    pub_b_time = datetime(2026, 1, 10, 8, 30, tzinfo=UTC)
    recs_b = [
        {
            "start_time_utc": dt,
            "publish_time_utc": pub_b_time,
            "generation_mw": 8500.0,
            "source_identity": f"B:{dt.isoformat()}",
        }
        for dt in expected_intervals
    ]
    forecast_repo.upsert_records(recs_b)

    selected, policy, best_pub, status = engine.select_forecasts_for_cutoff(
        cutoff_utc=cutoff_utc,
        expected_intervals=expected_intervals,
        selection_policy="latest_complete_publication",
    )

    assert policy == "latest_complete_publication"
    assert best_pub == pub_b_time
    assert status == "COMPLETE"
    assert len(selected) == len(expected_intervals)
    assert all(val[0] == 8500.0 for val in selected.values())


def test_fallback_to_latest_per_interval(test_db_session: Session):
    """When no single publication covers threshold, fallback policy constructs latest per interval."""
    cutoff_utc = datetime(2026, 1, 12, 10, 0, tzinfo=UTC)
    delivery_date = date(2026, 1, 13)
    expected_intervals = build_expected_delivery_intervals(delivery_date)

    forecast_repo = ForecastRepository(test_db_session)
    engine = SnapshotEngine(test_db_session)

    # Publication A covers first 10 intervals
    pub_a = datetime(2026, 1, 12, 5, 0, tzinfo=UTC)
    recs_a = [
        {
            "start_time_utc": expected_intervals[i],
            "publish_time_utc": pub_a,
            "generation_mw": 5000.0,
            "source_identity": f"A:{i}",
        }
        for i in range(10)
    ]
    forecast_repo.upsert_records(recs_a)

    # Publication B covers remaining intervals
    pub_b = datetime(2026, 1, 12, 7, 0, tzinfo=UTC)
    recs_b = [
        {
            "start_time_utc": expected_intervals[i],
            "publish_time_utc": pub_b,
            "generation_mw": 6000.0,
            "source_identity": f"B:{i}",
        }
        for i in range(10, len(expected_intervals))
    ]
    forecast_repo.upsert_records(recs_b)

    selected, policy, best_pub, status = engine.select_forecasts_for_cutoff(
        cutoff_utc=cutoff_utc,
        expected_intervals=expected_intervals,
        selection_policy="latest_complete_publication",
    )

    # Neither pub covers >= 95% -> fallback applied
    assert policy == "latest_per_interval"
    assert best_pub is None
    assert status in ("COMPLETE", "MIXED_OR_PARTIAL")
    assert len(selected) == len(expected_intervals)
