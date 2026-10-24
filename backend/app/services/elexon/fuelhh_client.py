"""Elexon FUELHH Actual Outturn Generation Client.

Queries /datasets/FUELHH/stream to retrieve actual half-hourly outturn generation
filtered specifically to fuelType = WIND.
"""

from datetime import date
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


class FuelHHClient(ElexonBaseClient):
    """Client for Elexon FUELHH (Half-Hourly Fuel Outturn) stream endpoint."""

    def fetch_actual_wind(
        self,
        date_from: date,
        date_to: date,
    ) -> list[dict[str, Any]]:
        """Fetch actual wind generation records for the specified settlement date range.

        Both date_from and date_to are inclusive.
        Filters client-side for fuelType == 'WIND'.
        """
        path = "/datasets/FUELHH/stream"
        params = {
            "settlementDateFrom": date_from.isoformat(),
            "settlementDateTo": date_to.isoformat(),
            "fuelType": "WIND",
        }

        logger.info(f"Fetching FUELHH wind outturn between {date_from} and {date_to}")
        raw_response = self.get(path, params=params)

        if not isinstance(raw_response, list):
            raise ElexonSourceError(
                message=f"Expected list response from FUELHH, got {type(raw_response).__name__}",
                dataset="FUELHH",
            )

        normalized_records: list[dict[str, Any]] = []

        for item in raw_response:
            if not isinstance(item, dict):
                logger.warning(f"Skipping non-dict record in FUELHH response: {item}")
                continue

            fuel_type = str(item.get("fuelType", "")).upper()
            if fuel_type != "WIND":
                # Ensure client-side filtering even if upstream ignored query parameter
                continue

            start_time_raw = item.get("startTime")
            if not start_time_raw:
                logger.warning(f"FUELHH record missing startTime: {item}")
                continue

            try:
                start_time_utc = parse_to_utc_datetime(start_time_raw)
            except Exception as err:
                logger.warning(f"Malformed startTime in FUELHH record: {start_time_raw} - {err}")
                continue

            gen_raw = item.get("generation")
            gen_mw, warnings = validate_generation_value(gen_raw)
            if gen_mw is None:
                logger.warning(f"Invalid generation value in FUELHH: {gen_raw}")
                continue

            settlement_date_str = item.get("settlementDate")
            settlement_period = item.get("settlementPeriod")

            # Parse settlement date
            try:
                s_date = (
                    date.fromisoformat(settlement_date_str)
                    if settlement_date_str
                    else start_time_utc.date()
                )
            except Exception:
                s_date = start_time_utc.date()

            s_period = int(settlement_period) if settlement_period is not None else 1

            source_identity = f"FUELHH:{start_time_utc.isoformat()}:{fuel_type}"
            p_hash = compute_payload_hash(item)

            normalized_records.append(
                {
                    "dataset": "FUELHH",
                    "source_identity": source_identity,
                    "payload_hash": p_hash,
                    "raw_payload": item,
                    "start_time_utc": start_time_utc,
                    "settlement_date": s_date,
                    "settlement_period": s_period,
                    "fuel_type": fuel_type,
                    "generation_mw": gen_mw,
                    "source_publish_time": parse_to_utc_datetime(item.get("publishTime"))
                    if item.get("publishTime")
                    else None,
                    "warnings": warnings,
                }
            )

        logger.info(
            f"Successfully processed {len(normalized_records)} FUELHH WIND records "
            f"for {date_from} to {date_to}"
        )
        return normalized_records
