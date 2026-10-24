"""Upstash Redis Analytical Caching Service.

Provides high-speed caching for expensive monthly overviews and accuracy summaries
with automatic fallback to an in-memory TTL cache when Redis is unconfigured or offline.
"""

import json
import time
from typing import Any

from app.core.config import get_settings
from app.core.logging import get_logger

logger = get_logger(__name__)


class CacheService:
    """Caching service supporting Upstash Redis and graceful in-memory fallback."""

    def __init__(self) -> None:
        settings = get_settings()
        self.redis_url = settings.UPSTASH_REDIS_URL
        self.default_ttl = settings.CACHE_TTL_SECONDS
        self._redis_client = None
        self._memory_cache: dict[str, tuple[str, float]] = {}

        if self.redis_url:
            try:
                import redis

                self._redis_client = redis.Redis.from_url(
                    self.redis_url,
                    decode_responses=True,
                    socket_timeout=3.0,
                    socket_connect_timeout=3.0,
                )
                self._redis_client.ping()
                logger.info("Connected successfully to Upstash Redis")
            except Exception as exc:
                logger.warning(
                    f"Failed to connect to Upstash Redis ({exc}). Falling back to in-memory TTL cache."
                )
                self._redis_client = None

    def get_json(self, key: str) -> Any | None:
        """Retrieve and parse JSON value for key."""
        if self._redis_client:
            try:
                val = self._redis_client.get(key)
                if val:
                    return json.loads(val)
                return None
            except Exception as exc:
                logger.warning(f"Upstash Redis read error for {key}: {exc}")

        # In-memory fallback
        item = self._memory_cache.get(key)
        if item:
            val_str, expiry = item
            if time.time() < expiry:
                return json.loads(val_str)
            del self._memory_cache[key]
        return None

    def set_json(self, key: str, value: Any, ttl_seconds: int | None = None) -> None:
        """Store JSON serializable value with TTL."""
        ttl = ttl_seconds if ttl_seconds is not None else self.default_ttl
        serialized = json.dumps(value, default=str)

        if self._redis_client:
            try:
                self._redis_client.setex(key, ttl, serialized)
                return
            except Exception as exc:
                logger.warning(f"Upstash Redis write error for {key}: {exc}")

        # In-memory fallback
        expiry = time.time() + ttl
        self._memory_cache[key] = (serialized, expiry)

    def delete(self, key: str) -> None:
        """Remove key from cache."""
        if self._redis_client:
            try:
                self._redis_client.delete(key)
            except Exception as exc:
                logger.warning(f"Upstash Redis delete error for {key}: {exc}")
        self._memory_cache.pop(key, None)

    def is_redis_available(self) -> bool:
        """Check if active Upstash Redis connection is alive."""
        if not self._redis_client:
            return False
        try:
            return bool(self._redis_client.ping())
        except Exception:
            return False


_global_cache: CacheService | None = None


def get_cache_service() -> CacheService:
    """Get singleton CacheService instance."""
    global _global_cache
    if _global_cache is None:
        _global_cache = CacheService()
    return _global_cache
