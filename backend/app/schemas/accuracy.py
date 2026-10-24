"""Accuracy metrics schemas."""

from datetime import date

from pydantic import BaseModel, Field


class MetricsSummary(BaseModel):
    """Core forecast accuracy metrics calculated over a population of matched intervals."""

    mae_mw: float | None = Field(
        default=None, description="Mean Absolute Error in MW: mean(|Forecast - Actual|)"
    )
    rmse_mw: float | None = Field(
        default=None, description="Root Mean Squared Error in MW: sqrt(mean((Forecast - Actual)^2))"
    )
    bias_mw: float | None = Field(
        default=None,
        description="Forecast Bias / Mean Error in MW: mean(Forecast - Actual). Positive=Overforecast.",
    )
    wape_percent: float | None = Field(
        default=None,
        description="Weighted Absolute Percentage Error (%): sum(|F - A|) / sum(A) * 100",
    )
    p90_abs_error_mw: float | None = Field(
        default=None, description="90th percentile of absolute error |F - A| in MW"
    )
    total_energy_error_mwh: float | None = Field(
        default=None, description="Total net energy-equivalent error in MWh: sum((F - A) * dt)"
    )
    matched_intervals: int = Field(
        description="Number of valid matched delivery intervals evaluated"
    )
    expected_intervals: int = Field(
        description="Expected interval count for the calendar delivery window"
    )
    missing_intervals: int = Field(
        description="Number of delivery intervals missing forecast or actual data"
    )
    coverage_ratio: float = Field(
        description="Ratio of matched intervals to expected intervals (0.0 to 1.0)"
    )
    selection_policy: str = Field(
        description="Forecast selection policy applied for snapshot construction"
    )
    population_notes: str = Field(default="Calculated strictly over valid matched intervals.")


class DailyAccuracyItem(BaseModel):
    """Daily forecast accuracy and completeness summary."""

    decision_date: date
    delivery_date: date
    decision_cutoff_utc: str
    completeness_status: str  # COMPLETE, MIXED_OR_PARTIAL, INCOMPLETE
    metrics: MetricsSummary


class AccuracySummaryResponse(BaseModel):
    """Response schema for GET /api/v1/accuracy/summary."""

    decision_from: date
    decision_to: date
    delivery_from: date
    delivery_to: date
    decision_date_mode: str
    metrics: MetricsSummary
    llm_narrative_summary: str | None = Field(
        default=None, description="Executive plain-English narrative explanation generated via LLM"
    )


class DailyAccuracyResponse(BaseModel):
    """Response schema for GET /api/v1/accuracy/daily."""

    decision_from: date
    decision_to: date
    days: list[DailyAccuracyItem]
    total_days: int
