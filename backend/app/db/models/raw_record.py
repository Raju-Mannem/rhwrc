"""Raw Source Record Database Model."""

from datetime import datetime
from typing import Any

from sqlalchemy import JSON, ForeignKey, Index, String
from sqlalchemy.orm import Mapped, mapped_column

from app.db.base import Base, TimestampMixin, UTCDateTime, generate_uuid


class RawSourceRecord(Base, TimestampMixin):
    """Immutable audit store for raw incoming Elexon payloads."""

    __tablename__ = "raw_source_records"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=generate_uuid)
    dataset: Mapped[str] = mapped_column(String(32), nullable=False, index=True)
    source_identity: Mapped[str] = mapped_column(String(128), nullable=False, index=True)
    payload_hash: Mapped[str] = mapped_column(String(64), nullable=False, index=True)
    payload: Mapped[dict[str, Any]] = mapped_column(JSON, nullable=False)
    retrieval_timestamp: Mapped[datetime] = mapped_column(UTCDateTime, nullable=False)
    publish_time: Mapped[datetime | None] = mapped_column(UTCDateTime, nullable=True)

    ingestion_run_id: Mapped[str | None] = mapped_column(
        String(36), ForeignKey("ingestion_runs.id", ondelete="SET NULL"), nullable=True, index=True
    )

    __table_args__ = (
        Index("ix_raw_source_records_dataset_identity", "dataset", "source_identity"),
    )
