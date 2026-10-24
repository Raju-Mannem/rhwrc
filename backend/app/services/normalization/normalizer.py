"""Data Normalization, Temporal Calendar Math, and Record Validation."""

import hashlib
import json
from datetime import UTC, date, datetime, time, timedelta
from typing import Any
from zoneinfo import ZoneInfo

from app.core.config import get_settings


def parse_to_utc_datetime(dt_val: str | datetime) -> datetime:
    """Ensure any date string or datetime is parsed to an unambiguous timezone-aware UTC datetime."""
    if isinstance(dt_val, datetime):
        if dt_val.tzinfo is None:
            return dt_val.replace(tzinfo=UTC)
        return dt_val.astimezone(UTC)

    # Clean standard ISO strings (e.g. 2026-01-01T00:00:00Z or +00:00)
    cleaned = dt_val.strip().replace("Z", "+00:00")
    # Handle space in place of '+' resulting from HTTP URL query string decoding
    if " " in cleaned and "+" not in cleaned[10:]:
        parts = cleaned.rsplit(" ", 1)
        if len(parts) == 2 and ":" in parts[1] and ("T" in parts[0] or "-" in parts[0]):
            cleaned = f"{parts[0]}+{parts[1]}"
        else:
            cleaned = cleaned.replace(" ", "T")

    try:
        dt = datetime.fromisoformat(cleaned)
    except Exception as err:
        raise ValueError(f"Invalid timestamp format: '{dt_val}'") from err

    if dt.tzinfo is None:
        return dt.replace(tzinfo=UTC)
    return dt.astimezone(UTC)


def compute_payload_hash(payload: dict[str, Any]) -> str:
    """Compute deterministic SHA-256 hash of JSON payload."""
    serialized = json.dumps(payload, sort_keys=True, separators=(",", ":"))
    return hashlib.sha256(serialized.encode("utf-8")).hexdigest()


def compute_decision_cutoff_utc(
    decision_date: date,
    local_time: str | None = None,
    tz_str: str | None = None,
) -> datetime:
    """Compute timezone-aware decision cutoff instant in UTC.

    For example, for 2026-01-01 in Europe/London at 10:00,
    the cutoff instant is 2026-01-01 10:00:00 GMT -> 2026-01-01 10:00:00 UTC.
    In summer BST, 10:00 BST -> 09:00:00 UTC.
    """
    settings = get_settings()
    local_time_str = local_time or settings.DECISION_CUTOFF_LOCAL_TIME
    timezone_name = tz_str or settings.DECISION_TIMEZONE

    tz = ZoneInfo(timezone_name)
    h, m = map(int, local_time_str.split(":"))

    # Local midnight + cutoff time in target timezone
    local_instant = datetime.combine(decision_date, time(hour=h, minute=m), tzinfo=tz)
    return local_instant.astimezone(UTC)


def derive_delivery_date(decision_date: date, lead_days: int | None = None) -> date:
    """Derive delivery date from decision date by applying lead time (default 1 calendar day)."""
    settings = get_settings()
    lead = lead_days if lead_days is not None else settings.DECISION_LEAD_DAYS
    return decision_date + timedelta(days=lead)


def derive_decision_date_from_delivery(delivery_date: date, lead_days: int | None = None) -> date:
    """Derive decision date from delivery date."""
    settings = get_settings()
    lead = lead_days if lead_days is not None else settings.DECISION_LEAD_DAYS
    return delivery_date - timedelta(days=lead)


def build_expected_delivery_intervals(
    delivery_date: date,
    tz_str: str | None = None,
    resolution_minutes: int = 30,
) -> list[datetime]:
    """Build the expected half-hourly calendar intervals for a delivery date in Europe/London.

    Uses timezone-aware calendar math so that DST transition days properly yield
    46 (spring forward 23h) or 50 (fall back 25h) intervals, and standard days yield 48.
    All returned datetimes are normalized to UTC.
    """
    settings = get_settings()
    timezone_name = tz_str or settings.DECISION_TIMEZONE
    tz = ZoneInfo(timezone_name)

    # Start of day in local timezone
    start_local = datetime.combine(delivery_date, time.min, tzinfo=tz)
    # Start of next day in local timezone
    end_local = datetime.combine(delivery_date + timedelta(days=1), time.min, tzinfo=tz)

    start_utc = start_local.astimezone(UTC)
    end_utc = end_local.astimezone(UTC)

    intervals: list[datetime] = []
    current_utc = start_utc
    step = timedelta(minutes=resolution_minutes)

    while current_utc < end_utc:
        intervals.append(current_utc)
        current_utc += step

    return intervals


def validate_generation_value(val: Any) -> tuple[float | None, list[str]]:
    """Validate generation value.

    Returns (normalized_float, list_of_warning_flags).
    Distinguishes legitimate 0.0 from missing data (None).
    Flags suspicious values like negative power or values > 40,000 MW.
    """
    if val is None:
        return None, ["MISSING_GENERATION"]

    try:
        f_val = float(val)
    except (TypeError, ValueError):
        return None, ["NON_NUMERIC_GENERATION"]

    warnings: list[str] = []
    if f_val < 0.0:
        warnings.append("NEGATIVE_GENERATION")
    elif f_val > 40000.0:  # UK total wind capacity is ~30 GW; 40 GW is an extreme anomaly
        warnings.append("UNUSUALLY_HIGH_GENERATION")

    return f_val, warnings
