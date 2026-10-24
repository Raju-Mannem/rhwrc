"""Decision Snapshot Repository for reproducible historical snapshots."""

from datetime import date

from sqlalchemy import select
from sqlalchemy.orm import Session, selectinload

from app.db.models.decision_snapshot import DecisionSnapshot, DecisionSnapshotInterval


class SnapshotRepository:
    """Repository managing decision snapshots and interval-level comparison persistence."""

    def __init__(self, db: Session) -> None:
        self.db = db

    def save_snapshot(
        self,
        snapshot: DecisionSnapshot,
        intervals: list[DecisionSnapshotInterval],
    ) -> DecisionSnapshot:
        """Persist or replace a decision snapshot and its associated intervals."""
        # Check if an existing snapshot for this decision date and policy exists
        existing = self.db.scalars(
            select(DecisionSnapshot).where(
                DecisionSnapshot.decision_date == snapshot.decision_date,
                DecisionSnapshot.selection_policy == snapshot.selection_policy,
                DecisionSnapshot.calculation_version == snapshot.calculation_version,
            )
        ).first()

        if existing:
            # Delete old snapshot and replace
            self.db.delete(existing)
            self.db.flush()

        snapshot.intervals = intervals
        self.db.add(snapshot)
        self.db.commit()
        self.db.refresh(snapshot)
        return snapshot

    def get_snapshot_by_decision_date(
        self,
        decision_date: date,
        selection_policy: str = "latest_complete_publication",
        calculation_version: str = "1.0",
    ) -> DecisionSnapshot | None:
        """Retrieve snapshot and its intervals for a specific decision date."""
        stmt = (
            select(DecisionSnapshot)
            .options(selectinload(DecisionSnapshot.intervals))
            .where(
                DecisionSnapshot.decision_date == decision_date,
                DecisionSnapshot.selection_policy == selection_policy,
                DecisionSnapshot.calculation_version == calculation_version,
            )
        )
        return self.db.scalars(stmt).first()

    def get_snapshots_in_range(
        self,
        date_from: date,
        date_to: date,
        selection_policy: str = "latest_complete_publication",
    ) -> list[DecisionSnapshot]:
        """Retrieve all snapshots within a decision date range."""
        stmt = (
            select(DecisionSnapshot)
            .options(selectinload(DecisionSnapshot.intervals))
            .where(
                DecisionSnapshot.decision_date >= date_from,
                DecisionSnapshot.decision_date <= date_to,
                DecisionSnapshot.selection_policy == selection_policy,
            )
            .order_by(DecisionSnapshot.decision_date.asc())
        )
        return list(self.db.scalars(stmt).all())
