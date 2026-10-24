"""End-to-End API Integration Tests."""

from datetime import UTC, date, datetime

from fastapi.testclient import TestClient
from sqlalchemy.orm import Session

from app.repositories.actual_repo import ActualRepository
from app.repositories.forecast_repo import ForecastRepository
from app.repositories.ingestion_repo import IngestionRepository
from app.services.normalization.normalizer import build_expected_delivery_intervals


def test_health_endpoints(client: TestClient):
    """Test /health/live and /health/ready endpoints."""
    # Liveness
    res_live = client.get("/health/live")
    assert res_live.status_code == 200
    assert res_live.json()["status"] == "ok"

    # Readiness
    res_ready = client.get("/health/ready")
    assert res_ready.status_code == 200
    data = res_ready.json()
    assert data["status"] == "ready"
    assert data["database"]["status"] == "healthy"


def test_overview_endpoint(client: TestClient, test_db_session: Session):
    """Test GET /api/v1/overview."""
    res = client.get("/api/v1/overview?decision_month=2026-01")
    assert res.status_code == 200
    data = res.json()
    assert data["decision_month"] == "2026-01"
    assert "monthly_metrics" in data
    assert "daily_summaries" in data
    assert len(data["daily_summaries"]) == 31  # 31 days in January
    assert data["configuration"]["decision_timezone"] == "Europe/London"


def test_decision_day_endpoint(client: TestClient, test_db_session: Session):
    """Test GET /api/v1/decisions/{decision_date}."""
    decision_date = date(2026, 1, 15)
    delivery_date = date(2026, 1, 16)
    expected_intervals = build_expected_delivery_intervals(delivery_date)

    # Populate a forecast and actual
    forecast_repo = ForecastRepository(test_db_session)
    actual_repo = ActualRepository(test_db_session)

    forecast_repo.upsert_records(
        [
            {
                "start_time_utc": expected_intervals[0],
                "publish_time_utc": datetime(2026, 1, 15, 8, 0, tzinfo=UTC),
                "generation_mw": 14000.0,
                "source_identity": "FC:1",
            }
        ]
    )
    actual_repo.upsert_records(
        [
            {
                "start_time_utc": expected_intervals[0],
                "settlement_date": delivery_date,
                "settlement_period": 1,
                "fuel_type": "WIND",
                "generation_mw": 13500.0,
                "source_identity": "ACT:1",
            }
        ]
    )

    res = client.get(f"/api/v1/decisions/{decision_date.isoformat()}")
    assert res.status_code == 200
    data = res.json()
    assert data["decision_date"] == "2026-01-15"
    assert data["delivery_date"] == "2026-01-16"
    assert len(data["intervals"]) == len(expected_intervals)
    assert data["metrics"]["matched_intervals"] == 1
    assert data["metrics"]["mae_mw"] == 500.0


def test_accuracy_summary_and_daily(client: TestClient):
    """Test GET /api/v1/accuracy/summary and /daily."""
    res_summary = client.get(
        "/api/v1/accuracy/summary?decision_from=2026-01-01&decision_to=2026-01-07"
    )
    assert res_summary.status_code == 200
    assert "metrics" in res_summary.json()

    res_daily = client.get("/api/v1/accuracy/daily?decision_from=2026-01-01&decision_to=2026-01-07")
    assert res_daily.status_code == 200
    assert len(res_daily.json()["days"]) == 7


def test_forecast_evolution_endpoint(client: TestClient, test_db_session: Session):
    """Test GET /api/v1/forecast-evolution."""
    interval_utc = datetime(2026, 1, 16, 12, 0, tzinfo=UTC)
    forecast_repo = ForecastRepository(test_db_session)

    # Ingest two vintages
    forecast_repo.upsert_records(
        [
            {
                "start_time_utc": interval_utc,
                "publish_time_utc": datetime(2026, 1, 15, 8, 0, tzinfo=UTC),
                "generation_mw": 10000.0,
                "source_identity": "V1",
            },
            {
                "start_time_utc": interval_utc,
                "publish_time_utc": datetime(2026, 1, 15, 14, 0, tzinfo=UTC),
                "generation_mw": 11000.0,
                "source_identity": "V2",
            },
        ]
    )

    res = client.get(f"/api/v1/forecast-evolution?start_time_utc={interval_utc.isoformat()}")
    assert res.status_code == 200
    data = res.json()
    assert data["total_revisions"] == 2
    assert data["revisions"][0]["is_eligible_at_cutoff"] is True
    assert data["revisions"][1]["is_eligible_at_cutoff"] is False


def test_data_health_and_ingestion_runs(client: TestClient, test_db_session: Session):
    """Test GET /api/v1/data-health and /api/v1/ingestion/runs."""
    ing_repo = IngestionRepository(test_db_session)
    ing_repo.create_run(
        dataset="FUELHH",
        requested_from=datetime(2026, 1, 1, tzinfo=UTC),
        requested_to=datetime(2026, 1, 2, tzinfo=UTC),
    )

    res_health = client.get("/api/v1/data-health")
    assert res_health.status_code == 200
    assert res_health.json()["status"] in ("HEALTHY", "DEGRADED", "CRITICAL")

    res_runs = client.get("/api/v1/ingestion/runs")
    assert res_runs.status_code == 200
    assert res_runs.json()["pagination"]["total"] >= 1


def test_csv_export_endpoint(client: TestClient):
    """Test GET /api/v1/exports/intervals.csv."""
    res = client.get("/api/v1/exports/intervals.csv?decision_date=2026-01-15")
    assert res.status_code == 200
    assert "text/csv" in res.headers["content-type"]
    assert "gridbricks_intervals_2026-01-15.csv" in res.headers["content-disposition"]
    csv_lines = res.text.strip().split("\n")
    assert "start_time_utc,decision_date" in csv_lines[0]
    assert len(csv_lines) == 49  # 1 header + 48 intervals
