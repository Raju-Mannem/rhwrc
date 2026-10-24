"""Elexon WINDFOR Forecast Generation Client.

Queries /datasets/WINDFOR/stream across explicit publication-time windows
and preserves all historical publication versions.
"""

from datetime import datetime, timedelta
from typing import Any

from app.core.exceptions import ElexonSourceError
from app.core.logging import get_logger
from app.services.elexon.client_base import ElexonBaseClient
from app.services.normalization.normalizer import (
    compute_payload_hash,
    parse_to_utc_datetime,
    validate_generation_value,
)

logger = get_logger(__name__)


class WindforClient(ElexonBaseClient):
    """Client for Elexon WINDFOR (National Wind Generation Forecast) stream endpoint."""

    def fetch_forecasts_window(
        self,
        publish_from_utc: datetime,
        publish_to_utc: datetime,
    ) -> list[dict[str, Any]]:
        """Fetch WINDFOR forecast records published within a specific publication-time window."""
        path = "/datasets/WINDFOR/stream"
        params = {
            "publishDateTimeFrom": publish_from_utc.strftime("%Y-%m-%dT%H:%M:%SZ"),
            "publishDateTimeTo": publish_to_utc.strftime("%Y-%m-%dT%H:%M:%SZ"),
        }

        logger.debug(
            f"Querying WINDFOR publications between {params['publishDateTimeFrom']} and {params['publishDateTimeTo']}"
        )
        raw_response = self.get(path, params=params)

        if not isinstance(raw_response, list):
            raise ElexonSourceError(
                message=f"Expected list response from WINDFOR, got {type(raw_response).__name__}",
                dataset="WINDFOR",
            )

        records: list[dict[str, Any]] = []

        for item in raw_response:
            if not isinstance(item, dict):
                continue

            publish_time_raw = item.get("publishTime")
            start_time_raw = item.get("startTime")

            if not publish_time_raw or not start_time_raw:
                logger.warning(f"WINDFOR record missing publishTime or startTime: {item}")
                continue

            try:
                publish_time_utc = parse_to_utc_datetime(publish_time_raw)
                start_time_utc = parse_to_utc_datetime(start_time_raw)
            except Exception as err:
                logger.warning(f"Timestamp parsing error in WINDFOR: {err}")
                continue

            gen_raw = item.get("generation")
            gen_mw, warnings = validate_generation_value(gen_raw)
            if gen_mw is None:
                logger.warning(f"Invalid generation in WINDFOR: {gen_raw}")
                continue

            # Natural key includes both delivery start time AND publication time
            source_identity = f"WINDFOR:{publish_time_utc.isoformat()}:{start_time_utc.isoformat()}"
            p_hash = compute_payload_hash(item)

            records.append(
                {
                    "dataset": "WINDFOR",
                    "source_identity": source_identity,
                    "payload_hash": p_hash,
                    "raw_payload": item,
                    "publish_time_utc": publish_time_utc,
                    "start_time_utc": start_time_utc,
                    "generation_mw": gen_mw,
                    "warnings": warnings,
                }
            )

        return records

    def fetch_forecasts_in_chunks(
        self,
        publish_from_utc: datetime,
        publish_to_utc: datetime,
        chunk_hours: int = 24,
    ) -> list[dict[str, Any]]:
        """Fetch forecasts across a wide publication window by subdividing into manageable chunks.

        Prevents upstream connection timeouts and respects rate limits.
        """
        all_records: list[dict[str, Any]] = []
        current_start = publish_from_utc
        step = timedelta(hours=chunk_hours)

        logger.info(
            f"Fetching WINDFOR forecast publications from {publish_from_utc.isoformat()} "
            f"to {publish_to_utc.isoformat()} in {chunk_hours}h chunks"
        )

        while current_start < publish_to_utc:
            current_end = min(current_start + step, publish_to_utc)
            chunk_records = self.fetch_forecasts_window(current_start, current_end)
            all_records.extend(chunk_records)
            current_start = current_end

        # Deduplicate identical (publish_time, start_time) in case of overlapping chunk boundaries
        deduped: dict[tuple[datetime, datetime], dict[str, Any]] = {}
        for r in all_records:
            key = (r["publish_time_utc"], r["start_time_utc"])
            deduped[key] = r

        logger.info(f"Retrieved {len(deduped)} distinct WINDFOR forecast records")
        return list(deduped.values())
