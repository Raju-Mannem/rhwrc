# Gridbricks Backend Architecture Specification

Gridbricks is a high-reliability analytics backend engineered for a UK energy utility's day-ahead electricity procurement team. It determines which national wind generation forecast was available at historical purchasing cutoffs and quantifies the forecast error relative to eventual actual outturn generation.

---

## 1. High-Level Architecture Overview

```mermaid
flowchart TD
    subgraph Elexon["External Elexon BMRS API"]
        FUELHH["FUELHH Stream (Actuals Outturn)"]
        WINDFOR["WINDFOR Stream (Historical Forecasts)"]
    end

    subgraph Ingestion["Ingestion & Pipeline Engine"]
        CLI["CLI Commands / Operational Runner"]
        QStash_Recv["Upstash QStash Webhook Receiver"]
        F_Client["FuelHHClient"]
        W_Client["WindforClient"]
        Norm["Normalizer & Temporal Cal Math"]
        Ing_Svc["IngestionService"]
    end

    subgraph Storage["Persistent Data Tier (PostgreSQL / Neon Tech)"]
        Raw["raw_source_records (Audit & Hashes)"]
        Runs["ingestion_runs (Job Lineage)"]
        Actuals["actual_generation_observations"]
        Forecasts["forecast_observations (All Vintages)"]
        Snapshots["decision_snapshots & intervals"]
        Quality["data_quality_issues"]
    end

    subgraph Analytics["Decision & Analytics Engine"]
        SnapEngine["SnapshotEngine (Temporal Cutoff Selection)"]
        MetricsEngine["MetricsEngine (Pure MAE, RMSE, WAPE, P90)"]
        LLM["Hugging Face Llama Narrative Summarizer"]
    end

    subgraph Caching["Caching & Asynchronous Messaging"]
        UpstashRedis["Upstash Redis (Analytical JSON Cache)"]
        UpstashQStash["Upstash QStash (Message Queue / Dispatcher)"]
    end

    subgraph API["REST API (FastAPI + Granian)"]
        Health_EP["/health/live & /health/ready"]
        Overview_EP["GET /api/v1/overview"]
        Decisions_EP["GET /api/v1/decisions/{decision_date}"]
        Accuracy_EP["GET /api/v1/accuracy/summary & /daily"]
        Evolution_EP["GET /api/v1/forecast-evolution"]
        Quality_EP["GET /api/v1/data-health"]
        Runs_EP["GET /api/v1/ingestion/runs"]
        Exports_EP["GET /api/v1/exports/intervals.csv"]
    end

    subgraph Consumer["Future Frontend"]
        ReactApp["React / Next.js Procurement Dashboard"]
    end

    FUELHH --> F_Client
    WINDFOR --> W_Client
    CLI --> Ing_Svc
    QStash_Recv --> Ing_Svc
    F_Client --> Norm --> Ing_Svc
    W_Client --> Norm --> Ing_Svc
    Ing_Svc --> Raw & Runs & Actuals & Forecasts & Quality

    Forecasts & Actuals --> SnapEngine --> Snapshots
    Snapshots --> MetricsEngine
    MetricsEngine --> LLM
    MetricsEngine & LLM --> UpstashRedis

    API --> UpstashRedis
    API --> SnapEngine
    API --> MetricsEngine
    API --> Quality
    ReactApp --> API
```

---

## 2. Core Subsystems

### 2.1 Elexon Source Clients (`app/services/elexon/`)
- **`FuelHHClient`**: Communicates with `/datasets/FUELHH/stream`. Filters to `fuelType = WIND`, parses settlement periods (1–48), and validates average MW power.
- **`WindforClient`**: Communicates with `/datasets/WINDFOR/stream` using bounded publication windows (`publishDateTimeFrom`, `publishDateTimeTo`). Preserves `publishTime` separately from `startTime`.
- **`ElexonBaseClient`**: Shared HTTP layer with bounded retries (`tenacity`), exponential backoff, rate limit header handling, and custom User-Agent.

### 2.2 Data Ingestion & Auditing (`app/services/ingestion/`)
- Every ingestion creates an `IngestionRun` record tracking duration, status, record counts, and errors.
- Every source payload is hashed (SHA-256) and archived in `raw_source_records` for lineage tracking.
- Idempotent upsert strategies guarantee repeated runs never duplicate observations.

### 2.3 Snapshot Selection Engine (`app/services/snapshots/`)
- The core business engine responsible for historical decision integrity.
- Given a decision date (e.g. 2026-01-15):
  1. Computes local purchasing cutoff instant in `Europe/London` (e.g. 10:00) and converts to UTC.
  2. Derives delivery date (e.g. 2026-01-16) and generates expected delivery calendar intervals.
  3. Queries forecasts published **at or before cutoff**.
  4. Excludes all later forecasts to eliminate future lookahead bias.
  5. Selects the `latest_complete_publication` (or falls back to `latest_per_interval`).
  6. Matches with eventual actual outturn and persists `decision_snapshot_intervals`.

### 2.4 Analytics & Metrics Engine (`app/services/metrics/`)
- Pure, independently testable mathematical routines.
- Evaluates Mean Absolute Error (MAE), Root Mean Squared Error (RMSE), Bias, Weighted Absolute Percentage Error (WAPE), and 90th percentile absolute error (P90) strictly over valid matched intervals.

### 2.5 Integrations: Neon Tech, Upstash, and Hugging Face
- **Neon Tech DB**: Serverless PostgreSQL connection pooling (`pool_pre_ping=True`, `pool_recycle=300`) with SSL mode `require`.
- **Upstash Redis**: Caches expensive monthly overviews and accuracy summaries with automatic in-memory TTL fallback.
- **Upstash QStash**: Dispatches background ingestion/backfill tasks and provides webhook signature verification.
- **Hugging Face Llama**: Translates raw numerical forecast accuracy metrics into colloquial, plain-English executive explanations for procurement traders.

---

## 3. Database Entity Relationship Diagram

```mermaid
erDiagram
    ingestion_runs ||--o{ raw_source_records : "tracks"
    ingestion_runs ||--o{ actual_generation_observations : "ingests"
    ingestion_runs ||--o{ forecast_observations : "ingests"
    ingestion_runs ||--o{ data_quality_issues : "logs"

    decision_snapshots ||--|{ decision_snapshot_intervals : "contains"
    raw_source_records ||--o{ actual_generation_observations : "sources"
    raw_source_records ||--o{ forecast_observations : "sources"

    ingestion_runs {
        string id PK
        string dataset
        string status
        timestamp requested_from
        timestamp requested_to
        int fetched_count
        int inserted_count
        int updated_count
        int duplicate_count
        int rejected_count
    }

    raw_source_records {
        string id PK
        string dataset
        string source_identity
        string payload_hash
        json payload
        timestamp retrieval_timestamp
    }

    actual_generation_observations {
        string id PK
        timestamp start_time_utc
        date settlement_date
        int settlement_period
        string fuel_type
        float generation_mw
        string quality_status
    }

    forecast_observations {
        string id PK
        timestamp start_time_utc
        timestamp publish_time_utc
        float generation_mw
        string dataset
        string quality_status
    }

    decision_snapshots {
        string id PK
        date decision_date
        timestamp decision_cutoff_utc
        string decision_cutoff_local_time
        date delivery_date
        string selection_policy
        string completeness_status
        int expected_intervals
        int matched_intervals
        int missing_intervals
        float coverage_ratio
    }

    decision_snapshot_intervals {
        string id PK
        string snapshot_id FK
        timestamp start_time_utc
        float forecast_mw
        float actual_mw
        float signed_error_mw
        float absolute_error_mw
        float error_mwh
        timestamp forecast_publish_time_utc
        string match_status
    }
```
