"""Integration Tests for Ingestion Service Pipeline."""

import json
from datetime import UTC, date, datetime
from pathlib import Path

from sqlalchemy.orm import Session

from app.db.models.ingestion_run import IngestionRun
from app.services.elexon.fuelhh_client import FuelHHClient
from app.services.elexon.windfor_client import WindforClient
from app.services.ingestion.ingestion_service import IngestionService


def test_ingestion_service_e2e(test_db_session: Session, fixtures_dir: Path, monkeypatch):
    """Test full ingestion workflow for actuals and forecasts using deterministic fixtures."""
    # Load fixtures
    with open(fixtures_dir / "fuelhh_samples.json", encoding="utf-8") as f:
        fuelhh_data = json.load(f)
    with open(fixtures_dir / "windfor_samples.json", encoding="utf-8") as f:
        windfor_data = json.load(f)

    # Mock clients
    fuel_client = FuelHHClient()
    monkeypatch.setattr(fuel_client, "get", lambda path, params=None: fuelhh_data)

    windfor_client = WindforClient()
    monkeypatch.setattr(windfor_client, "get", lambda path, params=None: windfor_data)

    service = IngestionService(test_db_session)

    # 1. Ingest actuals
    actual_run_id = service.ingest_actuals_range(
        date_from=date(2026, 1, 2),
        date_to=date(2026, 1, 2),
        client=fuel_client,
    )
    assert actual_run_id is not None

    run_actual = test_db_session.get(IngestionRun, actual_run_id)
    assert run_actual.status == "SUCCESS"
    assert run_actual.inserted_count == 5

    # 2. Re-ingesting the exact same range tests IDEMPOTENCY
    run_id_2 = service.ingest_actuals_range(
        date_from=date(2026, 1, 2),
        date_to=date(2026, 1, 2),
        client=fuel_client,
    )
    run_actual_2 = test_db_session.get(IngestionRun, run_id_2)
    assert run_actual_2.status == "SUCCESS"
    assert run_actual_2.inserted_count == 0
    assert run_actual_2.duplicate_count == 5

    # 3. Ingest forecasts
    p_from = datetime(2026, 1, 1, 0, 0, tzinfo=UTC)
    p_to = datetime(2026, 1, 1, 23, 59, tzinfo=UTC)
    forecast_run_id = service.ingest_forecasts_range(
        publish_from_utc=p_from,
        publish_to_utc=p_to,
        client=windfor_client,
    )
    assert forecast_run_id is not None

    run_fc = test_db_session.get(IngestionRun, forecast_run_id)
    assert run_fc.status == "SUCCESS"
    assert run_fc.inserted_count == 7
