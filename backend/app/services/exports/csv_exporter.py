"""CSV Interval Export Service with Formula Injection Sanitization."""

import csv
import io

from app.db.models.decision_snapshot import DecisionSnapshot


def sanitize_csv_field(val: str | None) -> str:
    """Sanitize text to prevent CSV formula injection in spreadsheet applications."""
    if not val:
        return ""
    str_val = str(val).strip()
    if str_val.startswith(("=", "+", "-", "@", "\t", "\r")):
        return f"'{str_val}"
    return str_val


def export_snapshot_intervals_to_csv(snapshot: DecisionSnapshot) -> str:
    """Serialize decision snapshot intervals to a secure, deterministic CSV string."""
    output = io.StringIO()
    writer = csv.writer(output, lineterminator="\n", quoting=csv.QUOTE_MINIMAL)

    # Standard header
    headers = [
        "start_time_utc",
        "decision_date",
        "decision_cutoff_utc",
        "decision_cutoff_local",
        "delivery_date",
        "selection_policy",
        "selected_publish_time_utc",
        "forecast_mw",
        "actual_mw",
        "signed_error_mw",
        "absolute_error_mw",
        "error_mwh",
        "match_status",
    ]
    writer.writerow(headers)

    decision_date_str = snapshot.decision_date.isoformat()
    cutoff_utc_str = snapshot.decision_cutoff_utc.isoformat()
    cutoff_local_str = sanitize_csv_field(snapshot.decision_cutoff_local_time)
    delivery_date_str = snapshot.delivery_date.isoformat()
    policy_str = sanitize_csv_field(snapshot.selection_policy)

    for iv in snapshot.intervals:
        pub_time_str = (
            iv.forecast_publish_time_utc.isoformat() if iv.forecast_publish_time_utc else ""
        )
        writer.writerow(
            [
                iv.start_time_utc.isoformat(),
                decision_date_str,
                cutoff_utc_str,
                cutoff_local_str,
                delivery_date_str,
                policy_str,
                pub_time_str,
                f"{iv.forecast_mw:.2f}" if iv.forecast_mw is not None else "",
                f"{iv.actual_mw:.2f}" if iv.actual_mw is not None else "",
                f"{iv.signed_error_mw:.2f}" if iv.signed_error_mw is not None else "",
                f"{iv.absolute_error_mw:.2f}" if iv.absolute_error_mw is not None else "",
                f"{iv.error_mwh:.2f}" if iv.error_mwh is not None else "",
                sanitize_csv_field(iv.match_status),
            ]
        )

    return output.getvalue()
