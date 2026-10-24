# Gridbricks REST API Specification

The Gridbricks Backend exposes a versioned REST API (`/api/v1`) designed for seamless integration with a future React frontend.

Interactive Swagger documentation is available at `/docs` and ReDoc at `/redoc`.

---

## 1. Standard Conventions

### 1.1 Timestamp Handling
- All input timestamp parameters accept ISO 8601 strings (e.g. `2026-01-02T12:00:00Z` or with offset).
- All API responses return UTC timestamps with explicit `+00:00` or `Z` timezone designations.

### 1.2 Error Responses (RFC 7807 Problem Details)
All error responses adhere to the RFC 7807 Problem Details specification:
```json
{
  "type": "urn:gridbricks:error:temporal-rule",
  "title": "Temporal Rule Violation",
  "status": 400,
  "detail": "decision_from cannot be after decision_to",
  "instance": "/api/v1/accuracy/summary",
  "invalid_params": {
    "invalid_date": "2026-02-01"
  }
}
```

---

## 2. API Endpoints

### 2.1 Health Probes
#### `GET /health/live`
- **Description**: Verifies that the process is alive.
- **Response `200 OK`**:
```json
{
  "status": "ok",
  "timestamp_utc": "2026-10-24T12:00:00Z",
  "app": "gridbricks-backend"
}
```

#### `GET /health/ready`
- **Description**: Verifies database connectivity, Upstash Redis cache status, and QStash configuration.
- **Response `200 OK` / `53 Service Unavailable`**:
```json
{
  "status": "ready",
  "timestamp_utc": "2026-10-24T12:00:00Z",
  "database": { "status": "healthy", "details": "Connected to PostgreSQL / Neon Tech" },
  "redis": { "status": "healthy", "details": "Connected to Upstash Redis" },
  "qstash": { "status": "configured", "details": "QStash token configured" },
  "elexon_api": { "status": "available", "details": "Configured to https://data.elexon.co.uk/bmrs/api/v1" }
}
```

---

### 2.2 Decision Overview
#### `GET /api/v1/overview`
- **Query Parameters**:
  - `decision_month` (string, default `"2026-01"`): Target month in `YYYY-MM` format.
- **Response `200 OK`**:
```json
{
  "decision_month": "2026-01",
  "decision_window_from": "2026-01-01",
  "decision_window_to": "2026-01-31",
  "delivery_window_from": "2026-01-02",
  "delivery_window_to": "2026-02-01",
  "configuration": {
    "decision_date_mode": "DECISION_DATE",
    "decision_timezone": "Europe/London",
    "decision_cutoff_local_time": "10:00",
    "decision_lead_days": 1,
    "decision_cutoff_inclusive": true,
    "selection_policy": "latest_complete_publication",
    "fallback_policy": "latest_per_interval",
    "completeness_threshold": 0.95,
    "interval_alignment": "STEP_FORWARD"
  },
  "monthly_metrics": {
    "mae_mw": 845.2,
    "rmse_mw": 1052.4,
    "bias_mw": 312.1,
    "wape_percent": 7.4,
    "p90_abs_error_mw": 1620.0,
    "total_energy_error_mwh": 232202.4,
    "matched_intervals": 1488,
    "expected_intervals": 1488,
    "missing_intervals": 0,
    "coverage_ratio": 1.0,
    "selection_policy": "latest_complete_publication",
    "population_notes": "Calculated over 1488 matched intervals out of 1488 expected."
  },
  "daily_summaries": [ ... ],
  "ingestion_status": {
    "last_successful_actual_utc": "2026-10-24T07:00:00Z",
    "last_successful_forecast_utc": "2026-10-24T07:01:00Z"
  },
  "data_quality_warnings": [],
  "llm_narrative_summary": "Across the Month of 2026-01 (100.0% coverage across 1488 intervals), the day-ahead forecast consistently overforecast wind generation by an average of 312.1 MW, with a Mean Absolute Error of 845.2 MW and a WAPE of 7.4%. In the worst 10% of intervals, error swung up to 1,620.0 MW. Traders likely carried more day-ahead power into the delivery period than the wind fleet actually produced."
}
```

---

### 2.3 Decision Day Details
#### `GET /api/v1/decisions/{decision_date}`
- **Path Parameter**:
  - `decision_date` (date, format `YYYY-MM-DD`): Decision date.
- **Query Parameters**:
  - `selection_policy` (string, optional): Selection policy override.
  - `rebuild` (bool, default `false`): Recalculate snapshot from stored observations.
- **Response `200 OK`**:
```json
{
  "decision_date": "2026-01-15",
  "delivery_date": "2026-01-16",
  "decision_cutoff_utc": "2026-01-15T10:00:00Z",
  "decision_cutoff_local": "10:00 Europe/London",
  "decision_timezone": "Europe/London",
  "selection_policy": "latest_complete_publication",
  "selected_publication_time_utc": "2026-01-15T09:30:00Z",
  "completeness_status": "COMPLETE",
  "metrics": {
    "mae_mw": 450.5,
    "rmse_mw": 520.1,
    "bias_mw": 420.0,
    "wape_percent": 8.5,
    "p90_abs_error_mw": 750.0,
    "total_energy_error_mwh": 10080.0,
    "matched_intervals": 48,
    "expected_intervals": 48,
    "missing_intervals": 0,
    "coverage_ratio": 1.0,
    "selection_policy": "latest_complete_publication"
  },
  "intervals": [
    {
      "start_time_utc": "2026-01-16T00:00:00Z",
      "forecast_mw": 12800.0,
      "actual_mw": 12400.0,
      "signed_error_mw": 400.0,
      "absolute_error_mw": 400.0,
      "error_mwh": 200.0,
      "forecast_publish_time_utc": "2026-01-15T09:30:00Z",
      "match_status": "MATCHED"
    }
  ],
  "llm_narrative_summary": "On January 15, 2026, wind was overforecast by an average of 420 MW..."
}
```

---

### 2.4 Forecast Evolution
#### `GET /api/v1/forecast-evolution`
- **Query Parameters**:
  - `start_time_utc` (string, required): Delivery interval start time (ISO 8601).
- **Response `200 OK`**:
```json
{
  "start_time_utc": "2026-01-16T12:00:00Z",
  "actual_generation_mw": 13000.0,
  "decision_cutoff_utc": "2026-01-15T10:00:00Z",
  "revisions": [
    {
      "publish_time_utc": "2026-01-15T07:30:00Z",
      "generation_mw": 12000.0,
      "is_eligible_at_cutoff": true,
      "is_selected_in_snapshot": false,
      "error_vs_actual_mw": -1000.0
    },
    {
      "publish_time_utc": "2026-01-15T09:30:00Z",
      "generation_mw": 12500.0,
      "is_eligible_at_cutoff": true,
      "is_selected_in_snapshot": true,
      "error_vs_actual_mw": -500.0
    },
    {
      "publish_time_utc": "2026-01-15T14:30:00Z",
      "generation_mw": 14000.0,
      "is_eligible_at_cutoff": false,
      "is_selected_in_snapshot": false,
      "error_vs_actual_mw": 1000.0
    }
  ],
  "total_revisions": 3
}
```

---

### 2.5 CSV Interval Export
#### `GET /api/v1/exports/intervals.csv`
- **Query Parameters**:
  - `decision_date` (date, required, e.g. `2026-01-15`).
- **Response**: `text/csv; charset=utf-8` stream with `Content-Disposition: attachment; filename="gridbricks_intervals_2026-01-15.csv"`.
- Features formula injection sanitization.
