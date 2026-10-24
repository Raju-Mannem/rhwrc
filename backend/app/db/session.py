"""Database Engine and Session Management.

Configures connection pooling optimized for Neon Tech PostgreSQL serverless architecture
with graceful fallback to SQLite for local standalone development and testing.
"""

from collections.abc import Generator

from sqlalchemy import create_engine, text
from sqlalchemy.orm import Session, sessionmaker

from app.core.config import get_settings
from app.core.logging import get_logger

logger = get_logger(__name__)


def create_app_engine():
    """Create SQLAlchemy engine with connection pooling parameters."""
    settings = get_settings()
    url = settings.DATABASE_URL

    connect_args = {}
    engine_kwargs = {
        "future": True,
        "echo": settings.SQL_ECHO,
    }

    if url.startswith("sqlite"):
        connect_args["check_same_thread"] = False
        engine_kwargs["connect_args"] = connect_args
    else:
        # PostgreSQL / Neon Tech configuration
        engine_kwargs.update(
            {
                "pool_size": settings.DB_POOL_SIZE,
                "max_overflow": settings.DB_MAX_OVERFLOW,
                "pool_pre_ping": settings.DB_POOL_PRE_PING,
                "pool_recycle": settings.DB_POOL_RECYCLE_SECONDS,
            }
        )

    return create_engine(url, **engine_kwargs)


engine = create_app_engine()
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine, future=True)


def get_db() -> Generator[Session, None, None]:
    """FastAPI dependency that yields a database session and safely closes it."""
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


def check_database_health() -> bool:
    """Execute a simple SELECT 1 query to verify database connectivity."""
    try:
        with engine.connect() as conn:
            conn.execute(text("SELECT 1"))
        return True
    except Exception as exc:
        logger.error(f"Database health check failed: {exc}")
        return False
