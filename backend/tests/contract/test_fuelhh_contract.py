"""Contract Tests for Elexon FUELHH Client.

Validates that incoming payloads adhere to documented Elexon schemas,
that fuelType filtering to WIND is enforced, and that HTTP errors surface cleanly.
"""

import json
from datetime import date
from pathlib import Path

import pytest

from app.core.exceptions import ElexonSourceError
from app.services.elexon.fuelhh_client import FuelHHClient


def test_fuelhh_payload_parsing_and_wind_filtering(fixtures_dir: Path, monkeypatch):
    """Verify that FUELHH client parses valid records and filters non-WIND out."""
    fixture_file = fixtures_dir / "fuelhh_samples.json"
    with open(fixture_file, encoding="utf-8") as f:
        samples = json.load(f)

    # Add a BIOMASS record to ensure client-side filter rejects it
    samples.append(
        {
            "dataset": "FUELHH",
            "publishTime": "2026-01-03T00:00:00Z",
            "startTime": "2026-01-02T02:30:00Z",
            "settlementDate": "2026-01-02",
            "settlementPeriod": 6,
            "fuelType": "BIOMASS",
            "generation": 3000,
        }
    )

    client = FuelHHClient()

    # Mock the internal GET request
    def mock_get(path, params=None):
        return samples

    monkeypatch.setattr(client, "get", mock_get)

    records = client.fetch_actual_wind(date(2026, 1, 2), date(2026, 1, 2))
    assert len(records) == 5  # Exactly 5 WIND records, BIOMASS excluded

    for r in records:
        assert r["fuel_type"] == "WIND"
        assert r["generation_mw"] > 0.0
        assert r["start_time_utc"].tzinfo is not None
        assert "FUELHH:" in r["source_identity"]


def test_fuelhh_malformed_response(monkeypatch):
    """Verify that a malformed non-list response raises ElexonSourceError."""
    client = FuelHHClient()

    def mock_get(path, params=None):
        return {"error": "Invalid format"}

    monkeypatch.setattr(client, "get", mock_get)

    with pytest.raises(ElexonSourceError) as exc_info:
        client.fetch_actual_wind(date(2026, 1, 2), date(2026, 1, 2))

    assert "Expected list response" in str(exc_info.value)
