# Gridbricks Backend API Integration Contract

## 1. Verified Endpoints & Contract Mapping

The frontend communicates with the FastAPI backend through the following typed routes:

| Purpose | Backend Endpoint | HTTP Method | Frontend Hook / Function |
|---|---|---|---|
| **Liveness Check** | `/health/live` | GET | Health verification |
| **Readiness Check** | `/health/ready` | GET | Database & cache status |
| **Monthly Overview** | `/api/v1/overview?decision_month=2026-01` | GET | `useOverviewQuery(month)` |
| **Decision Day Detail**| `/api/v1/decisions/{decision_date}` | GET | `useDecisionDayQuery(date)` |
| **Forecast Evolution** | `/api/v1/forecast-evolution?start_time_utc=...` | GET | `useForecastEvolutionQuery(utc)` |
| **Data Quality & Health**| `/api/v1/data-health` | GET | `useDataHealthQuery()` |
| **Ingestion Run History**| `/api/v1/ingestion/runs?page=1&page_size=20` | GET | `useIngestionRunsQuery()` |
| **Interval CSV Export** | `/api/v1/exports/intervals.csv?decision_date=...` | GET | `downloadIntervalsCsv(date)` |

---

## 2. Temporal & Cutoff Conventions

1. **Storage and Transport**:
   - Timestamps are transported in standard ISO 8601 UTC format (`YYYY-MM-DDTHH:mm:ssZ`).
2. **Display Timezone**:
   - The user interface renders all dates and times in `Europe/London` strictly using `Intl.DateTimeFormat`.
3. **Default Assignment Period**:
   - Default decision month: **January 2026** (`2026-01-01` to `2026-01-31`).
   - Default delivery dates: `2026-01-02` to `2026-02-01` (1-day ahead lead time).
4. **Enforced Decision Cutoff**:
   - Configured cutoff: **10:00 Europe/London** (`DECISION_CUTOFF_LOCAL_TIME=10:00`).
   - Forecast selection policy: `LATEST_STRICT` guarantees no forecast published after the cutoff is included in the snapshot.

---

## 3. Error Handling (RFC 7807)

When backend validation fails (e.g. invalid date formats, date inversion, missing resource), the backend returns RFC 7807 Problem Details:
```json
{
  "type": "urn:gridbricks:error:validation",
  "title": "Request Validation Error",
  "status": 422,
  "detail": "The request parameters failed validation schema checks.",
  "instance": "/api/v1/accuracy/summary"
}
```
The frontend's `ApiError` class parses this response and renders user-friendly error banners and retry actions.

---

## 4. Contract Gaps & Offline Fallback Strategy

- **Live Backend Availability**: When the FastAPI server runs on port 8000, all responses are live and authoritative.
- **Offline / Disconnected State**: If the backend is unreachable or undergoing maintenance, the application enters **`DEMO FIXTURE MODE`**.
  - A prominent amber badge informs the user that deterministic fixtures are currently displayed.
  - Realistic scenarios are modeled (complete days, missing observations, storm overforecasts, and post-cutoff revisions).
  - No synthetic production metrics are ever presented without this explicit label.
