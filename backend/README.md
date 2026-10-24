
Gridbricks is built for a UK electricity utility's day-ahead electricity procurement team. It determines which national wind generation forecast was available when purchasing decisions were finalized and quantifies the error between that forecast and eventual actual outturn generation.

---

## Key Features

- **Strict Temporal Integrity**: Enforces cutoff deadlines (`10:00 Europe/London` placeholder, converted to UTC) and proves through automated regression tests that later forecasts cannot leak into historical decisions.
- **Two Permitted Elexon Datasets**:
  - `FUELHH`: Actual half-hourly wind generation outturn in MW (filtered to `fuelType = WIND`).
  - `WINDFOR`: Historical wind forecast publications in MW, retaining all publication vintages.
- **Modern Python Stack**:
  - Python 3.12+
  - **FastAPI** + **Granian** high-performance ASGI server
  - **Pydantic v2** for typed settings and request/response validation
  - **SQLAlchemy 2.0** + **Alembic** migrations
  - **Neon Tech PostgreSQL** (serverless connection pooling & SSL) + SQLite local standalone mode
  - **Upstash Redis** analytical caching with in-memory fallback
  - **Upstash QStash** serverless message queue & webhook dispatch
  - **Hugging Face Llama** for plain-English colloquial narrative summaries
  - **HTTPX** with **Tenacity** exponential backoff and bounded retries

---

## Project Structure

```text
backend/
├── app/
│   ├── main.py                          # FastAPI application factory & RFC 7807 error handlers
│   ├── api/
│   │   ├── dependencies.py              # DB, Cache, LLM, and Auth dependencies
│   │   └── routes/                      # REST endpoints (health, overview, decisions, accuracy,
│   │                                    # evolution, data-health, ingestion, exports)
│   ├── core/                            # Typed configuration, logging, and domain exceptions
│   ├── db/
│   │   ├── base.py                      # Declarative base & UTCDateTime cross-dialect type
│   │   ├── session.py                   # Neon PostgreSQL / SQLite connection pooling
│   │   └── models/                      # IngestionRun, RawSourceRecord, ActualObservation,
│   │                                    # ForecastObservation, DecisionSnapshot, DataQualityIssue
│   ├── schemas/                         # Pydantic v2 validation and response models
│   ├── services/
│   │   ├── elexon/                      # FUELHH & WINDFOR HTTP stream clients
│   │   ├── normalization/               # Calendar math, DST transitions, validation
│   │   ├── snapshots/                   # Decision-time forecast selection engine
│   │   ├── metrics/                     # Pure accuracy math (MAE, RMSE, Bias, WAPE, P90, MWh)
│   │   ├── integrations/                # Upstash Redis, QStash, Hugging Face Llama
│   │   └── exports/                     # Formula-injection-safe CSV exporter
│   ├── repositories/                    # Database query and persistence abstractions
│   └── cli.py                           # Click operational CLI commands
├── migrations/                          # Alembic migration scripts
├── tests/
│   ├── fixtures/                        # Deterministic JSON fixtures
│   ├── unit/                            # Unit tests for metrics, temporal rules, LLM summaries
│   ├── contract/                        # Elexon API contract tests
│   └── integration/                     # Temporal regression, API endpoints, CSV exports, CLI
├── docs/                                # Full engineering documentation suite
├── Dockerfile                           # Multi-stage production container with Granian
├── compose.yaml                         # Local stack (API, PostgreSQL, Redis)
├── pyproject.toml                       # Python project definition and tool configs
└── Makefile                             # Operational developer shortcuts
```

---

## Quickstart Setup

### 1. Prerequisites
- Python 3.12+ (or [uv](https://github.com/astral-sh/uv))
- Git

### 2. Install Dependencies
```bash
cd backend
uv venv
uv pip install -e ".[dev]"
```

### 3. Environment Configuration
Copy the provided environment template:
```bash
cp .env.example .env
```
*Note: By default, `.env` is configured to use `sqlite:///./gridbricks.db` for instant local testing without needing Docker or a local PostgreSQL install. For cloud production, set `DATABASE_URL` to your Neon Tech connection string.*

### 4. Apply Database Migrations
```bash
uv run alembic upgrade head
```

### 5. Verify Connectivity
Verify database access and live Elexon BMRS API connectivity:
```bash
uv run python -m app.cli check-source-connectivity
```

### 6. Execute Historical Backfill
Ingest actuals and forecasts for January 2026 and build reproducible snapshots:
```bash
uv run python -m app.cli backfill --decision-from 2026-01-01 --decision-to 2026-01-03
```

### 7. Run the API Server
Launch with Granian:
```bash
uv run granian --interface asgi app.main:app --host 0.0.0.0 --port 8000 --reload
```
Interactive API documentation will be available at:
- Swagger UI: `http://localhost:8000/docs`
- ReDoc: `http://localhost:8000/redoc`

---

## Running Automated Tests

```bash
# Run all tests with code coverage
uv run pytest tests/ --cov=app --cov-report=term-missing

# Run critical temporal regression tests
uv run pytest tests/integration/test_temporal_regression.py -v

# Run Ruff linter and formatter check
uv run ruff check .
uv run ruff format --check .
```

---

## Operational CLI Commands

```bash
# Audit configuration settings
uv run python -m app.cli check-config

# Ingest FUELHH actual generation
uv run python -m app.cli ingest-actuals --from-date 2026-01-02 --to-date 2026-02-01

# Ingest WINDFOR forecasts
uv run python -m app.cli ingest-forecasts --decision-from 2026-01-01 --decision-to 2026-01-31

# Rebuild historical snapshots after methodology updates
uv run python -m app.cli rebuild-snapshots --decision-from 2026-01-01 --decision-to 2026-01-31

# Generate completeness and data quality report
uv run python -m app.cli data-quality-report --decision-from 2026-01-01 --decision-to 2026-01-31
```

---

## Production Deployment with Docker

### Docker Compose
```bash
docker compose up -d
```

### Standalone Docker Container
```bash
docker build -t gridbricks-backend:latest .
docker run -d -p 8000:8000 --env-file .env gridbricks-backend:latest
```

---

## Documentation Index

- [Architecture & Data Flow](docs/ARCHITECTURE.md)
- [Assumptions & Business Rules Register](docs/ASSUMPTIONS.md)
- [Data Dictionary & Schema](docs/DATA_DICTIONARY.md)
- [Analytics & Metric Formulas](docs/ANALYTICS.md)
- [REST API Specification](docs/API.md)
- [Operations & Runbook](docs/OPERATIONS.md)
- [Testing Strategy & Evidence](docs/TESTING.md)
