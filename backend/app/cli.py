"""Gridbricks Operational CLI Commands.

Provides executable CLI tasks for connectivity checks, historical backfills,
idempotent incremental ingestion, snapshot rebuilding, and data quality reporting.
"""

import sys
from datetime import date, datetime, timedelta

import click

from app.core.config import get_settings
from app.core.logging import setup_logging
from app.db.session import SessionLocal, check_database_health
from app.repositories.quality_repo import QualityRepository
from app.services.elexon.fuelhh_client import FuelHHClient
from app.services.elexon.windfor_client import WindforClient
from app.services.ingestion.ingestion_service import IngestionService
from app.services.normalization.normalizer import (
    compute_decision_cutoff_utc,
    derive_delivery_date,
    parse_to_utc_datetime,
)
from app.services.snapshots.snapshot_engine import SnapshotEngine


@click.group()
def cli():
    """Gridbricks CLI Operational Interface."""
    setup_logging()


@cli.command("check-config")
def check_config():
    """Validate environment settings and display active configuration."""
    settings = get_settings()
    click.echo("=" * 60)
    click.echo(" Gridbricks Configuration Audit")
    click.echo("=" * 60)
    click.echo(f"Environment:               {settings.ENVIRONMENT}")
    click.echo(
        f"Database URL:              {settings.DATABASE_URL.split('@')[-1] if '@' in settings.DATABASE_URL else settings.DATABASE_URL}"
    )
    click.echo(f"Elexon Base URL:           {settings.ELEXON_BASE_URL}")
    click.echo(f"Decision Date Mode:        {settings.DECISION_DATE_MODE}")
    click.echo(f"Decision Timezone:         {settings.DECISION_TIMEZONE}")
    click.echo(f"Decision Cutoff Local:     {settings.DECISION_CUTOFF_LOCAL_TIME}")
    click.echo(f"Decision Lead Days:        {settings.DECISION_LEAD_DAYS}")
    click.echo(f"Cutoff Inclusive Policy:   {settings.DECISION_CUTOFF_INCLUSIVE}")
    click.echo(f"Forecast Selection Policy: {settings.FORECAST_SELECTION_POLICY}")
    click.echo(f"Completeness Threshold:    {settings.SNAPSHOT_COMPLETENESS_THRESHOLD}")
    click.echo(f"Interval Alignment:        {settings.FORECAST_INTERVAL_ALIGNMENT}")
    click.echo(
        f"Upstash Redis URL:         {'Configured' if settings.UPSTASH_REDIS_URL else 'Unset (Memory Fallback)'}"
    )
    click.echo(
        f"Upstash QStash Token:      {'Configured' if settings.QSTASH_TOKEN else 'Unset (Direct Execution)'}"
    )
    click.echo(
        f"Hugging Face Model:        {settings.HF_LLAMA_MODEL} ({'Token set' if settings.HUGGINGFACE_API_KEY else 'Offline Fallback'})"
    )
    click.echo("=" * 60)
    click.echo("Configuration is valid.")


@cli.command("check-source-connectivity")
def check_source_connectivity():
    """Verify live connectivity to PostgreSQL/Neon DB and Elexon BMRS endpoints."""
    click.echo("Checking database connectivity...")
    if check_database_health():
        click.echo("  [OK] Database connection active.")
    else:
        click.echo("  [FAIL] Database connection failed.")
        sys.exit(1)

    click.echo("Checking Elexon FUELHH endpoint...")
    try:
        with FuelHHClient() as client:
            test_date = date(2026, 1, 2)
            res = client.fetch_actual_wind(test_date, test_date)
            click.echo(f"  [OK] FUELHH responded with {len(res)} WIND records for {test_date}.")
    except Exception as exc:
        click.echo(f"  [FAIL] FUELHH request failed: {exc}")
        sys.exit(1)

    click.echo("Checking Elexon WINDFOR endpoint...")
    try:
        with WindforClient() as client:
            p_from = parse_to_utc_datetime(datetime(2026, 1, 1, 7, 0))
            p_to = parse_to_utc_datetime(datetime(2026, 1, 1, 8, 0))
            res = client.fetch_forecasts_window(p_from, p_to)
            click.echo(f"  [OK] WINDFOR responded with {len(res)} forecast records.")
    except Exception as exc:
        click.echo(f"  [FAIL] WINDFOR request failed: {exc}")
        sys.exit(1)

    click.echo("All connectivity checks PASSED successfully.")


@cli.command("ingest-actuals")
@click.option("--from-date", required=True, type=click.DateTime(formats=["%Y-%m-%d"]))
@click.option("--to-date", required=True, type=click.DateTime(formats=["%Y-%m-%d"]))
def ingest_actuals(from_date: datetime, to_date: datetime):
    """Ingest actual wind generation outturn (FUELHH) for the given delivery date range."""
    d_from = from_date.date()
    d_to = to_date.date()
    click.echo(f"Ingesting FUELHH actuals from {d_from} to {d_to}...")

    with SessionLocal() as db:
        service = IngestionService(db)
        run_id = service.ingest_actuals_range(d_from, d_to)
        click.echo(f"Actuals ingestion completed successfully. Ingestion Run ID: {run_id}")


@cli.command("ingest-forecasts")
@click.option("--decision-from", required=True, type=click.DateTime(formats=["%Y-%m-%d"]))
@click.option("--decision-to", required=True, type=click.DateTime(formats=["%Y-%m-%d"]))
def ingest_forecasts(decision_from: datetime, decision_to: datetime):
    """Ingest WINDFOR forecasts covering the publication lookback for decision dates."""
    settings = get_settings()
    d_from = decision_from.date()
    d_to = decision_to.date()

    earliest_cutoff = compute_decision_cutoff_utc(d_from)
    lookback_start = earliest_cutoff - timedelta(hours=settings.FORECAST_LOOKBACK_HOURS)
    latest_delivery = derive_delivery_date(d_to, settings.DECISION_LEAD_DAYS)
    publication_end = parse_to_utc_datetime(
        datetime.combine(latest_delivery + timedelta(days=1), datetime.min.time())
    )

    click.echo(
        f"Ingesting WINDFOR forecast publications from {lookback_start.isoformat()} to {publication_end.isoformat()}..."
    )

    with SessionLocal() as db:
        service = IngestionService(db)
        run_id = service.ingest_forecasts_range(lookback_start, publication_end)
        click.echo(f"Forecasts ingestion completed successfully. Ingestion Run ID: {run_id}")


@cli.command("backfill")
@click.option("--decision-from", default="2026-01-01", type=click.DateTime(formats=["%Y-%m-%d"]))
@click.option("--decision-to", default="2026-01-31", type=click.DateTime(formats=["%Y-%m-%d"]))
def backfill(decision_from: datetime, decision_to: datetime):
    """Execute complete historical backfill (FUELHH, WINDFOR, and decision snapshots)."""
    d_from = decision_from.date()
    d_to = decision_to.date()
    click.echo(f"Starting historical backfill for decision dates {d_from} to {d_to}...")

    with SessionLocal() as db:
        service = IngestionService(db)
        res = service.execute_backfill(d_from, d_to)
        click.echo(
            f"Data ingestion runs completed: Actuals={res['actual_run_id']}, Forecasts={res['forecast_run_id']}"
        )

        click.echo("Generating reproducible decision snapshots...")
        engine = SnapshotEngine(db)
        curr = d_from
        built = 0
        while curr <= d_to:
            engine.build_snapshot_for_date(curr, force_rebuild=True)
            built += 1
            curr += timedelta(days=1)

        click.echo(f"Historical backfill complete: {built} daily snapshots constructed.")


@cli.command("rebuild-snapshots")
@click.option("--decision-from", default="2026-01-01", type=click.DateTime(formats=["%Y-%m-%d"]))
@click.option("--decision-to", default="2026-01-31", type=click.DateTime(formats=["%Y-%m-%d"]))
@click.option("--policy", default="latest_complete_publication", help="Snapshot selection policy")
def rebuild_snapshots(decision_from: datetime, decision_to: datetime, policy: str):
    """Rebuild historical decision snapshots from existing stored observations."""
    d_from = decision_from.date()
    d_to = decision_to.date()
    click.echo(f"Rebuilding snapshots from {d_from} to {d_to} using policy '{policy}'...")

    with SessionLocal() as db:
        engine = SnapshotEngine(db)
        curr = d_from
        count = 0
        while curr <= d_to:
            engine.build_snapshot_for_date(curr, selection_policy=policy, force_rebuild=True)
            count += 1
            curr += timedelta(days=1)
        click.echo(f"Rebuilt {count} decision snapshots successfully.")


@cli.command("data-quality-report")
@click.option("--decision-from", default="2026-01-01", type=click.DateTime(formats=["%Y-%m-%d"]))
@click.option("--decision-to", default="2026-01-31", type=click.DateTime(formats=["%Y-%m-%d"]))
def data_quality_report(decision_from: datetime, decision_to: datetime):
    """Generate summary data quality and completeness report for decision period."""
    d_from = decision_from.date()
    d_to = decision_to.date()

    with SessionLocal() as db:
        q_repo = QualityRepository(db)
        engine = SnapshotEngine(db)

        issues = q_repo.get_recent_issues(limit=50)
        click.echo("=" * 60)
        click.echo(f" Data Quality Report: {d_from} to {d_to}")
        click.echo("=" * 60)
        click.echo(f"Total Identified Quality Findings: {len(issues)}")
        for iss in issues[:10]:
            click.echo(f" - [{iss.severity}] {iss.dataset}: {iss.issue_type} - {iss.description}")

        # Completeness of daily snapshots
        curr = d_from
        complete_cnt = 0
        partial_cnt = 0
        incomplete_cnt = 0
        total_matched = 0
        total_expected = 0

        while curr <= d_to:
            snap = engine.build_snapshot_for_date(curr)
            if snap.completeness_status == "COMPLETE":
                complete_cnt += 1
            elif snap.completeness_status == "MIXED_OR_PARTIAL":
                partial_cnt += 1
            else:
                incomplete_cnt += 1

            total_matched += snap.matched_intervals
            total_expected += snap.expected_intervals
            curr += timedelta(days=1)

        click.echo("-" * 60)
        click.echo(f"Snapshot Completeness Summary ({d_from} to {d_to}):")
        click.echo(f"  Complete Days:       {complete_cnt}")
        click.echo(f"  Mixed/Partial Days:  {partial_cnt}")
        click.echo(f"  Incomplete Days:     {incomplete_cnt}")
        cov = (total_matched / total_expected * 100) if total_expected > 0 else 0.0
        click.echo(
            f"  Overall Interval Coverage: {cov:.2f}% ({total_matched}/{total_expected} intervals)"
        )
        click.echo("=" * 60)


if __name__ == "__main__":
    cli()
