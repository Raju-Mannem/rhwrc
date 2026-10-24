"""Unit Tests for Colloquial LLM Summarizer."""

from app.schemas.accuracy import MetricsSummary
from app.services.integrations.llm_summary import (
    generate_fallback_colloquial_summary,
)


def test_overforecast_colloquial_summary():
    """Verify narrative when wind generation was persistently overforecast."""
    metrics = MetricsSummary(
        mae_mw=450.5,
        rmse_mw=520.1,
        bias_mw=420.0,  # Overforecast
        wape_percent=8.5,
        p90_abs_error_mw=750.0,
        total_energy_error_mwh=10080.0,
        matched_intervals=48,
        expected_intervals=48,
        missing_intervals=0,
        coverage_ratio=1.0,
        selection_policy="latest_complete_publication",
    )

    summary = generate_fallback_colloquial_summary(
        context_label="2026-01-15",
        metrics=metrics,
        highlight_interval="14:00 UTC (+850 MW)",
    )

    assert "overforecast" in summary.lower()
    assert "420.0 MW" in summary or "420" in summary
    assert "450.5 MW" in summary or "450" in summary
    assert "14:00 UTC" in summary
    assert "100.0% coverage" in summary


def test_underforecast_colloquial_summary():
    """Verify narrative when wind generation was underforecast."""
    metrics = MetricsSummary(
        mae_mw=300.0,
        rmse_mw=350.0,
        bias_mw=-250.0,  # Underforecast
        wape_percent=6.2,
        p90_abs_error_mw=450.0,
        total_energy_error_mwh=-6000.0,
        matched_intervals=48,
        expected_intervals=48,
        missing_intervals=0,
        coverage_ratio=1.0,
        selection_policy="latest_complete_publication",
    )

    summary = generate_fallback_colloquial_summary(
        context_label="2026-01-20",
        metrics=metrics,
    )

    assert "underforecast" in summary.lower()
    assert "250.0 MW" in summary or "250" in summary


def test_empty_population_summary():
    """Verify narrative handles empty population gracefully."""
    metrics = MetricsSummary(
        mae_mw=None,
        rmse_mw=None,
        bias_mw=None,
        wape_percent=None,
        p90_abs_error_mw=None,
        total_energy_error_mwh=None,
        matched_intervals=0,
        expected_intervals=48,
        missing_intervals=48,
        coverage_ratio=0.0,
        selection_policy="latest_complete_publication",
    )

    summary = generate_fallback_colloquial_summary(
        context_label="2026-01-25",
        metrics=metrics,
    )

    assert "no matching forecast and actual" in summary.lower()
