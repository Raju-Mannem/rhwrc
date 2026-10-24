# Stage 1: Build & Dependency Resolution
FROM python:3.12-slim-bookworm AS builder

WORKDIR /build

ENV DEBIAN_FRONTEND=noninteractive \
    PYTHONUNBUFFERED=1 \
    PYTHONDONTWRITEBYTECODE=1 \
    PIP_NO_CACHE_DIR=1

RUN apt-get update && apt-get install -y --no-install-recommends \
    build-essential \
    curl \
    && rm -rf /var/lib/apt/lists/*

# Install uv for fast, deterministic dependency resolution
COPY --from=ghcr.io/astral-sh/uv:0.5.21 /uv /bin/uv

COPY pyproject.toml README.md ./

# Create virtualenv and install production dependencies
RUN uv venv /opt/venv && \
    uv pip install --no-cache --python /opt/venv ".[dev]"

COPY . .
RUN uv pip install --no-cache --python /opt/venv .

# Stage 2: Minimal Production Runtime
FROM python:3.12-slim-bookworm AS runner

WORKDIR /app

ENV PATH="/opt/venv/bin:$PATH" \
    PYTHONUNBUFFERED=1 \
    PYTHONDONTWRITEBYTECODE=1 \
    PORT=8000 \
    HOST=0.0.0.0

# Install runtime libpq dependencies and curl for health check
RUN apt-get update && apt-get install -y --no-install-recommends \
    curl \
    ca-certificates \
    && rm -rf /var/lib/apt/lists/*

# Create dedicated non-root user and group
RUN groupadd -g 10001 gridbricks && \
    useradd -u 10001 -g gridbricks -s /bin/bash -m gridbricks

# Copy virtual environment and application code from builder
COPY --from=builder --chown=gridbricks:gridbricks /opt/venv /opt/venv
COPY --chown=gridbricks:gridbricks . /app

USER gridbricks

EXPOSE 8000

# Docker healthcheck querying the /health/live probe
HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
    CMD curl -f http://localhost:8000/health/live || exit 1

# Production execution using Granian ASGI server
CMD ["granian", "--interface", "asgi", "app.main:app", "--host", "0.0.0.0", "--port", "8000", "--workers", "2", "--access-log"]
