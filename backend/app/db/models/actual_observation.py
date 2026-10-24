"""Actual Generation Observation Database Model."""

from datetime import date, datetime

from sqlalchemy import Date, Float, ForeignKey, Index, Integer, String, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column

from app.db.base import Base, TimestampMixin, UTCDateTime, generate_uuid


class ActualObservation(Base, TimestampMixin):
    """Normalized actual outturn wind generation record from Elexon FUELHH."""

    __tablename__ = "actual_generation_observations"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=generate_uuid)
    start_time_utc: Mapped[datetime] = mapped_column(UTCDateTime, nullable=False, index=True)
    settlement_date: Mapped[date] = mapped_column(Date, nullable=False, index=True)
    settlement_period: Mapped[int] = mapped_column(Integer, nullable=False)
    fuel_type: Mapped[str] = mapped_column(String(16), default="WIND", nullable=False)
    generation_mw: Mapped[float] = mapped_column(Float, nullable=False)

    source_identity: Mapped[str] = mapped_column(String(128), nullable=False)
    source_publish_time: Mapped[datetime | None] = mapped_column(UTCDateTime, nullable=True)
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
        UniqueConstraint("start_time_utc", "fuel_type", name="uq_actual_start_time_fuel"),
        Index("ix_actual_settlement_date_period", "settlement_date", "settlement_period"),
    )
