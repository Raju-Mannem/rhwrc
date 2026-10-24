# Gridbricks Assumptions & Business Rules Register

This document explicitly catalogs every business assumption, market deadline interpretation, temporal rule, and source limitation incorporated into Gridbricks. **No unverified assumption is presented as confirmed client fact.**

---

## 1. Analysis Period: Decision Dates vs. Delivery Dates
- **Default Policy (`DECISION_DATE_MODE=DECISION_DATE`)**:
  - The configured period **January 1–31, 2026** represents **decision dates** on which day-ahead electricity procurement commitments are finalized.
  - Applying a 1-calendar-day lead time (`DECISION_LEAD_DAYS=1`), the corresponding delivery window spans **January 2–February 1, 2026**, inclusive.
  - In a standard UK delivery month, each day comprises 48 half-hourly settlement intervals. The 31 delivery days in this window therefore yield **1,488 expected half-hourly intervals**.
- **Alternative Interpretation (`DECISION_DATE_MODE=DELIVERY_DATE`)**:
  - If January 1–31 represents **delivery dates**, decision dates shift to **December 31, 2025 – January 30, 2026**.
  - This mode is fully supported via configuration, and the active mode is always explicitly declared in API metadata and exports.

---

## 2. Decision Purchasing Cutoff Placeholder
- **Unverified Placeholder (`DECISION_CUTOFF_LOCAL_TIME=10:00`)**:
  - The exact commercial day-ahead gate closure deadline has not been supplied by the client.
  - `10:00 Europe/London` is used as an unconfirmed local demonstration placeholder, representative of typical pre-gate power scheduling workflows.
  - It is **not** an official statutory UK electricity market deadline (such as the 11:00 or 12:00 Day-Ahead Auction cutoffs on EPEX SPOT / Nord Pool).
  - Configurable via `DECISION_CUTOFF_LOCAL_TIME` in `.env`.
- **Timezone Awareness (`DECISION_TIMEZONE=Europe/London`)**:
  - The local cutoff is converted to a timezone-aware UTC instant before querying database records or source APIs.
  - In January (GMT / UTC+0), `10:00 Europe/London` equals `10:00:00 UTC`.
  - In summer (BST / UTC+1), `10:00 Europe/London` automatically shifts to `09:00:00 UTC`.
- **Inclusivity Policy (`DECISION_CUTOFF_INCLUSIVE=true`)**:
  - By default, forecasts published *exactly* at the cutoff instant (`publish_time <= cutoff_utc`) are eligible for selection.
  - If set to `false`, only forecasts published strictly before (`publish_time < cutoff_utc`) are eligible.

---

## 3. Forecast Dataset Semantics & Publication Lineage (Elexon WINDFOR)
- **Hourly vs. Half-Hourly Resolution**:
  - National Grid ESO publishes wind forecasts via the `WINDFOR` stream at **hourly timestamps** (`:00`), whereas outturn actual generation (`FUELHH`) is recorded at **half-hourly settlement intervals** (`:00` and `:30`).
  - **Alignment Rule (`FORECAST_INTERVAL_ALIGNMENT=STEP_FORWARD`)**:
    - Under the default `STEP_FORWARD` policy, an hourly forecast for delivery hour `HH:00` is carried forward to cover the second settlement half-hour of that hour (`HH:30`).
    - Under the alternative `EXACT` policy, only `:00` intervals are matched; `:30` intervals are flagged as missing forecast coverage (yielding 24 matched intervals per day).
- **Historical Version Retention**:
  - Multiple forecast publications are issued each day (e.g. 02:30, 04:30, 07:30, 09:30, 11:30, 14:00, 16:30, 22:30).
  - Later forecast versions never overwrite earlier versions in the database. Every historical version is permanently retained using the natural key `(start_time_utc, publish_time_utc)`.

---

## 4. Snapshot Selection Engine Policies
- **Preferred Policy (`latest_complete_publication`)**:
  - Identifies candidate forecast publications published at or before the decision cutoff.
  - Evaluates interval coverage for each publication against the target delivery date.
  - Selects the latest publication version that satisfies the completeness threshold (`SNAPSHOT_COMPLETENESS_THRESHOLD=0.95`).
  - Provides a single, coherent forecast run across the delivery day without mixing vintages unnecessarily.
- **Fallback Policy (`latest_per_interval`)**:
  - If no single publication satisfies the completeness threshold, the engine falls back to selecting the latest eligible forecast published before cutoff for each interval individually.
  - The snapshot is explicitly marked as `MIXED_OR_PARTIAL`, and the publication timestamp for each interval is recorded in provenance fields.

---

## 5. Actual Outturn Generation (Elexon FUELHH)
- **Average Power vs. Energy Volume**:
  - `FUELHH` generation values represent **average power in MW** over the 30-minute interval.
  - Energy volumes in MWh are calculated explicitly as:
    $$\text{Energy MWh} = \text{Power MW} \times 0.5\,\text{h}$$
  - No MWh to MW unit confusion is permitted in source parsing or database storage.

---

## 6. Population Comparability & Missing Data
- **No Zero Substitution**:
  - Absent forecasts or actuals are never silently filled with 0.0 MW.
  - Legitimate 0.0 MW generation (e.g. calm wind conditions) is preserved as valid.
- **Accuracy Population**:
  - Summary metrics (MAE, RMSE, Bias, WAPE, P90) are calculated **strictly over valid matched intervals** where both forecast and actual exist.
  - Missing or unmatched intervals are reported in coverage and completeness counters.

---

## 7. Metric Definitions & Formulas
- **Error Sign Convention**:
  $$e = F - A$$
  - Positive ($e > 0$): **Overforecast** (Wind was predicted higher than actual outturn).
  - Negative ($e < 0$): **Underforecast** (Wind was predicted lower than actual outturn).
- **WAPE Zero-Denominator Rule**:
  - If $\sum A = 0$, WAPE is undefined and returned as `null` rather than generating a division-by-zero error.
- **P90 Method**:
  - Uses deterministic linear interpolation between ordered absolute error ranks.

---

## 8. Procurement Planning vs. Physical Dispatch Boundary
- Wind forecast errors highlight day-ahead procurement exposure but do **not** represent net system imbalance volumes or physical balancing actions.
- Wholesale electricity prices, thermal dispatch costs, consumer demand profiles, and bilateral contracts are strictly outside the permitted two-dataset scope.
