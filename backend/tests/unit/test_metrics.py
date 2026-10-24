"""Unit Tests for Forecast Accuracy Metrics Engine.

Validates MAE, RMSE, Bias, WAPE, P90 absolute error, and energy error conversions
using small hand-calculated datasets with independently known exact answers.
"""

import math

from app.services.metrics.metrics_engine import (
    calculate_metrics_summary,
    compute_absolute_error,
    compute_bias,
    compute_energy_error_mwh,
    compute_mae,
    compute_p90_abs_error,
    compute_rmse,
    compute_signed_error,
    compute_wape,
)


def test_hand_calculated_accuracy_metrics():
    """Verify metrics against exact hand-calculated figures.

    F = [100.0, 200.0, 300.0, 400.0]
    A = [120.0, 180.0, 350.0, 350.0]
    e = [-20.0, +20.0, -50.0, +50.0]
    """
    forecasts = [100.0, 200.0, 300.0, 400.0]
    actuals = [120.0, 180.0, 350.0, 350.0]

    # Bias
    bias = compute_bias(forecasts, actuals)
    assert bias == 0.0

    # MAE: (20 + 20 + 50 + 50) / 4 = 35.0 MW
    mae = compute_mae(forecasts, actuals)
    assert mae == 35.0

    # RMSE: sqrt((400 + 400 + 2500 + 2500) / 4) = sqrt(1450) = 38.0789 MW
    rmse = compute_rmse(forecasts, actuals)
    assert rmse is not None
    assert math.isclose(rmse, math.sqrt(1450.0), rel_tol=1e-4)

    # WAPE: 140 / 1000 * 100 = 14.0 %
    wape = compute_wape(forecasts, actuals)
    assert wape == 14.0

    # P90 absolute error: index = 3 * 0.9 = 2.7 -> 50.0 MW
    p90 = compute_p90_abs_error(forecasts, actuals)
    assert p90 == 50.0


def test_signed_error_convention():
    """Sign convention check: Positive for overforecast, Negative for underforecast."""
    # Overforecast: Forecast 500 MW, Actual 400 MW -> +100 MW
    over = compute_signed_error(500.0, 400.0)
    assert over == 100.0

    # Underforecast: Forecast 300 MW, Actual 450 MW -> -150 MW
    under = compute_signed_error(300.0, 450.0)
    assert under == -150.0

    # Absolute errors
    assert compute_absolute_error(500.0, 400.0) == 100.0
    assert compute_absolute_error(300.0, 450.0) == 150.0


def test_energy_error_mwh_conversion():
    """Verify conversion of power error (MW) to equivalent energy (MWh).

    duration = 0.5 hours (30 min half-hour).
    """
    # Overforecast by 200 MW for 0.5 hours = +100 MWh
    mwh = compute_energy_error_mwh(600.0, 400.0, duration_hours=0.5)
    assert mwh == 100.0

    # Underforecast by 300 MW for 0.5 hours = -150 MWh
    under_mwh = compute_energy_error_mwh(200.0, 500.0, duration_hours=0.5)
    assert under_mwh == -150.0


def test_empty_dataset_handling():
    """Degenerate case: Empty population must return None for metrics, not fail."""
    assert compute_mae([], []) is None
    assert compute_rmse([], []) is None
    assert compute_bias([], []) is None
    assert compute_wape([], []) is None
    assert compute_p90_abs_error([], []) is None

    summary = calculate_metrics_summary(
        matched_pairs=[],
        expected_count=48,
        selection_policy="latest_complete_publication",
    )
    assert summary.mae_mw is None
    assert summary.matched_intervals == 0
    assert summary.expected_intervals == 48
    assert summary.missing_intervals == 48
    assert summary.coverage_ratio == 0.0


def test_zero_denominator_wape():
    """Degenerate case: sum(actuals) == 0.0 must return None without division by zero error."""
    forecasts = [10.0, 20.0]
    actuals = [0.0, 0.0]
    wape = compute_wape(forecasts, actuals)
    assert wape is None


def test_single_observation_p90():
    """Boundary case: Single observation must return its absolute error as P90."""
    p90 = compute_p90_abs_error([100.0], [80.0])
    assert p90 == 20.0
