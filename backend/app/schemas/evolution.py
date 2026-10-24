"""Forecast Evolution Schemas."""

from datetime import datetime

from pydantic import BaseModel, Field


class ForecastEvolutionItem(BaseModel):
    """An individual forecast vintage for a specific delivery interval."""

    publish_time_utc: datetime = Field(
        description="When this forecast was published by National Grid ESO"
    )
    generation_mw: float = Field(description="Predicted wind generation power in MW")
    is_eligible_at_cutoff: bool = Field(
        description="Whether this forecast was published at or before the day-ahead decision cutoff"
    )
    is_selected_in_snapshot: bool = Field(
        description="Whether this specific vintage was selected in the official day-ahead decision snapshot"
    )
    error_vs_actual_mw: float | None = Field(
        default=None, description="Signed error (Forecast - Actual) in MW against eventual outturn"
    )


class ForecastEvolutionResponse(BaseModel):
    """Response schema for GET /api/v1/forecast-evolution."""

    start_time_utc: datetime = Field(description="Target delivery interval start timestamp in UTC")
    actual_generation_mw: float | None = Field(
        default=None, description="Eventual actual outturn wind generation in MW"
    )
    decision_cutoff_utc: datetime | None = Field(
        default=None, description="Day-ahead decision cutoff timestamp applicable to this interval"
    )
    revisions: list[ForecastEvolutionItem] = Field(
        description="All retained forecast vintages ordered chronologically by publishTime"
    )
    total_revisions: int
