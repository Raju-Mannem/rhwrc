"""Decision Period Overview Route."""

import calendar
from datetime import date, timedelta

from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session

from app.api.dependencies import get_cache, get_db_session, get_llm
from app.core.config import get_settings
from app.repositories.ingestion_repo import IngestionRepository
from app.repositories.quality_repo import QualityRepository
from app.schemas.accuracy import DailyAccuracyItem
from app.schemas.overview import (
    DecisionConfigSummary,
    IngestionStatusSummary,
    OverviewResponse,
)
from app.services.integrations.cache_service import CacheService
from app.services.integrations.llm_summary import LLMSummarizer
from app.services.metrics.metrics_engine import calculate_metrics_summary
from app.services.normalization.normalizer import (
    derive_decision_date_from_delivery,
    derive_delivery_date,
)
from app.services.snapshots.snapshot_engine import SnapshotEngine

router = APIRouter(prefix="/api/v1", tags=["Overview"])


@router.get("/overview", response_model=OverviewResponse)
def get_decision_overview(
    decision_month: str = Query(
        default="2026-01",
        pattern=r"^\d{4}-\d{2}$",
        description="Month in YYYY-MM format",
    ),
    db: Session = Depends(get_db_session),
    cache: CacheService = Depends(get_cache),
    llm: LLMSummarizer = Depends(get_llm),
):
    """Monthly executive overview comparing eligible day-ahead wind forecasts with actual generation.

    Provides monthly aggregate accuracy metrics, daily breakdowns, and operational health.
    """
    settings = get_settings()
    cache_key = f"gridbricks:overview:{decision_month}:{settings.DECISION_DATE_MODE}"
    cached = cache.get_json(cache_key)
    if cached:
        return cached

    year, month = map(int, decision_month.split("-"))
    num_days = calendar.monthrange(year, month)[1]

    if settings.DECISION_DATE_MODE == "DECISION_DATE":
        decision_from = date(year, month, 1)
        decision_to = date(year, month, num_days)
        delivery_from = derive_delivery_date(decision_from, settings.DECISION_LEAD_DAYS)
        delivery_to = derive_delivery_date(decision_to, settings.DECISION_LEAD_DAYS)
    else:
        # Alternative interpretation: January represents delivery dates
        delivery_from = date(year, month, 1)
        delivery_to = date(year, month, num_days)
        decision_from = derive_decision_date_from_delivery(
            delivery_from, settings.DECISION_LEAD_DAYS
        )
        decision_to = derive_decision_date_from_delivery(delivery_to, settings.DECISION_LEAD_DAYS)

    engine = SnapshotEngine(db)
    existing_snapshots = {
        s.decision_date: s
        for s in engine.snapshot_repo.get_snapshots_in_range(
            decision_from, decision_to, selection_policy=settings.FORECAST_SELECTION_POLICY
        )
    }

    daily_summaries: list[DailyAccuracyItem] = []
    all_matched_pairs: list[tuple[float, float]] = []
    total_expected_intervals = 0

    curr_decision = decision_from
    while curr_decision <= decision_to:
        snapshot = existing_snapshots.get(curr_decision)
        if not snapshot:
            snapshot = engine.build_snapshot_for_date(curr_decision)

        day_matched_pairs: list[tuple[float, float]] = []

        for iv in snapshot.intervals:
            if (
                iv.match_status == "MATCHED"
                and iv.forecast_mw is not None
                and iv.actual_mw is not None
            ):
                pair = (iv.forecast_mw, iv.actual_mw)
                day_matched_pairs.append(pair)
                all_matched_pairs.append(pair)

        day_metrics = calculate_metrics_summary(
            matched_pairs=day_matched_pairs,
            expected_count=snapshot.expected_intervals,
            selection_policy=snapshot.selection_policy,
            duration_hours=0.5,
        )

        total_expected_intervals += snapshot.expected_intervals
        daily_summaries.append(
            DailyAccuracyItem(
                decision_date=snapshot.decision_date,
                delivery_date=snapshot.delivery_date,
                decision_cutoff_utc=snapshot.decision_cutoff_utc.isoformat(),
                completeness_status=snapshot.completeness_status,
                metrics=day_metrics,
            )
        )
        curr_decision += timedelta(days=1)

    # Monthly metrics calculated over aggregate valid intervals
    monthly_metrics = calculate_metrics_summary(
        matched_pairs=all_matched_pairs,
        expected_count=total_expected_intervals,
        selection_policy=settings.FORECAST_SELECTION_POLICY,
        duration_hours=0.5,
    )

    # Ingestion health and warnings
    ingestion_repo = IngestionRepository(db)
    quality_repo = QualityRepository(db)

    last_act_run = ingestion_repo.get_latest_successful_run("FUELHH")
    last_fc_run = ingestion_repo.get_latest_successful_run("WINDFOR")

    recent_issues = quality_repo.get_recent_issues(limit=5)
    warnings = [f"[{i.severity}] {i.issue_type}: {i.description}" for i in recent_issues]

    llm_summary = llm.summarize_metrics(
        context_label=f"Month of {decision_month} ({settings.DECISION_DATE_MODE} Mode)",
        metrics=monthly_metrics,
    )

    config_summary = DecisionConfigSummary(
        decision_date_mode=settings.DECISION_DATE_MODE,
        decision_timezone=settings.DECISION_TIMEZONE,
        decision_cutoff_local_time=settings.DECISION_CUTOFF_LOCAL_TIME,
        decision_lead_days=settings.DECISION_LEAD_DAYS,
        decision_cutoff_inclusive=settings.DECISION_CUTOFF_INCLUSIVE,
        selection_policy=settings.FORECAST_SELECTION_POLICY,
        fallback_policy=settings.SNAPSHOT_FALLBACK_POLICY,
        completeness_threshold=settings.SNAPSHOT_COMPLETENESS_THRESHOLD,
        interval_alignment=settings.FORECAST_INTERVAL_ALIGNMENT,
    )

    response = OverviewResponse(
        decision_month=decision_month,
        decision_window_from=decision_from,
        decision_window_to=decision_to,
        delivery_window_from=delivery_from,
        delivery_window_to=delivery_to,
        configuration=config_summary,
        monthly_metrics=monthly_metrics,
        daily_summaries=daily_summaries,
        ingestion_status=IngestionStatusSummary(
            last_successful_actual_utc=last_act_run.completed_at if last_act_run else None,
            last_successful_forecast_utc=last_fc_run.completed_at if last_fc_run else None,
        ),
        data_quality_warnings=warnings,
        llm_narrative_summary=llm_summary,
    )

    cache.set_json(cache_key, response.model_dump(mode="json"), ttl_seconds=1800)
    return response
