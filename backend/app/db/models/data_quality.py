"""Data Quality Issue Database Model."""

from datetime import datetime

from sqlalchemy import ForeignKey, Index, String, Text
from sqlalchemy.orm import Mapped, mapped_column

from app.db.base import Base, TimestampMixin, UTCDateTime, generate_uuid


class DataQualityIssue(Base, TimestampMixin):
    """Stores data validation flags, missing delivery intervals, and anomalous generation values."""

    __tablename__ = "data_quality_issues"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=generate_uuid)
    dataset: Mapped[str] = mapped_column(String(32), nullable=False, index=True)
    issue_type: Mapped[str] = mapped_column(
        String(48), nullable=False, index=True
    )  # MISSING_INTERVAL, NEGATIVE_VALUE, INCOMPLETE_PUBLICATION, DUPLICATE_ENTRY, etc.
    severity: Mapped[str] = mapped_column(
        String(16), nullable=False, default="WARNING"
    )  # INFO, WARNING, ERROR, CRITICAL
    description: Mapped[str] = mapped_column(Text, nullable=False)
    record_identifier: Mapped[str | None] = mapped_column(String(128), nullable=True)
    detected_at: Mapped[datetime] = mapped_column(UTCDateTime, nullable=False)

    ingestion_run_id: Mapped[str | None] = mapped_column(
        String(36), ForeignKey("ingestion_runs.id", ondelete="SET NULL"), nullable=True, index=True
    )

    __table_args__ = (
        Index("ix_quality_dataset_type_severity", "dataset", "issue_type", "severity"),
    )
