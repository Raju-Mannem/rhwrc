"""Accuracy Analytics Routes."""

from datetime import date, timedelta

from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session

from app.api.dependencies import get_db_session, get_llm
from app.core.config import get_settings
from app.core.exceptions import TemporalRuleError
from app.schemas.accuracy import (
    AccuracySummaryResponse,
    DailyAccuracyItem,
    DailyAccuracyResponse,
)
from app.services.integrations.llm_summary import LLMSummarizer
from app.services.metrics.metrics_engine import calculate_metrics_summary
from app.services.normalization.normalizer import derive_delivery_date
from app.services.snapshots.snapshot_engine import SnapshotEngine

router = APIRouter(prefix="/api/v1/accuracy", tags=["Accuracy Analytics"])


@router.get("/summary", response_model=AccuracySummaryResponse)
def get_accuracy_summary(
    decision_from: date = Query(
        default=date(2026, 1, 1), description="Start of decision date range"
    ),
    decision_to: date = Query(default=date(2026, 1, 31), description="End of decision date range"),
    selection_policy: str | None = Query(default=None),
    db: Session = Depends(get_db_session),
    llm: LLMSummarizer = Depends(get_llm),
):
    """Aggregate accuracy summary calculated strictly over matched intervals across the specified period."""
    if decision_from > decision_to:
        raise TemporalRuleError("decision_from cannot be after decision_to", str(decision_from))

    settings = get_settings()
    policy = selection_policy or settings.FORECAST_SELECTION_POLICY
    engine = SnapshotEngine(db)

    all_matched_pairs: list[tuple[float, float]] = []
    total_expected = 0

    curr = decision_from
    while curr <= decision_to:
        snapshot = engine.build_snapshot_for_date(curr, selection_policy=policy)
        for iv in snapshot.intervals:
            if (
                iv.match_status == "MATCHED"
                and iv.forecast_mw is not None
                and iv.actual_mw is not None
            ):
                all_matched_pairs.append((iv.forecast_mw, iv.actual_mw))
        total_expected += snapshot.expected_intervals
        curr += timedelta(days=1)

    delivery_from = derive_delivery_date(decision_from, settings.DECISION_LEAD_DAYS)
    delivery_to = derive_delivery_date(decision_to, settings.DECISION_LEAD_DAYS)

    metrics = calculate_metrics_summary(
        matched_pairs=all_matched_pairs,
        expected_count=total_expected,
        selection_policy=policy,
        duration_hours=0.5,
    )

    llm_summary = llm.summarize_metrics(
        context_label=f"Decisions from {decision_from} to {decision_to}",
        metrics=metrics,
    )

    return AccuracySummaryResponse(
        decision_from=decision_from,
        decision_to=decision_to,
        delivery_from=delivery_from,
        delivery_to=delivery_to,
        decision_date_mode=settings.DECISION_DATE_MODE,
        metrics=metrics,
        llm_narrative_summary=llm_summary,
    )


@router.get("/daily", response_model=DailyAccuracyResponse)
def get_daily_accuracy(
    decision_from: date = Query(default=date(2026, 1, 1)),
    decision_to: date = Query(default=date(2026, 1, 31)),
    selection_policy: str | None = Query(default=None),
    db: Session = Depends(get_db_session),
):
    """Time-series of daily accuracy metrics and completeness indicators."""
    if decision_from > decision_to:
        raise TemporalRuleError("decision_from cannot be after decision_to", str(decision_from))

    settings = get_settings()
    policy = selection_policy or settings.FORECAST_SELECTION_POLICY
    engine = SnapshotEngine(db)

    days: list[DailyAccuracyItem] = []
    curr = decision_from

    while curr <= decision_to:
        snapshot = engine.build_snapshot_for_date(curr, selection_policy=policy)
        matched_pairs: list[tuple[float, float]] = []

        for iv in snapshot.intervals:
            if (
                iv.match_status == "MATCHED"
                and iv.forecast_mw is not None
                and iv.actual_mw is not None
            ):
                matched_pairs.append((iv.forecast_mw, iv.actual_mw))

        day_metrics = calculate_metrics_summary(
            matched_pairs=matched_pairs,
            expected_count=snapshot.expected_intervals,
            selection_policy=snapshot.selection_policy,
            duration_hours=0.5,
        )

        days.append(
            DailyAccuracyItem(
                decision_date=snapshot.decision_date,
                delivery_date=snapshot.delivery_date,
                decision_cutoff_utc=snapshot.decision_cutoff_utc.isoformat(),
                completeness_status=snapshot.completeness_status,
                metrics=day_metrics,
            )
        )
        curr += timedelta(days=1)

    return DailyAccuracyResponse(
        decision_from=decision_from,
        decision_to=decision_to,
        days=days,
        total_days=len(days),
    )
