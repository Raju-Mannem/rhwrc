"""Decision Month Overview Schemas."""

from datetime import date, datetime

from pydantic import BaseModel, Field

from app.schemas.accuracy import DailyAccuracyItem, MetricsSummary


class DecisionConfigSummary(BaseModel):
    """Runtime market configuration and cutoff assumptions."""

    decision_date_mode: str
    decision_timezone: str
    decision_cutoff_local_time: str
    decision_lead_days: int
    decision_cutoff_inclusive: bool
    selection_policy: str
    fallback_policy: str
    completeness_threshold: float
    interval_alignment: str


class IngestionStatusSummary(BaseModel):
    """Timestamp of the most recent successful ingestions."""

    last_successful_actual_utc: datetime | None
    last_successful_forecast_utc: datetime | None


class OverviewResponse(BaseModel):
    """Response schema for GET /api/v1/overview."""

    decision_month: str = Field(description="Selected decision month, e.g. '2026-01'")
    decision_window_from: date
    decision_window_to: date
    delivery_window_from: date
    delivery_window_to: date
    configuration: DecisionConfigSummary
    monthly_metrics: MetricsSummary
    daily_summaries: list[DailyAccuracyItem]
    ingestion_status: IngestionStatusSummary
    data_quality_warnings: list[str]
    llm_narrative_summary: str | None = Field(
        default=None, description="Executive plain-English narrative explanation generated via LLM"
    )
