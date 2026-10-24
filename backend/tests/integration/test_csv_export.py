"""CSV Export and Formula Injection Tests."""

import csv
import io
from datetime import UTC, date, datetime

from app.db.models.decision_snapshot import DecisionSnapshot, DecisionSnapshotInterval
from app.services.exports.csv_exporter import (
    export_snapshot_intervals_to_csv,
    sanitize_csv_field,
)


def test_csv_formula_injection_sanitization():
    """Verify formula injection sanitization on untrusted text fields."""
    assert sanitize_csv_field("=cmd|'/C calc'!A0") == "'=cmd|'/C calc'!A0"
    assert sanitize_csv_field("+12345") == "'+12345"
    assert sanitize_csv_field("-SUM(A1:A10)") == "'-SUM(A1:A10)"
    assert sanitize_csv_field("@SUM(B1:B5)") == "'@SUM(B1:B5)"
    assert sanitize_csv_field("Normal Text") == "Normal Text"


def test_csv_reconciliation_with_snapshot():
    """Verify that every field in the exported CSV accurately reconciles with snapshot intervals."""
    snapshot = DecisionSnapshot(
        decision_date=date(2026, 1, 15),
        decision_cutoff_utc=datetime(2026, 1, 15, 10, 0, tzinfo=UTC),
        decision_cutoff_local_time="10:00 Europe/London",
        delivery_date=date(2026, 1, 16),
        selection_policy="latest_complete_publication",
        completeness_status="COMPLETE",
        expected_intervals=2,
        matched_intervals=2,
        missing_intervals=0,
        coverage_ratio=1.0,
    )

    iv1 = DecisionSnapshotInterval(
        start_time_utc=datetime(2026, 1, 16, 0, 0, tzinfo=UTC),
        forecast_mw=12000.0,
        actual_mw=11500.0,
        signed_error_mw=500.0,
        absolute_error_mw=500.0,
        error_mwh=250.0,
        forecast_publish_time_utc=datetime(2026, 1, 15, 8, 0, tzinfo=UTC),
        match_status="MATCHED",
    )
    iv2 = DecisionSnapshotInterval(
        start_time_utc=datetime(2026, 1, 16, 0, 30, tzinfo=UTC),
        forecast_mw=12200.0,
        actual_mw=12200.0,
        signed_error_mw=0.0,
        absolute_error_mw=0.0,
        error_mwh=0.0,
        forecast_publish_time_utc=datetime(2026, 1, 15, 8, 0, tzinfo=UTC),
        match_status="MATCHED",
    )
    snapshot.intervals = [iv1, iv2]

    csv_text = export_snapshot_intervals_to_csv(snapshot)
    reader = csv.DictReader(io.StringIO(csv_text))
    rows = list(reader)

    assert len(rows) == 2
    assert rows[0]["decision_date"] == "2026-01-15"
    assert rows[0]["forecast_mw"] == "12000.00"
    assert rows[0]["actual_mw"] == "11500.00"
    assert rows[0]["signed_error_mw"] == "500.00"
    assert rows[0]["error_mwh"] == "250.00"
    assert rows[0]["match_status"] == "MATCHED"

    assert rows[1]["signed_error_mw"] == "0.00"
    assert rows[1]["error_mwh"] == "0.00"
