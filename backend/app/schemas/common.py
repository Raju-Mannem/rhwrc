"""Common Pydantic Schemas and Error Models."""

from typing import Any

from pydantic import BaseModel, ConfigDict, Field


class RFC7807Problem(BaseModel):
    """Standard RFC 7807 Problem Details representation."""

    model_config = ConfigDict(extra="allow")

    type: str = Field(default="about:blank", description="URI identifying the problem type")
    title: str = Field(description="Short human-readable summary of problem")
    status: int = Field(description="HTTP status code")
    detail: str = Field(description="Human-readable explanation specific to this occurrence")
    instance: str | None = Field(
        default=None, description="URI reference identifying specific occurrence"
    )
    invalid_params: dict[str, Any] | None = Field(
        default=None, description="Detailed validation or parameter error details"
    )


class PaginationMeta(BaseModel):
    """Pagination metadata."""

    total: int
    page: int
    page_size: int
    pages: int
