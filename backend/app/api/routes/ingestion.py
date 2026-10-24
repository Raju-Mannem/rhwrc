"""Ingestion Run History and Operational Trigger Routes."""

import math

from fastapi import APIRouter, BackgroundTasks, Depends, Query
from sqlalchemy.orm import Session

from app.api.dependencies import get_db_session, verify_admin_key
from app.repositories.ingestion_repo import IngestionRepository
from app.schemas.common import PaginationMeta
from app.schemas.ingestion import (
    IngestionRunItem,
    IngestionRunListResponse,
    TriggerJobRequest,
    TriggerJobResponse,
)
from app.services.ingestion.ingestion_service import IngestionService

router = APIRouter(prefix="/api/v1/ingestion", tags=["Ingestion Pipeline"])


@router.get("/runs", response_model=IngestionRunListResponse)
def list_ingestion_runs(
    dataset: str | None = Query(default=None, description="Filter by dataset: FUELHH or WINDFOR"),
    status: str | None = Query(
        default=None, description="Filter by status: SUCCESS, PARTIAL, FAILED"
    ),
    page: int = Query(default=1, ge=1),
    page_size: int = Query(default=20, ge=1, le=100),
    db: Session = Depends(get_db_session),
):
    """Retrieve paginated ingestion-run audit histories."""
    repo = IngestionRepository(db)
    offset = (page - 1) * page_size
    runs, total = repo.list_runs(dataset=dataset, status=status, limit=page_size, offset=offset)

    items = [
        IngestionRunItem(
            id=r.id,
            dataset=r.dataset,
            status=r.status,
            requested_from=r.requested_from,
            requested_to=r.requested_to,
            started_at=r.started_at,
            completed_at=r.completed_at,
            fetched_count=r.fetched_count,
            inserted_count=r.inserted_count,
            updated_count=r.updated_count,
            duplicate_count=r.duplicate_count,
            rejected_count=r.rejected_count,
            error_summary=r.error_summary,
            metadata_json=r.metadata_json,
        )
        for r in runs
    ]

    pages = math.ceil(total / page_size) if total > 0 else 1
    return IngestionRunListResponse(
        items=items,
        pagination=PaginationMeta(
            total=total,
            page=page,
            page_size=page_size,
            pages=pages,
        ),
    )


@router.post(
    "/trigger-job",
    response_model=TriggerJobResponse,
    dependencies=[Depends(verify_admin_key)],
)
def trigger_ingestion_job(
    request: TriggerJobRequest,
    background_tasks: BackgroundTasks,
    db: Session = Depends(get_db_session),
):
    """Trigger an ingestion or backfill job asynchronously via background tasks or QStash."""
    service = IngestionService(db)

    def _run():
        if request.job_type == "BACKFILL":
            service.execute_backfill(request.date_from, request.date_to)
        elif request.job_type == "INGEST_ACTUALS":
            service.ingest_actuals_range(request.date_from, request.date_to)

    background_tasks.add_task(_run)

    return TriggerJobResponse(
        job_id=f"job-{request.job_type.lower()}-{request.date_from}-{request.date_to}",
        status="ACCEPTED",
        message=f"Job {request.job_type} from {request.date_from} to {request.date_to} queued successfully.",
    )
