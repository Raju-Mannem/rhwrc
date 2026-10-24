"""Gridbricks Domain Exceptions and Error Definitions.

Provides structured, explicit domain exceptions that map cleanly to
RFC 7807 Problem Details HTTP responses.
"""

from typing import Any


class GridbricksError(Exception):
    """Base domain exception for all Gridbricks application errors."""

    def __init__(
        self,
        message: str,
        status_code: int = 500,
        error_type: str = "about:blank",
        title: str = "Internal Server Error",
        detail: str | None = None,
        extra: dict[str, Any] | None = None,
    ) -> None:
        super().__init__(message)
        self.message = message
        self.status_code = status_code
        self.error_type = error_type
        self.title = title
        self.detail = detail or message
        self.extra = extra or {}

    def to_problem_details(self) -> dict[str, Any]:
        """Convert exception to RFC 7807 problem details dictionary."""
        payload: dict[str, Any] = {
            "type": self.error_type,
            "title": self.title,
            "status": self.status_code,
            "detail": self.detail,
        }
        if self.extra:
            payload["invalid_params"] = self.extra
        return payload


class ElexonSourceError(GridbricksError):
    """Raised when an external Elexon BMRS endpoint returns an error or malformed payload."""

    def __init__(
        self,
        message: str,
        status_code: int = 502,
        dataset: str | None = None,
        upstream_status: int | None = None,
    ) -> None:
        super().__init__(
            message=message,
            status_code=status_code,
            error_type="urn:gridbricks:error:elexon-source",
            title="Elexon Source Error",
            extra={"dataset": dataset, "upstream_status": upstream_status},
        )


class TemporalRuleError(GridbricksError):
    """Raised when date arithmetic or interval calculation violates temporal constraints."""

    def __init__(self, message: str, invalid_date: str | None = None) -> None:
        super().__init__(
            message=message,
            status_code=400,
            error_type="urn:gridbricks:error:temporal-rule",
            title="Temporal Rule Violation",
            extra={"invalid_date": invalid_date} if invalid_date else None,
        )


class SnapshotNotFoundError(GridbricksError):
    """Raised when an expected decision snapshot or historical record is missing."""

    def __init__(self, message: str, decision_date: str | None = None) -> None:
        super().__init__(
            message=message,
            status_code=404,
            error_type="urn:gridbricks:error:snapshot-not-found",
            title="Decision Snapshot Not Found",
            extra={"decision_date": decision_date} if decision_date else None,
        )


class IngestionError(GridbricksError):
    """Raised when an ingestion job encounters unrecoverable data quality or persistence errors."""

    def __init__(self, message: str, run_id: str | None = None) -> None:
        super().__init__(
            message=message,
            status_code=500,
            error_type="urn:gridbricks:error:ingestion-failure",
            title="Ingestion Pipeline Error",
            extra={"run_id": run_id} if run_id else None,
        )


class MetricCalculationError(GridbricksError):
    """Raised when metrics calculations encounter invalid population or degenerate conditions."""

    def __init__(self, message: str) -> None:
        super().__init__(
            message=message,
            status_code=422,
            error_type="urn:gridbricks:error:metric-calculation",
            title="Metric Calculation Error",
        )
