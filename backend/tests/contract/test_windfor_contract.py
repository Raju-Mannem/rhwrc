"""Contract Tests for Elexon WINDFOR Client.

Validates that incoming forecast payloads preserve historical publication lineage
and surface network errors appropriately.
"""

import json
from datetime import UTC, datetime
from pathlib import Path

import pytest

from app.core.exceptions import ElexonSourceError
from app.services.elexon.windfor_client import WindforClient


def test_windfor_payload_parsing_and_lineage(fixtures_dir: Path, monkeypatch):
    """Verify WINDFOR client parses publications and preserves publishTime."""
    fixture_file = fixtures_dir / "windfor_samples.json"
    with open(fixture_file, encoding="utf-8") as f:
        samples = json.load(f)

    client = WindforClient()

    def mock_get(path, params=None):
        return samples

    monkeypatch.setattr(client, "get", mock_get)

    p_from = datetime(2026, 1, 1, 0, 0, tzinfo=UTC)
    p_to = datetime(2026, 1, 1, 23, 59, tzinfo=UTC)

    records = client.fetch_forecasts_window(p_from, p_to)
    assert len(records) == 7

    # Distinct publications present in fixture
    distinct_pubs = {r["publish_time_utc"] for r in records}
    assert len(distinct_pubs) == 3  # 07:30, 09:30, 14:30

    for r in records:
        assert r["dataset"] == "WINDFOR"
        assert r["generation_mw"] > 0.0
        assert r["start_time_utc"].tzinfo is not None
        assert r["publish_time_utc"].tzinfo is not None
        assert "WINDFOR:" in r["source_identity"]


def test_windfor_error_handling(monkeypatch):
    """Verify that network failures raise ElexonSourceError."""
    client = WindforClient()

    def mock_get(path, params=None):
        raise ElexonSourceError("Connection timed out", status_code=504)

    monkeypatch.setattr(client, "get", mock_get)

    p_from = datetime(2026, 1, 1, 0, 0, tzinfo=UTC)
    p_to = datetime(2026, 1, 1, 23, 59, tzinfo=UTC)

    with pytest.raises(ElexonSourceError) as exc_info:
        client.fetch_forecasts_window(p_from, p_to)

    assert exc_info.value.status_code == 504
