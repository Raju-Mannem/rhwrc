"""CSV Export Route."""

from datetime import date

from fastapi import APIRouter, Depends, Query, Response
from sqlalchemy.orm import Session

from app.api.dependencies import get_db_session
from app.services.exports.csv_exporter import export_snapshot_intervals_to_csv
from app.services.snapshots.snapshot_engine import SnapshotEngine

router = APIRouter(prefix="/api/v1/exports", tags=["Exports"])


@router.get("/intervals.csv")
def export_intervals_csv(
    decision_date: date = Query(
        default=date(2026, 1, 15),
        description="Decision date to export interval observations for",
    ),
    selection_policy: str | None = Query(default=None),
    db: Session = Depends(get_db_session),
):
    """Export interval-level forecast vs actual observations and publication provenance as CSV.

    Includes formula injection sanitization and deterministic formatting.
    """
    engine = SnapshotEngine(db)
    snapshot = engine.build_snapshot_for_date(
        decision_date=decision_date,
        selection_policy=selection_policy,
    )

    csv_data = export_snapshot_intervals_to_csv(snapshot)
    filename = f"gridbricks_intervals_{decision_date.isoformat()}.csv"

    headers = {
        "Content-Disposition": f'attachment; filename="{filename}"',
        "Content-Type": "text/csv; charset=utf-8",
    }
    return Response(content=csv_data, media_type="text/csv", headers=headers)
