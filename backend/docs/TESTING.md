# Gridbricks Automated Test Strategy & Verification Evidence

Automated testing is a hard release gate in Gridbricks. This document outlines the test strategy, execution commands, hand-calculated verification benchmarks, and critical temporal regression proofs.

---

## 1. Test Architecture & Layers

```text
tests/
├── conftest.py                          # In-memory DB, StaticPool, FastAPI TestClient
├── fixtures/
│   ├── fuelhh_samples.json              # Captured Elexon FUELHH actuals outturn
│   └── windfor_samples.json             # Captured Elexon WINDFOR forecast publications
├── unit/
│   ├── test_metrics.py                  # Hand-calculated MAE, RMSE, Bias, WAPE, P90, MWh
│   ├── test_temporal_rules.py           # DST spring/fall transitions, timezone math
│   ├── test_snapshot_engine.py          # Complete vs fallback selection, coverage
│   └── test_llm_summary.py              # Colloquial narrative summaries & templates
├── contract/
│   ├── test_fuelhh_contract.py          # FUELHH JSON schema & client-side WIND filter
│   └── test_windfor_contract.py         # WINDFOR publication window parsing & error handling
└── integration/
    ├── test_temporal_regression.py      # CRITICAL: Future forecast non-leakage proof
    ├── test_ingestion_pipeline.py       # Full audit run & database idempotency
    ├── test_api_endpoints.py            # All 8 REST endpoints & schema validation
    ├── test_csv_export.py               # CSV export reconciliation & formula injection
    └── test_cli.py                      # Operational Click CLI runner commands
```

---

## 2. Test Execution Commands

```bash
# Run the entire test suite
uv run pytest -v

# Run with test coverage measurement
uv run pytest tests/ --cov=app --cov-report=term-missing

# Run only the critical temporal regression tests
uv run pytest tests/integration/test_temporal_regression.py -v

# Run metric verification tests
uv run pytest tests/unit/test_metrics.py -v
```

---

## 3. Hand-Calculated Metric Benchmarks

In `tests/unit/test_metrics.py`, metrics are verified against small hand-calculated datasets with independently known exact answers:

| Observation | Forecast $F$ (MW) | Actual $A$ (MW) | Signed Error $e$ (MW) | Absolute Error $\|e\|$ (MW) | Error MWh ($\Delta t = 0.5$) |
| :---: | :---: | :---: | :---: | :---: | :---: |
| 1 | 100.0 | 120.0 | -20.0 | 20.0 | -10.0 |
| 2 | 200.0 | 180.0 | +20.0 | 20.0 | +10.0 |
| 3 | 300.0 | 350.0 | -50.0 | 50.0 | -25.0 |
| 4 | 400.0 | 350.0 | +50.0 | 50.0 | +25.0 |
| **Sum** | **1,000.0** | **1,000.0** | **0.0** | **140.0** | **0.0** |

- **Mean Error / Bias**: $\frac{0.0}{4} = \mathbf{0.0\,\text{MW}}$
- **Mean Absolute Error (MAE)**: $\frac{140.0}{4} = \mathbf{35.0\,\text{MW}}$
- **Root Mean Squared Error (RMSE)**: $\sqrt{\frac{400 + 400 + 2500 + 2500}{4}} = \sqrt{1450} = \mathbf{38.0789\,\text{MW}}$
- **WAPE**: $\frac{140.0}{1000.0} \times 100\% = \mathbf{14.0\%}$
- **P90 Absolute Error**: Deterministic 90th percentile = $\mathbf{50.0\,\text{MW}}$
- **Net Energy Error**: $\mathbf{0.0\,\text{MWh}}$

---

## 4. Critical Temporal Regression Proof

Located in `tests/integration/test_temporal_regression.py`.

### Scenario Tested:
For a delivery interval at `2026-01-16 12:00:00 UTC` under a `2026-01-15 10:00:00 UTC` decision cutoff:
1. Ingest forecast $F_1 = 12,000\,\text{MW}$ published at `07:30 UTC` (before cutoff).
2. Ingest forecast $F_2 = 12,500\,\text{MW}$ published at `09:30 UTC` (before cutoff).
3. Ingest forecast $F_3 = 14,000\,\text{MW}$ published at `14:30 UTC` (after cutoff).
4. Ingest actual outturn $A = 13,000\,\text{MW}$.
5. **Assertion 1**: The decision snapshot selects $F_2 = 12,500\,\text{MW}$ (the latest eligible forecast before cutoff). Forecast $F_3$ (14,000 MW) is strictly excluded.
6. Ingest forecast $F_4 = 13,100\,\text{MW}$ published at `2026-01-16 06:00 UTC` (closer to real-time).
7. **Assertion 2**: Rebuilding the snapshot proves that the historical decision snapshot remains strictly unmutated at $12,500\,\text{MW}$. No future data leakage can occur.
