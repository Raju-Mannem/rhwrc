
# Developer commands

.PHONY: help install dev migrate test lint format check-connectivity backfill quality-report docker-build docker-up

help:
	@echo "Available commands:"
	@echo "  make install            - Install dependencies in virtualenv using uv"
	@echo "  make dev                - Run the API server locally with hot reload"
	@echo "  make migrate            - Apply Alembic database migrations"
	@echo "  make test               - Run the complete automated test suite with coverage"
	@echo "  make lint               - Run Ruff formatting and linting checks"
	@echo "  make format             - Reformat codebase using Ruff"
	@echo "  make check-connectivity - Test database and live Elexon API connectivity"
	@echo "  make backfill           - Execute historical January 2026 backfill"
	@echo "  make quality-report     - Display data quality and completeness report"
	@echo "  make docker-build       - Build the production Docker image"
	@echo "  make docker-up          - Start full containerized stack via Docker Compose"

install:
	uv pip install -e ".[dev]"

dev:
	uv run granian --interface asgi app.main:app --host 0.0.0.0 --port 8000 --reload

migrate:
	uv run alembic upgrade head

test:
	uv run pytest tests/ --cov=app --cov-report=term-missing --cov-report=html

lint:
	uv run ruff check .
	uv run ruff format --check .

format:
	uv run ruff format .
	uv run ruff check --fix .

check-connectivity:
	uv run python -m app.cli check-source-connectivity

backfill:
	uv run python -m app.cli backfill --decision-from 2026-01-01 --decision-to 2026-01-31

quality-report:
	uv run python -m app.cli data-quality-report --decision-from 2026-01-01 --decision-to 2026-01-31

docker-build:
	docker build -t gridbricks-backend:latest .

docker-up:
	docker compose up -d
