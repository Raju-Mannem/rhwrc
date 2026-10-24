# Gridbricks Data Dictionary

This document details the PostgreSQL schema, table structures, column definitions, data types, physical units, natural keys, and audit lineages for Gridbricks.

---

## 1. Table: `ingestion_runs`
Tracks batch and streaming ingestion runs from Elexon BMRS.

| Column | Data Type | Nullable | Units / Format | Description |
| :--- | :--- | :--- | :--- | :--- |
| `id` | VARCHAR(36) | No | UUIDv4 | Primary key for ingestion run. |
| `dataset` | VARCHAR(32) | No | Text | Target dataset: `'FUELHH'` or `'WINDFOR'`. |
| `status` | VARCHAR(24) | No | Enum | Status: `'RUNNING'`, `'SUCCESS'`, `'PARTIAL'`, `'FAILED'`. |
| `requested_from` | TIMESTAMPTZ | No | UTC ISO 8601 | Start of requested observation or publication window. |
| `requested_to` | TIMESTAMPTZ | No | UTC ISO 8601 | End of requested observation or publication window. |
| `started_at` | TIMESTAMPTZ | No | UTC ISO 8601 | Run start timestamp. |
| `completed_at` | TIMESTAMPTZ | Yes | UTC ISO 8601 | Run termination timestamp. |
| `fetched_count` | INTEGER | No | Count | Total raw records received from upstream API. |
| `inserted_count` | INTEGER | No | Count | New canonical records persisted. |
| `updated_count` | INTEGER | No | Count | Existing records updated due to source revisions. |
| `duplicate_count` | INTEGER | No | Count | Identical records skipped idempotently. |
| `rejected_count` | INTEGER | No | Count | Malformed records rejected by validation. |
| `error_summary` | TEXT | Yes | Text | Detailed error traceback if run failed. |
| `metadata_json` | JSONB / JSON | Yes | JSON | Contextual parameters and query filters. |

---

## 2. Table: `raw_source_records`
Immutable store for incoming Elexon JSON payloads to ensure complete auditability.

| Column | Data Type | Nullable | Description |
| :--- | :--- | :--- | :--- |
| `id` | VARCHAR(36) | No | UUIDv4 primary key. |
| `dataset` | VARCHAR(32) | No | Source dataset: `'FUELHH'` or `'WINDFOR'`. |
| `source_identity` | VARCHAR(128) | No | Documented natural key identifier. |
| `payload_hash` | VARCHAR(64) | No | Deterministic SHA-256 hash of JSON payload. |
| `payload` | JSONB / JSON | No | Exact verbatim source record from upstream. |
| `retrieval_timestamp`| TIMESTAMPTZ | No | Timestamp when record was received over HTTP. |
| `publish_time` | TIMESTAMPTZ | Yes | Source publication timestamp if applicable. |
| `ingestion_run_id` | VARCHAR(36) | Yes | Foreign key to `ingestion_runs.id`. |

---

## 3. Table: `actual_generation_observations`
Normalized outturn wind generation observations from Elexon FUELHH.

| Column | Data Type | Nullable | Units | Description |
| :--- | :--- | :--- | :--- | :--- |
| `id` | VARCHAR(36) | No | UUIDv4 | Primary key. |
| `start_time_utc` | TIMESTAMPTZ | No | UTC | Half-hourly delivery interval start time. |
| `settlement_date` | DATE | No | YYYY-MM-DD | Settlement calendar date. |
| `settlement_period` | INTEGER | No | 1 to 48 (or 50) | UK settlement period number. |
| `fuel_type` | VARCHAR(16) | No | Text | Filtered strictly to `'WIND'`. |
| `generation_mw` | FLOAT | No | Megawatts (MW) | Average wind generation power across the 30-min interval. |
| `source_identity` | VARCHAR(128) | No | Text | Composite natural key: `FUELHH:{start_time_utc}:WIND`. |
| `source_publish_time` | TIMESTAMPTZ | Yes | UTC | Publication timestamp from FUELHH record. |
| `raw_record_id` | VARCHAR(36) | Yes | UUIDv4 | FK to `raw_source_records.id`. |
| `ingestion_run_id` | VARCHAR(36) | Yes | UUIDv4 | FK to `ingestion_runs.id`. |
| `quality_status` | VARCHAR(24) | No | Enum | Data quality state: `'VALID'`, `'FLAGGED'`, `'SUSPICIOUS'`. |

**Constraints & Indexes**:
- Unique constraint: `uq_actual_start_time_fuel` on `(start_time_utc, fuel_type)`.
- Index: `ix_actual_settlement_date_period` on `(settlement_date, settlement_period)`.

---

## 4. Table: `forecast_observations`
Normalized wind generation forecasts from Elexon WINDFOR, preserving all historical publication vintages.

| Column | Data Type | Nullable | Units | Description |
| :--- | :--- | :--- | :--- | :--- |
| `id` | VARCHAR(36) | No | UUIDv4 | Primary key. |
| `start_time_utc` | TIMESTAMPTZ | No | UTC | Target delivery interval start timestamp. |
| `publish_time_utc` | TIMESTAMPTZ | No | UTC | National Grid ESO publication timestamp. |
| `generation_mw` | FLOAT | No | Megawatts (MW) | Predicted wind generation power. |
| `dataset` | VARCHAR(32) | No | Text | Always `'WINDFOR'`. |
| `source_identity` | VARCHAR(128) | No | Text | Composite key: `WINDFOR:{publish_time_utc}:{start_time_utc}`. |
| `raw_record_id` | VARCHAR(36) | Yes | UUIDv4 | FK to `raw_source_records.id`. |
| `ingestion_run_id` | VARCHAR(36) | Yes | UUIDv4 | FK to `ingestion_runs.id`. |
| `quality_status` | VARCHAR(24) | No | Enum | Validation status: `'VALID'`, `'FLAGGED'`. |

**Constraints & Indexes**:
- Unique constraint: `uq_forecast_start_publish` on `(start_time_utc, publish_time_utc)`.
- Index: `ix_forecast_publish_start` on `(publish_time_utc, start_time_utc)`.

---

## 5. Table: `decision_snapshots`
Reproducible historical day-ahead purchasing decision records.

| Column | Data Type | Nullable | Units | Description |
| :--- | :--- | :--- | :--- | :--- |
| `id` | VARCHAR(36) | No | UUIDv4 | Primary key. |
| `decision_date` | DATE | No | YYYY-MM-DD | Date when procurement decision occurred. |
| `decision_cutoff_utc`| TIMESTAMPTZ | No | UTC | Instant of decision cutoff in UTC. |
| `decision_cutoff_local_time` | VARCHAR(32) | No | Text | Cutoff local representation (e.g. `10:00 Europe/London`). |
| `delivery_date` | DATE | No | YYYY-MM-DD | Target delivery calendar date. |
| `selection_policy` | VARCHAR(48) | No | Text | Policy: `'latest_complete_publication'` or `'latest_per_interval'`. |
| `selected_publication_time_utc` | TIMESTAMPTZ | Yes | UTC | Publication timestamp if single complete run selected. |
| `completeness_status` | VARCHAR(32) | No | Enum | `'COMPLETE'`, `'MIXED_OR_PARTIAL'`, `'INCOMPLETE'`. |
| `expected_intervals` | INTEGER | No | Count | Expected calendar interval count (normally 48). |
| `matched_intervals` | INTEGER | No | Count | Valid matched forecast/actual intervals. |
| `missing_intervals` | INTEGER | No | Count | Missing delivery intervals. |
| `coverage_ratio` | FLOAT | No | Ratio (0.0–1.0) | Ratio of matched to expected intervals. |
| `calculation_version`| VARCHAR(16) | No | Text | Methodology version, default `'1.0'`. |

---

## 6. Table: `decision_snapshot_intervals`
Interval-level comparison between selected forecast and actual outturn.

| Column | Data Type | Nullable | Units | Description |
| :--- | :--- | :--- | :--- | :--- |
| `id` | VARCHAR(36) | No | UUIDv4 | Primary key. |
| `snapshot_id` | VARCHAR(36) | No | UUIDv4 | FK to `decision_snapshots.id` (ON DELETE CASCADE). |
| `start_time_utc` | TIMESTAMPTZ | No | UTC | Delivery interval start timestamp. |
| `forecast_mw` | FLOAT | Yes | MW | Selected eligible forecast power. |
| `actual_mw` | FLOAT | Yes | MW | Actual outturn wind power. |
| `signed_error_mw` | FLOAT | Yes | MW | Signed error ($F - A$). Positive = Overforecast. |
| `absolute_error_mw` | FLOAT | Yes | MW | Absolute error ($\|F - A\|$). |
| `error_mwh` | FLOAT | Yes | MWh | Energy equivalent volume error ($(F - A) \times 0.5$). |
| `forecast_publish_time_utc` | TIMESTAMPTZ | Yes | UTC | Publication timestamp of selected forecast vintage. |
| `match_status` | VARCHAR(32) | No | Enum | `'MATCHED'`, `'MISSING_FORECAST'`, `'MISSING_ACTUAL'`. |

---

## 7. Table: `data_quality_issues`
Validation flags, anomalous power values, and data gaps.

| Column | Data Type | Nullable | Description |
| :--- | :--- | :--- | :--- |
| `id` | VARCHAR(36) | No | UUIDv4 primary key. |
| `dataset` | VARCHAR(32) | No | Dataset: `'FUELHH'`, `'WINDFOR'`, `'SNAPSHOT'`. |
| `issue_type` | VARCHAR(48) | No | Finding: `'NEGATIVE_GENERATION'`, `'MISSING_INTERVAL'`, etc. |
| `severity` | VARCHAR(16) | No | Severity: `'INFO'`, `'WARNING'`, `'ERROR'`, `'CRITICAL'`. |
| `description` | TEXT | No | Human-readable explanation of issue. |
| `record_identifier` | VARCHAR(128) | Yes | Source record identifier or interval timestamp. |
| `ingestion_run_id` | VARCHAR(36) | Yes | FK to `ingestion_runs.id`. |
| `detected_at` | TIMESTAMPTZ | No | UTC detection timestamp. |
