"""Forecast Generation Observation Database Model."""

from datetime import datetime

from sqlalchemy import Float, ForeignKey, Index, String, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column

from app.db.base import Base, TimestampMixin, UTCDateTime, generate_uuid


class ForecastObservation(Base, TimestampMixin):
    """Normalized wind generation forecast record from Elexon WINDFOR.

    Retains all historical publication vintages for each delivery interval.
    """

    __tablename__ = "forecast_observations"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=generate_uuid)
    start_time_utc: Mapped[datetime] = mapped_column(UTCDateTime, nullable=False, index=True)
    publish_time_utc: Mapped[datetime] = mapped_column(UTCDateTime, nullable=False, index=True)
    generation_mw: Mapped[float] = mapped_column(Float, nullable=False)
    dataset: Mapped[str] = mapped_column(String(32), default="WINDFOR", nullable=False)

    source_identity: Mapped[str] = mapped_column(String(128), nullable=False)
    raw_record_id: Mapped[str | None] = mapped_column(
        String(36), ForeignKey("raw_source_records.id", ondelete="SET NULL"), nullable=True
    )
    ingestion_run_id: Mapped[str | None] = mapped_column(
        String(36), ForeignKey("ingestion_runs.id", ondelete="SET NULL"), nullable=True
    )
    quality_status: Mapped[str] = mapped_column(
        String(24), default="VALID", nullable=False
    )  # VALID, FLAGGED, SUSPICIOUS

    __table_args__ = (
        UniqueConstraint("start_time_utc", "publish_time_utc", name="uq_forecast_start_publish"),
        Index("ix_forecast_publish_start", "publish_time_utc", "start_time_utc"),
    )
