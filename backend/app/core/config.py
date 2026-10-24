"""Gridbricks Configuration Module.

Centralizes all typed settings, environment variables, and business rule configurations
using Pydantic Settings v2.
"""

from datetime import time
from functools import lru_cache
from typing import Literal
from zoneinfo import ZoneInfo

from pydantic import Field, field_validator
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    """Application and business rule settings."""

    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        extra="ignore",
        case_sensitive=False,
    )

    # Runtime and Process
    APP_NAME: str = "Gridbricks-backend"
    ENVIRONMENT: Literal["development", "testing", "staging", "production"] = "development"
    LOG_LEVEL: str = "INFO"
    DEBUG: bool = False
    HOST: str = "0.0.0.0"
    PORT: int = 8000
    WORKERS: int = 1
    SQL_ECHO: bool = False

    # Database (Neon Tech PostgreSQL or SQLite fallback)
    DATABASE_URL: str = Field(
        default="sqlite:///./gridbricks.db",
        description="SQLAlchemy database connection URL. Supports Neon PostgreSQL with SSL.",
    )
    DB_POOL_SIZE: int = 5
    DB_MAX_OVERFLOW: int = 10
    DB_POOL_PRE_PING: bool = True
    DB_POOL_RECYCLE_SECONDS: int = 300

    # Elexon BMRS API
    ELEXON_BASE_URL: str = Field(
        default="https://data.elexon.co.uk/bmrs/api/v1",
        description="Elexon BMRS API v1 base endpoint",
    )
    ELEXON_TIMEOUT_SECONDS: float = Field(
        default=30.0, description="HTTP client timeout in seconds"
    )
    ELEXON_MAX_RETRIES: int = Field(default=3, description="Bounded retry attempts for Elexon")
    ELEXON_BACKOFF_FACTOR: float = Field(default=1.5, description="Exponential backoff multiplier")
    ELEXON_USER_AGENT: str = "Gridbricks-Procurement-Analytics/1.0"

    # Business Rules & Analysis Period
    DECISION_DATE_MODE: Literal["DECISION_DATE", "DELIVERY_DATE"] = Field(
        default="DECISION_DATE",
        description="Whether January 1-31 defines decision dates or delivery dates",
    )
    DECISION_TIMEZONE: str = Field(
        default="Europe/London",
        description="Timezone for market calendar and decision cutoff calculation",
    )
    DECISION_CUTOFF_LOCAL_TIME: str = Field(
        default="10:00",
        description="Local deadline placeholder (HH:MM) for day-ahead purchasing decision",
    )
    DECISION_LEAD_DAYS: int = Field(
        default=1,
        description="Lead days between decision date and delivery date (1 calendar day)",
    )
    DECISION_CUTOFF_INCLUSIVE: bool = Field(
        default=True,
        description="If True, forecasts published exactly at the cutoff are eligible",
    )
    FORECAST_LOOKBACK_HOURS: int = Field(
        default=72,
        description="Publication lookback window in hours before earliest decision cutoff",
    )

    # Forecast Selection & Snapshot Policy
    FORECAST_SELECTION_POLICY: Literal["latest_complete_publication", "latest_per_interval"] = (
        Field(
            default="latest_complete_publication",
            description="Preferred forecast snapshot selection policy",
        )
    )
    SNAPSHOT_FALLBACK_POLICY: Literal["latest_per_interval", "reject"] = Field(
        default="latest_per_interval",
        description="Fallback policy when no single publication is sufficiently complete",
    )
    SNAPSHOT_COMPLETENESS_THRESHOLD: float = Field(
        default=0.95,
        ge=0.0,
        le=1.0,
        description="Minimum fraction of expected intervals required for a complete publication",
    )
    # Alignment rule: 'EXACT' (match only :00) or 'STEP_FORWARD' (step :00 forecast to :30 interval)
    FORECAST_INTERVAL_ALIGNMENT: Literal["EXACT", "STEP_FORWARD"] = Field(
        default="STEP_FORWARD",
        description="Interval alignment between hourly WINDFOR stream and half-hourly FUELHH",
    )

    # Upstash Redis (Analytical cache & rate limiting)
    UPSTASH_REDIS_URL: str | None = Field(
        default=None,
        description="Upstash Redis URL (e.g. rediss://default:token@xyz.upstash.io:6379)",
    )
    CACHE_TTL_SECONDS: int = Field(
        default=1800,
        description="Analytical summary cache TTL in seconds",
    )

    # Upstash QStash (Background tasks & Webhook scheduler)
    QSTASH_URL: str = "https://qstash.upstash.io/v2/publish"
    QSTASH_TOKEN: str | None = None
    QSTASH_CURRENT_SIGNING_KEY: str | None = None
    QSTASH_NEXT_SIGNING_KEY: str | None = None

    # Hugging Face LLM (Llama plain-English natural language summaries)
    HUGGINGFACE_API_KEY: str | None = None
    HF_LLAMA_MODEL: str = "meta-llama/Meta-Llama-3-8B-Instruct"
    ENABLE_LLM_SUMMARY: bool = True

    # Security & Access
    CORS_ORIGINS: list[str] = [
        "http://localhost:3000",
        "http://localhost:5173",
        "http://127.0.0.1:3000",
        "http://127.0.0.1:5173",
    ]
    API_KEY_ADMIN: str | None = None

    @field_validator("DECISION_CUTOFF_LOCAL_TIME")
    @classmethod
    def validate_cutoff_time(cls, v: str) -> str:
        """Validate HH:MM format."""
        parts = v.strip().split(":")
        if len(parts) != 2:
            raise ValueError(f"DECISION_CUTOFF_LOCAL_TIME must be 'HH:MM', got '{v}'")
        h, m = int(parts[0]), int(parts[1])
        if not (0 <= h <= 23 and 0 <= m <= 59):
            raise ValueError(f"Invalid hours or minutes in cutoff time: '{v}'")
        return f"{h:02d}:{m:02d}"

    @field_validator("DECISION_TIMEZONE")
    @classmethod
    def validate_timezone(cls, v: str) -> str:
        """Ensure timezone string is recognized by standard zoneinfo."""
        try:
            ZoneInfo(v.strip())
        except Exception as err:
            raise ValueError(f"Unrecognized timezone '{v}': {err}") from err
        return v.strip()

    @property
    def parsed_cutoff_time(self) -> time:
        """Returns time object for the cutoff time."""
        h, m = map(int, self.DECISION_CUTOFF_LOCAL_TIME.split(":"))
        return time(hour=h, minute=m)

    @property
    def timezone_info(self) -> ZoneInfo:
        """Returns ZoneInfo instance for DECISION_TIMEZONE."""
        return ZoneInfo(self.DECISION_TIMEZONE)


@lru_cache(maxsize=1)
def get_settings() -> Settings:
    """Return cached singleton instance of Settings."""
    return Settings()
