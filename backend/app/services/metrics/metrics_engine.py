"""Forecast Accuracy Metrics Calculation Engine.

Pure, independently testable mathematical routines for wind forecast accuracy.
Implements standard industry metrics: MAE, RMSE, Bias, WAPE, and P90 absolute error.
"""

import math
from collections.abc import Sequence

from app.schemas.accuracy import MetricsSummary


def compute_signed_error(forecast_mw: float, actual_mw: float) -> float:
    """Signed forecast error in MW.

    Sign Convention:
    Positive (> 0): Overforecast (Forecast was higher than actual generation).
    Negative (< 0): Underforecast (Forecast was lower than actual generation).
    """
    return round(forecast_mw - actual_mw, 4)


def compute_absolute_error(forecast_mw: float, actual_mw: float) -> float:
    """Absolute forecast error in MW: |Forecast - Actual|."""
    return round(abs(forecast_mw - actual_mw), 4)


def compute_energy_error_mwh(
    forecast_mw: float,
    actual_mw: float,
    duration_hours: float = 0.5,
) -> float:
    """Equivalent energy error volume in MWh: (Forecast - Actual) * interval_duration_h."""
    return round((forecast_mw - actual_mw) * duration_hours, 4)


def compute_mae(forecasts: Sequence[float], actuals: Sequence[float]) -> float | None:
    """Mean Absolute Error (MAE) in MW: mean(|F - A|)."""
    if not forecasts or not actuals or len(forecasts) != len(actuals):
        return None
    abs_errors = [abs(f - a) for f, a in zip(forecasts, actuals, strict=False)]
    return round(sum(abs_errors) / len(abs_errors), 4)


def compute_rmse(forecasts: Sequence[float], actuals: Sequence[float]) -> float | None:
    """Root Mean Squared Error (RMSE) in MW: sqrt(mean((F - A)^2))."""
    if not forecasts or not actuals or len(forecasts) != len(actuals):
        return None
    squared_errors = [(f - a) ** 2 for f, a in zip(forecasts, actuals, strict=False)]
    return round(math.sqrt(sum(squared_errors) / len(squared_errors)), 4)


def compute_bias(forecasts: Sequence[float], actuals: Sequence[float]) -> float | None:
    """Mean Forecast Error / Bias in MW: mean(F - A).

    Positive: persistent overforecasting.
    Negative: persistent underforecasting.
    """
    if not forecasts or not actuals or len(forecasts) != len(actuals):
        return None
    errors = [f - a for f, a in zip(forecasts, actuals, strict=False)]
    return round(sum(errors) / len(errors), 4)


def compute_wape(forecasts: Sequence[float], actuals: Sequence[float]) -> float | None:
    """Weighted Absolute Percentage Error (WAPE) in %: sum(|F - A|) / sum(A) * 100.

    Returns None if sum(actuals) == 0.0 to prevent division by zero.
    """
    if not forecasts or not actuals or len(forecasts) != len(actuals):
        return None
    sum_actuals = sum(actuals)
    if math.isclose(sum_actuals, 0.0, abs_tol=1e-9):
        return None
    sum_abs_errors = sum(abs(f - a) for f, a in zip(forecasts, actuals, strict=False))
    return round((sum_abs_errors / sum_actuals) * 100.0, 4)


def compute_p90_abs_error(forecasts: Sequence[float], actuals: Sequence[float]) -> float | None:
    """Deterministic 90th percentile of absolute errors in MW.

    Uses linear interpolation method (equivalent to numpy percentile / method='weibull' or 'linear').
    """
    if not forecasts or not actuals or len(forecasts) != len(actuals):
        return None

    abs_errors = sorted(abs(f - a) for f, a in zip(forecasts, actuals, strict=False))
    n = len(abs_errors)
    if n == 1:
        return round(abs_errors[0], 4)

    # 90th percentile index using standard (n - 1) * 0.90
    index = (n - 1) * 0.90
    lower = int(math.floor(index))
    upper = int(math.ceil(index))
    weight = index - lower

    p90 = abs_errors[lower] + weight * (abs_errors[upper] - abs_errors[lower])
    return round(p90, 4)


def calculate_metrics_summary(
    matched_pairs: list[tuple[float, float]],
    expected_count: int,
    selection_policy: str,
    duration_hours: float = 0.5,
) -> MetricsSummary:
    """Calculate comprehensive MetricsSummary for a collection of (forecast_mw, actual_mw) pairs."""
    matched_count = len(matched_pairs)
    missing_count = max(0, expected_count - matched_count)
    coverage_ratio = round(matched_count / expected_count, 4) if expected_count > 0 else 0.0

    if matched_count == 0:
        return MetricsSummary(
            mae_mw=None,
            rmse_mw=None,
            bias_mw=None,
            wape_percent=None,
            p90_abs_error_mw=None,
            total_energy_error_mwh=None,
            matched_intervals=0,
            expected_intervals=expected_count,
            missing_intervals=missing_count,
            coverage_ratio=coverage_ratio,
            selection_policy=selection_policy,
            population_notes="No matched forecast/actual intervals available.",
        )

    forecasts = [p[0] for p in matched_pairs]
    actuals = [p[1] for p in matched_pairs]

    mae = compute_mae(forecasts, actuals)
    rmse = compute_rmse(forecasts, actuals)
    bias = compute_bias(forecasts, actuals)
    wape = compute_wape(forecasts, actuals)
    p90 = compute_p90_abs_error(forecasts, actuals)
    total_energy_error = round(sum((f - a) * duration_hours for f, a in matched_pairs), 4)

    return MetricsSummary(
        mae_mw=mae,
        rmse_mw=rmse,
        bias_mw=bias,
        wape_percent=wape,
        p90_abs_error_mw=p90,
        total_energy_error_mwh=total_energy_error,
        matched_intervals=matched_count,
        expected_intervals=expected_count,
        missing_intervals=missing_count,
        coverage_ratio=coverage_ratio,
        selection_policy=selection_policy,
        population_notes=f"Calculated over {matched_count} matched intervals out of {expected_count} expected.",
    )
