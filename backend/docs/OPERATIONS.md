# Gridbricks Production Operations Guide

This runbook guides DevOps, SRE, and data engineers on configuring, running, maintaining, and recovering the Gridbricks backend in cloud production environments.

---

## 1. Managed Cloud Service Provisioning

### 1.1 Neon Tech PostgreSQL Database
Gridbricks is optimized for **Neon Tech Serverless PostgreSQL**:
1. Create a project in [Neon Console](https://console.neon.tech).
2. Create a database (e.g. `gridbricks_prod`).
3. Obtain the pooled connection string:
   ```text
   postgresql+psycopg://username:password@ep-cool-project-pooler.eu-central-1.aws.neon.tech/gridbricks_prod?sslmode=require
   ```
4. Set `DATABASE_URL` in your production environment variables / secret manager.
5. In Gridbricks, connection pooling is configured with `pool_pre_ping=True` and `pool_recycle=300` to automatically recover from serverless suspend and reconnection events.

### 1.2 Upstash Redis (Analytical Cache)
1. Create a Redis database in [Upstash Console](https://console.upstash.com).
2. Copy the TLS connection URL:
   ```text
   rediss://default:your_token@eu1-your-db.upstash.io:6379
   ```
3. Set `UPSTASH_REDIS_URL`. If unset or unreachable, Gridbricks transparently degrades to an in-memory TTL cache without crashing.

### 1.3 Upstash QStash (Serverless Scheduling & Webhook Dispatch)
1. In Upstash Console, navigate to QStash.
2. Obtain your `QSTASH_TOKEN` and signing keys.
3. Set `QSTASH_TOKEN`, `QSTASH_CURRENT_SIGNING_KEY`, and `QSTASH_NEXT_SIGNING_KEY`.
4. Configure a recurring schedule in QStash (e.g. every hour at :10) to POST to `/api/v1/ingestion/trigger-job` with payload:
   ```json
   {
     "job_type": "INGEST_ACTUALS",
     "date_from": "2026-01-02",
     "date_to": "2026-01-02"
   }
   ```

### 1.4 Hugging Face Inference API (Llama Executive Summaries)
1. Obtain an API access token from [Hugging Face Settings](https://huggingface.co/settings/tokens).
2. Set `HUGGINGFACE_API_KEY` and `HF_LLAMA_MODEL=meta-llama/Meta-Llama-3-8B-Instruct`.
3. If the token is not supplied or the Hugging Face service is offline, Gridbricks generates deterministic, expert-crafted natural language summaries locally.

---

## 2. Release & Database Migration Workflow

In production, migrations must be executed as a controlled release command prior to routing traffic to new application replicas:
```bash
# 1. Run migrations against target database
alembic upgrade head

# 2. Verify migration status
alembic current
```

---

## 3. Operational CLI Commands

Gridbricks provides an independently executable CLI module:

```bash
# Verify configuration and environment variables
python -m app.cli check-config

# Test live connectivity to Neon Tech DB and Elexon BMRS
python -m app.cli check-source-connectivity

# Ingest FUELHH actual generation for a specific settlement date range
python -m app.cli ingest-actuals --from-date 2026-01-02 --to-date 2026-02-01

# Ingest WINDFOR forecasts covering decision cutoffs
python -m app.cli ingest-forecasts --decision-from 2026-01-01 --decision-to 2026-01-31

# Run full historical backfill and build reproducible decision snapshots
python -m app.cli backfill --decision-from 2026-01-01 --decision-to 2026-01-31

# Rebuild historical snapshots from stored observations after methodology updates
python -m app.cli rebuild-snapshots --decision-from 2026-01-01 --decision-to 2026-01-31

# Display operational data quality and snapshot completeness report
python -m app.cli data-quality-report --decision-from 2026-01-01 --decision-to 2026-01-31
```

---

## 4. Production Container Deployment

### 4.1 Running with Docker Compose
```bash
# Build and run API, PostgreSQL, and Redis
docker compose up -d

# Check live logs
docker compose logs -f api
```

### 4.2 Running Standalone Container with Neon Tech
```bash
docker run -d \
  --name gridbricks-api \
  -p 8000:8000 \
  -e DATABASE_URL="postgresql+psycopg://username:password@ep-pooler.eu-central-1.aws.neon.tech/gridbricks_prod?sslmode=require" \
  -e UPSTASH_REDIS_URL="rediss://default:token@xyz.upstash.io:6379" \
  -e ENVIRONMENT="production" \
  gridbricks-backend:latest
```

---

## 5. Health Monitoring & Observability

- **Liveness Probe**: `GET /health/live` (Checks that HTTP process and event loop are responsive).
- **Readiness Probe**: `GET /health/ready` (Verifies database connectivity, Upstash Redis, QStash, and Elexon endpoint state).
- **Data Health Endpoint**: `GET /api/v1/data-health` (Reports freshness, last successful ingestion timestamp, data quality flags, and failed/partial runs).

---

## 6. Backup, Recovery & Rollback

### 6.1 Database Backups
- In Neon Tech, enable point-in-time recovery (PITR) and automated daily branch snapshots.
- For standard PostgreSQL:
  ```bash
  pg_dump -Fc -v --no-owner --no-acl $DATABASE_URL > gridbricks_backup_$(date +%Y%m%d).dump
  ```

### 6.2 Application Rollback
- Revert container image tag to previous stable release.
- If a schema downgrade is required:
  ```bash
  alembic downgrade -1
  ```
