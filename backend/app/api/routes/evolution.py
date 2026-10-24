"""Forecast Evolution Route."""

from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session

from app.api.dependencies import get_db_session
from app.core.config import get_settings
from app.repositories.actual_repo import ActualRepository
from app.repositories.forecast_repo import ForecastRepository
from app.schemas.evolution import ForecastEvolutionItem, ForecastEvolutionResponse
from app.services.normalization.normalizer import (
    compute_decision_cutoff_utc,
    derive_decision_date_from_delivery,
    parse_to_utc_datetime,
)
from app.services.snapshots.snapshot_engine import SnapshotEngine

router = APIRouter(prefix="/api/v1", tags=["Forecast Evolution"])


@router.get("/forecast-evolution", response_model=ForecastEvolutionResponse)
def get_forecast_evolution(
    start_time_utc: str = Query(
        description="Target delivery interval start timestamp in ISO format (e.g. 2026-01-02T12:00:00Z)"
    ),
    db: Session = Depends(get_db_session),
):
    """Retrieve all retained forecast revisions for a specific delivery interval.

    Demonstrates how forecasts evolved over time and clearly distinguishes
    vintages eligible at the decision cutoff from post-cutoff updates.
    """
    settings = get_settings()
    interval_utc = parse_to_utc_datetime(start_time_utc)

    delivery_date = interval_utc.date()
    decision_date = derive_decision_date_from_delivery(delivery_date, settings.DECISION_LEAD_DAYS)
    cutoff_utc = compute_decision_cutoff_utc(decision_date)

    forecast_repo = ForecastRepository(db)
    actual_repo = ActualRepository(db)
    engine = SnapshotEngine(db)

    # Actual outturn for interval
    actual_mw = actual_repo.get_actual_for_interval(interval_utc, fuel_type="WIND")

    # Snapshot to see which version was officially selected
    snapshot = engine.build_snapshot_for_date(decision_date)
    selected_pub_time = None
    for iv in snapshot.intervals:
        if iv.start_time_utc == interval_utc:
            selected_pub_time = iv.forecast_publish_time_utc
            break

    revisions_db = forecast_repo.get_evolution_for_interval(interval_utc)
    items: list[ForecastEvolutionItem] = []

    for r in revisions_db:
        is_eligible = (
            (r.publish_time_utc <= cutoff_utc)
            if settings.DECISION_CUTOFF_INCLUSIVE
            else (r.publish_time_utc < cutoff_utc)
        )
        is_selected = selected_pub_time is not None and r.publish_time_utc == selected_pub_time
        err_vs_act = round(r.generation_mw - actual_mw, 4) if actual_mw is not None else None

        items.append(
            ForecastEvolutionItem(
                publish_time_utc=r.publish_time_utc,
                generation_mw=r.generation_mw,
                is_eligible_at_cutoff=is_eligible,
                is_selected_in_snapshot=is_selected,
                error_vs_actual_mw=err_vs_act,
            )
        )

    return ForecastEvolutionResponse(
        start_time_utc=interval_utc,
        actual_generation_mw=actual_mw,
        decision_cutoff_utc=cutoff_utc,
        revisions=items,
        total_revisions=len(items),
    )
