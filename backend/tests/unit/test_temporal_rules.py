"""Unit Tests for Temporal Rules, Calendar Arithmetic, and DST Boundaries."""

from datetime import UTC, date, datetime

from app.services.normalization.normalizer import (
    build_expected_delivery_intervals,
    compute_decision_cutoff_utc,
    derive_decision_date_from_delivery,
    derive_delivery_date,
    parse_to_utc_datetime,
)


def test_standard_winter_day_interval_count():
    """A standard winter UK day (e.g. 2026-01-15) has 24 hours = 48 half-hourly intervals."""
    intervals = build_expected_delivery_intervals(date(2026, 1, 15))
    assert len(intervals) == 48

    # First interval at midnight UTC
    assert intervals[0] == datetime(2026, 1, 15, 0, 0, tzinfo=UTC)
    # Last interval at 23:30 UTC
    assert intervals[-1] == datetime(2026, 1, 15, 23, 30, tzinfo=UTC)


def test_dst_spring_forward_boundary():
    """In UK (Europe/London), clocks spring forward on the last Sunday of March.

    In 2026, the transition occurs on 2026-03-29 (23-hour day = 46 half-hourly intervals).
    """
    intervals = build_expected_delivery_intervals(date(2026, 3, 29))
    assert len(intervals) == 46


def test_dst_autumn_fall_back_boundary():
    """In UK (Europe/London), clocks fall back on the last Sunday of October.

    In 2026, the transition occurs on 2026-10-25 (25-hour day = 50 half-hourly intervals).
    """
    intervals = build_expected_delivery_intervals(date(2026, 10, 25))
    assert len(intervals) == 50


def test_decision_cutoff_winter_vs_summer():
    """Verify Europe/London local cutoff time converts correctly to UTC across seasons.

    Winter: GMT (UTC+0). 10:00 Europe/London -> 10:00:00 UTC.
    Summer: BST (UTC+1). 10:00 Europe/London -> 09:00:00 UTC.
    """
    # Winter cutoff
    winter_cutoff = compute_decision_cutoff_utc(
        decision_date=date(2026, 1, 15),
        local_time="10:00",
        tz_str="Europe/London",
    )
    assert winter_cutoff == datetime(2026, 1, 15, 10, 0, 0, tzinfo=UTC)

    # Summer cutoff
    summer_cutoff = compute_decision_cutoff_utc(
        decision_date=date(2026, 7, 15),
        local_time="10:00",
        tz_str="Europe/London",
    )
    assert summer_cutoff == datetime(2026, 7, 15, 9, 0, 0, tzinfo=UTC)


def test_lead_time_derivation():
    """Verify delivery date derivation from decision date with configurable lead time."""
    # 1 calendar day lead time
    delivery = derive_delivery_date(date(2026, 1, 1), lead_days=1)
    assert delivery == date(2026, 1, 2)

    # Derivation in reverse
    decision = derive_decision_date_from_delivery(date(2026, 1, 2), lead_days=1)
    assert decision == date(2026, 1, 1)

    # Custom lead time (e.g. 2 days ahead)
    assert derive_delivery_date(date(2026, 1, 1), lead_days=2) == date(2026, 1, 3)


def test_timestamp_parser_to_utc():
    """Ensure ambiguous or formatted timestamps are strictly converted to UTC."""
    # ISO string with Z
    dt1 = parse_to_utc_datetime("2026-01-01T12:00:00Z")
    assert dt1.tzinfo == UTC
    assert dt1.hour == 12

    # ISO string with +02:00 offset
    dt2 = parse_to_utc_datetime("2026-01-01T14:00:00+02:00")
    assert dt2.tzinfo == UTC
    assert dt2.hour == 12  # 14:00+02:00 is 12:00 UTC
