"""Decision Snapshot and Snapshot Intervals Database Models."""

from datetime import date, datetime
from typing import TYPE_CHECKING

from sqlalchemy import Date, Float, ForeignKey, Index, Integer, String, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base, TimestampMixin, UTCDateTime, generate_uuid

if TYPE_CHECKING:
    pass


class DecisionSnapshot(Base, TimestampMixin):
    """Immutable record of the forecast snapshot selected at a historical day-ahead decision cutoff."""

    __tablename__ = "decision_snapshots"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=generate_uuid)
    decision_date: Mapped[date] = mapped_column(Date, nullable=False, index=True)
    decision_cutoff_utc: Mapped[datetime] = mapped_column(UTCDateTime, nullable=False, index=True)
    decision_cutoff_local_time: Mapped[str] = mapped_column(String(32), nullable=False)
    delivery_date: Mapped[date] = mapped_column(Date, nullable=False, index=True)

    selection_policy: Mapped[str] = mapped_column(
        String(48), nullable=False
    )  # latest_complete_publication, latest_per_interval
    selected_publication_time_utc: Mapped[datetime | None] = mapped_column(
        UTCDateTime, nullable=True
    )
    completeness_status: Mapped[str] = mapped_column(
        String(32), nullable=False
    )  # COMPLETE, MIXED_OR_PARTIAL, INCOMPLETE

    expected_intervals: Mapped[int] = mapped_column(Integer, nullable=False)
    matched_intervals: Mapped[int] = mapped_column(Integer, nullable=False)
    missing_intervals: Mapped[int] = mapped_column(Integer, nullable=False)
    coverage_ratio: Mapped[float] = mapped_column(Float, nullable=False)

    calculation_version: Mapped[str] = mapped_column(String(16), default="1.0", nullable=False)

    intervals: Mapped[list["DecisionSnapshotInterval"]] = relationship(
        "DecisionSnapshotInterval",
        back_populates="snapshot",
        cascade="all, delete-orphan",
        order_by="DecisionSnapshotInterval.start_time_utc",
    )

    __table_args__ = (
        UniqueConstraint(
            "decision_date", "selection_policy", "calculation_version", name="uq_snapshot_version"
        ),
        Index("ix_snapshots_decision_delivery", "decision_date", "delivery_date"),
    )


class DecisionSnapshotInterval(Base, TimestampMixin):
    """Interval-level comparison between selected eligible forecast and actual outturn."""

    __tablename__ = "decision_snapshot_intervals"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=generate_uuid)
    snapshot_id: Mapped[str] = mapped_column(
        String(36),
        ForeignKey("decision_snapshots.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    start_time_utc: Mapped[datetime] = mapped_column(UTCDateTime, nullable=False, index=True)

    forecast_mw: Mapped[float | None] = mapped_column(Float, nullable=True)
    actual_mw: Mapped[float | None] = mapped_column(Float, nullable=True)
    signed_error_mw: Mapped[float | None] = mapped_column(Float, nullable=True)  # F - A
    absolute_error_mw: Mapped[float | None] = mapped_column(Float, nullable=True)  # |F - A|
    error_mwh: Mapped[float | None] = mapped_column(Float, nullable=True)  # (F - A) * 0.5h

    forecast_publish_time_utc: Mapped[datetime | None] = mapped_column(UTCDateTime, nullable=True)
    match_status: Mapped[str] = mapped_column(
        String(32), nullable=False
    )  # MATCHED, MISSING_FORECAST, MISSING_ACTUAL, EXCLUDED

    snapshot: Mapped["DecisionSnapshot"] = relationship(
        "DecisionSnapshot", back_populates="intervals"
    )

    __table_args__ = (
        UniqueConstraint("snapshot_id", "start_time_utc", name="uq_snapshot_interval_time"),
        Index("ix_snapshot_interval_status", "snapshot_id", "match_status"),
    )
