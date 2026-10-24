"""Decision Day Details Route."""

from datetime import date

from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session

from app.api.dependencies import get_db_session, get_llm
from app.core.config import get_settings
from app.schemas.decisions import DecisionDayResponse, IntervalObservationItem
from app.services.integrations.llm_summary import LLMSummarizer
from app.services.metrics.metrics_engine import calculate_metrics_summary
from app.services.snapshots.snapshot_engine import SnapshotEngine

router = APIRouter(prefix="/api/v1/decisions", tags=["Decisions"])


@router.get("/{decision_date}", response_model=DecisionDayResponse)
def get_decision_day(
    decision_date: date,
    selection_policy: str | None = Query(
        default=None, description="Snapshot forecast selection policy"
    ),
    rebuild: bool = Query(
        default=False, description="Whether to recalculate snapshot from raw source data"
    ),
    db: Session = Depends(get_db_session),
    llm: LLMSummarizer = Depends(get_llm),
):
    """Retrieve the official day-ahead procurement decision snapshot for a specific date.

    Guarantees that no forecast published after the decision cutoff is included.
    """
    settings = get_settings()
    engine = SnapshotEngine(db)

    snapshot = engine.build_snapshot_for_date(
        decision_date=decision_date,
        selection_policy=selection_policy,
        force_rebuild=rebuild,
    )

    # Gather matched pairs for metrics calculation
    matched_pairs: list[tuple[float, float]] = []
    interval_items: list[IntervalObservationItem] = []

    for iv in snapshot.intervals:
        if iv.match_status == "MATCHED" and iv.forecast_mw is not None and iv.actual_mw is not None:
            matched_pairs.append((iv.forecast_mw, iv.actual_mw))

        interval_items.append(
            IntervalObservationItem(
                start_time_utc=iv.start_time_utc,
                forecast_mw=iv.forecast_mw,
                actual_mw=iv.actual_mw,
                signed_error_mw=iv.signed_error_mw,
                absolute_error_mw=iv.absolute_error_mw,
                error_mwh=iv.error_mwh,
                forecast_publish_time_utc=iv.forecast_publish_time_utc,
                match_status=iv.match_status,
            )
        )

    metrics = calculate_metrics_summary(
        matched_pairs=matched_pairs,
        expected_count=snapshot.expected_intervals,
        selection_policy=snapshot.selection_policy,
        duration_hours=0.5,
    )

    # Find highest error interval for plain-English highlighting
    max_error_interval = None
    if interval_items:
        valid_intervals = [i for i in interval_items if i.absolute_error_mw is not None]
        if valid_intervals:
            peak = max(valid_intervals, key=lambda x: x.absolute_error_mw or 0.0)
            max_error_interval = (
                f"{peak.start_time_utc.strftime('%H:%M UTC')} ({peak.signed_error_mw:+,.0f} MW)"
            )

    llm_summary = llm.summarize_metrics(
        context_label=f"Decision Date {decision_date.isoformat()} (Delivery {snapshot.delivery_date.isoformat()})",
        metrics=metrics,
        highlight_interval=max_error_interval,
    )

    return DecisionDayResponse(
        decision_date=snapshot.decision_date,
        delivery_date=snapshot.delivery_date,
        decision_cutoff_utc=snapshot.decision_cutoff_utc,
        decision_cutoff_local=snapshot.decision_cutoff_local_time,
        decision_timezone=settings.DECISION_TIMEZONE,
        selection_policy=snapshot.selection_policy,
        selected_publication_time_utc=snapshot.selected_publication_time_utc,
        completeness_status=snapshot.completeness_status,
        metrics=metrics,
        intervals=interval_items,
        llm_narrative_summary=llm_summary,
    )
