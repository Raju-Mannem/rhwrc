"""Decision Day Detail Schemas."""

from datetime import date, datetime

from pydantic import BaseModel, Field

from app.schemas.accuracy import MetricsSummary


class IntervalObservationItem(BaseModel):
    """Granular comparison record for a single half-hourly delivery interval."""

    start_time_utc: datetime = Field(description="Target delivery interval start time in UTC")
    forecast_mw: float | None = Field(
        default=None, description="Selected eligible forecast power in MW"
    )
    actual_mw: float | None = Field(
        default=None, description="Eventual actual outturn wind power in MW"
    )
    signed_error_mw: float | None = Field(
        default=None, description="Signed error (Forecast - Actual) in MW. Positive=Overforecast."
    )
    absolute_error_mw: float | None = Field(
        default=None, description="Absolute error |Forecast - Actual| in MW"
    )
    error_mwh: float | None = Field(
        default=None,
        description="Equivalent energy volume error in MWh: (Forecast - Actual) * interval_duration_h",
    )
    forecast_publish_time_utc: datetime | None = Field(
        default=None, description="Publication timestamp of the selected forecast version"
    )
    match_status: str = Field(
        description="Match state: MATCHED, MISSING_FORECAST, MISSING_ACTUAL, EXCLUDED"
    )


class DecisionDayResponse(BaseModel):
    """Response schema for GET /api/v1/decisions/{decision_date}."""

    decision_date: date
    delivery_date: date
    decision_cutoff_utc: datetime
    decision_cutoff_local: str
    decision_timezone: str
    selection_policy: str
    selected_publication_time_utc: datetime | None
    completeness_status: str
    metrics: MetricsSummary
    intervals: list[IntervalObservationItem]
    llm_narrative_summary: str | None = Field(
        default=None, description="Executive plain-English narrative explanation generated via LLM"
    )
