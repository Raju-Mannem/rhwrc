Gridbricks - UK Wind Generation Forecast Analytics Platform
Wind intelligence, without the guesswork.

![alt text](image-3.png)

![alt text](image.png)

![alt text](image-1.png)

![alt text](image-2.png)

Gridbricks is a energy intelligence platform built for UK electricity procurement teams. It reconstructs which national wind generation forecast was available at the historical day-ahead procurement decision deadline, compares that forecast with eventual actual generation, quantifies forecast accuracy and directional bias, and provides traceable evidence of data quality and forecast provenance.

The platform combines a FastAPI analytical backend with a React and TypeScript frontend, providing procurement analysts with an auditable workspace for historical decision review, forecast evolution, settlement-level accuracy, and pipeline observability.

Table of Contents
Platform Overview
Key Capabilities
Technology Stack
Repository Structure
Prerequisites
Getting Started
Configuration and Environment Variables
Backend Architecture
Frontend Architecture
Data Integrity and Temporal Controls
Testing and Code Quality
Production Deployment
Operational Commands
API Documentation
Engineering Documentation
Production Readiness Considerations
License
Platform Overview

In the UK wholesale electricity market, procurement teams make day-ahead purchasing decisions using forecasts of national electricity demand and generation. Wind generation is inherently variable, and the forecast available when a decision is finalized can differ materially from the eventual metered output.

Gridbricks provides a retrospective decision-support system that:

Retrieves historical wind forecast publications and actual generation observations from Elexon BMRS.
Applies the configured procurement decision deadline to determine forecast eligibility.
Reconstructs reproducible decision-time forecast snapshots without allowing later publications to leak into historical decisions.
Compares selected forecasts against actual half-hourly wind generation.
Calculates forecast accuracy, signed bias, settlement-level residuals, and energy-weighted error metrics.
Exposes forecast revisions, data quality findings, ingestion history, and analytical provenance through an interactive web interface.

Scope: Gridbricks is a retrospective analytics and audit platform. Its historical reconstruction supports procurement analysis; it should not be interpreted as an automated trading system or a guarantee of future forecast performance.

Key Capabilities
Procurement Intelligence Overview

Route: /overview

Executive accuracy metrics: MAE, RMSE, signed bias, WAPE, and P90 absolute error.
Multi-day actual-versus-forecast time series.
Signed residual analysis.
A 48-settlement-period heatmap showing forecast error.
Consistent metric definitions and unit handling.
Decision-Day Settlement Audit

Route: /decision/:date

Inspection of all 48 half-hourly settlement periods for a selected UK date.
Actual generation, selected forecast, and residual comparisons.
Settlement-level detail and interval inspection.
Server-generated CSV exports for further analysis.
Forecast Evolution Explorer

Route: /forecast-evolution

Historical forecast publication and revision tracking.
Comparison of forecast vintages.
A visible decision-cutoff marker distinguishing eligible forecasts from later publications.
Forecast Provenance Explorer

Route: /decision/:date/provenance

Interactive graph of the decision reconstruction process.
Traceability from decision configuration through eligible forecasts, selected snapshots, actual observations, and accuracy results.
Support for investigating why a particular forecast was selected.
Data Quality and Observability

Route: /data-quality

Upstream source freshness for FUELHH and WINDFOR.
Ingestion run history and pipeline status.
Data completeness and validation findings.
Visibility into missing or inconsistent observations.
Methodology Reference

Route: /methodology

Definitions and formulas for accuracy metrics.
MW versus MWh interpretation.
Settlement-period conventions.
Decision deadlines and forecast eligibility rules.
Technology Stack
Layer	Technologies
Backend runtime	Python 3.12+, FastAPI, Granian
Backend validation	Pydantic v2
Database and migrations	SQLAlchemy 2.0, Alembic
Primary database	Neon PostgreSQL with SSL and connection pooling
Local development database	SQLite
Analytical caching	Upstash Redis with in-memory fallback
Asynchronous dispatch	Upstash QStash
External data	Elexon BMRS FUELHH and WINDFOR
Narrative summaries	Hugging Face-hosted Llama integration
HTTP reliability	HTTPX, Tenacity
Frontend	React 19, TypeScript strict mode, Vite 8
Routing	React Router v7 with lazy-loaded routes
Server-state management	TanStack Query v5
Client-state management	Zustand
Visualization	D3.js v7, @xyflow/react v12
Styling	Tailwind CSS v4, Lucide React
Backend testing	pytest, Ruff
Frontend testing	Vitest, React Testing Library, jsdom
Production web serving	Nginx on Alpine Linux
Containerization	Docker
Repository Structure
text
gridbricks/
├── README.md
├── backend/
│   ├── app/
│   │   ├── main.py
│   │   ├── api/
│   │   │   ├── dependencies.py
│   │   │   └── routes/
│   │   ├── core/
│   │   ├── db/
│   │   │   ├── base.py
│   │   │   ├── session.py
│   │   │   └── models/
│   │   ├── schemas/
│   │   ├── services/
│   │   │   ├── elexon/
│   │   │   ├── normalization/
│   │   │   ├── snapshots/
│   │   │   ├── metrics/
│   │   │   ├── integrations/
│   │   │   └── exports/
│   │   ├── repositories/
│   │   └── cli.py
│   ├── migrations/
│   ├── tests/
│   │   ├── fixtures/
│   │   ├── unit/
│   │   ├── contract/
│   │   └── integration/
│   ├── docs/
│   ├── Dockerfile
│   ├── compose.yaml
│   ├── pyproject.toml
│   └── Makefile
├── frontend/
│   ├── public/
│   ├── src/
│   │   ├── app/
│   │   ├── charts/
│   │   ├── components/
│   │   ├── features/
│   │   ├── lib/
│   │   ├── services/
│   │   ├── stores/
│   │   ├── styles/
│   │   ├── types/
│   │   └── test/
│   ├── Dockerfile
│   ├── nginx.conf
│   ├── package.json
│   └── README.md
└── docs/                       # Optional repository-level documentation


The backend and frontend remain independently buildable and deployable. Their Dockerfiles, dependency manifests, environment configuration, and detailed component documentation are maintained within their respective directories.

Prerequisites

Install the following tools before setting up the application:

Git for source control.
Python 3.12 or newer and uv for the backend.
Node.js 20 or newer and npm 10 or newer for the frontend.
Docker Engine and Docker Compose for containerized deployment.
A PostgreSQL-compatible database for production, such as Neon PostgreSQL.
Appropriate credentials for any enabled external integrations.

Upstash Redis, QStash, and the hosted language-model integration require their respective configuration when those services are enabled. Local development may use the documented fallback implementations where supported.

Getting Started
1. Clone the Repository
bash
git clone <repository-url>
cd gridbricks


Replace <repository-url> with the actual Git repository URL.

2. Configure and Start the Backend
bash
cd backend

uv venv
uv pip install -e ".[dev]"

cp .env.example .env


Review .env before running the application. The provided development configuration may use SQLite for local testing. Production environments should use the intended PostgreSQL database and appropriate credentials.

Apply database migrations:

bash
uv run alembic upgrade head


Check the application configuration and external source connectivity:

bash
uv run python -m app.cli check-config
uv run python -m app.cli check-source-connectivity


Start the API server for local development:

bash
uv run granian --interface asgi app.main:app \
  --host 127.0.0.1 \
  --port 8000 \
  --reload


The backend is available at http://localhost:8000.

The reload option is for development only. Use the production container or a suitably configured process manager for deployment.

3. Configure and Start the Frontend

Open a second terminal:

bash
cd frontend

npm install


Configure the frontend API base URL using the environment convention supported by the Vite application:

dotenv
VITE_API_BASE_URL=http://localhost:8000


For a Vite project, this value can be supplied through the appropriate local environment file, such as frontend/.env.local.

Start the frontend development server:

bash
npm run dev


The frontend is available at http://localhost:5173.

4. Verify the Application

Confirm that:

The backend starts and connects to its configured database.
Database migrations complete successfully.
Elexon source connectivity checks behave as expected.
The frontend can reach the backend API.
The overview and decision review display data from the backend when live mode is available.
Data quality and provenance views correctly represent missing data and forecast eligibility.

Do not treat a successful application startup as proof that historical data is complete or that production readiness has been established.

5. Optional Historical Backfill

For a controlled development or test environment, a sample backfill can be run using:

bash
cd backend

uv run python -m app.cli backfill \
  --decision-from 2026-01-01 \
  --decision-to 2026-01-03


This is an example date range, not a production initialization requirement. Confirm the target database, ingestion scope, and expected runtime before running backfills against production data.

Configuration and Environment Variables
Backend

The backend configuration is managed through typed settings. Start with backend/.env.example and the configuration documentation.

Typical configuration categories include:

Category	Purpose
Database	PostgreSQL or SQLite connection URL, SSL, pooling
Application	Runtime environment, logging, service settings
Security	Authentication and authorization settings, where configured
Elexon	Source API connectivity and request settings
Redis	Cache connectivity and credentials
QStash	Message dispatch and webhook verification configuration
Language model	Hugging Face integration credentials and model settings
Temporal rules	Procurement cutoff and timezone-related configuration
Reliability	HTTP timeouts, retry limits, and backoff policies

The exact variable names and required settings are defined by the backend configuration implementation and its environment template. Consult those files rather than assuming every integration is mandatory.

Frontend

The frontend uses Vite environment variables, including:

Variable	Purpose
VITE_API_BASE_URL	Base URL for the FastAPI API

Vite variables prefixed with VITE_ are embedded in client-side assets. Never place passwords, private API keys, database credentials, signing secrets, or other confidential values in frontend environment variables.

For production, configure the frontend API URL to use the appropriate public API endpoint and configure the API's CORS policy to allow only the intended frontend origins.

Backend Architecture

The backend owns data ingestion, persistence, temporal eligibility, forecast selection, analytics, and API response validation.

Data Sources

Gridbricks uses two permitted Elexon BMRS datasets:

FUELHH: Actual half-hourly wind generation outturn in MW, filtered to fuelType = WIND.
WINDFOR: Historical wind generation forecast publications in MW, retaining publication vintages.

The ingestion pipeline records source data and normalizes it for downstream analytical use. Data availability, publication history, and completeness must be considered when interpreting historical results.

Service Layers
API: FastAPI routes for health, overview, decisions, accuracy, forecast evolution, data quality, ingestion, and exports.
Domain and configuration: Typed settings, logging, exceptions, and business rules.
Persistence: SQLAlchemy models, repositories, database sessions, and Alembic migrations.
Normalization: Calendar handling, UK timezone conversions, daylight-saving transitions, and validation.
Snapshot selection: Historical decision-time forecast eligibility and deterministic snapshot reconstruction.
Metrics: MAE, RMSE, signed bias, WAPE, P90 absolute error, and energy calculations.
Integrations: Elexon clients, Redis, QStash, and the language-model service.
Exports: CSV generation with spreadsheet formula-injection safeguards.
CLI: Configuration checks, ingestion, backfills, snapshot rebuilds, and data-quality reporting.

The backend is the authoritative source for analytical results. The frontend should not independently reconstruct procurement eligibility or substitute client-side calculations for server-defined metrics.

Frontend Architecture

The frontend provides the analyst-facing workspace and consumes the backend API through a centralized typed service layer.

Application shell: Routing, shared providers, and query-client configuration.
Feature modules: Overview, decision review, forecast evolution, provenance, data quality, and methodology.
Visualization layer: D3-based time series, settlement heatmaps, residual charts, and interactive flow diagrams.
Server state: TanStack Query for API requests, caching, loading states, and error handling.
Client state: Zustand for interface-specific state, including active settlement interval and visualization preferences.
Shared components: Reusable layout, controls, feedback, and navigation elements.
Domain utilities: UK date formatting, energy units, and chart presentation.
Type contracts: TypeScript representations of API responses and visualization models.
Tests: Vitest and React Testing Library.
Live API and Demo Fixture Behavior

The frontend supports two distinct operating modes:

Live API mode: Metrics, forecasts, actuals, and snapshots are obtained from the backend.
Demo fixture mode: Deterministic fixtures allow users to explore the interface when the live backend is unavailable. A visible banner identifies this mode, and the interface provides a way to retry the live API.

Demo fixtures are not production evidence. Never use fixture-derived values for procurement reporting, operational decisions, or audited analytical outputs. Production acceptance testing should verify that the live API is configured correctly and that fixture mode cannot be mistaken for live results.

Data Integrity and Temporal Controls

Historical reproducibility is a core system requirement.

Decision-Time Forecast Eligibility

Gridbricks applies a configured decision cutoff, documented as a 10:00 Europe/London placeholder until the business deadline is formally confirmed.

The cutoff must be interpreted in the configured business timezone and converted consistently for storage and comparison. UTC offsets must account for UK daylight-saving transitions.

A forecast publication is eligible only when it satisfies the defined cutoff rule. Forecasts published after the deadline must not influence the reconstructed historical decision.

Snapshot Reconstruction

The snapshot selection engine uses historical publication vintages to reconstruct the forecast eligible at each decision deadline. Snapshot rebuilding should be deterministic for identical source data, cutoff configuration, and methodology.

Accuracy and Units
Forecasts and actuals are represented in MW at the settlement-interval level.
MAE and RMSE quantify absolute and squared error, respectively.
Signed bias indicates the direction of forecast error according to the documented residual convention.
WAPE and P90 must follow the authoritative backend formulas and denominator policies.
MWh calculations must explicitly account for settlement interval duration rather than treating MW and MWh as interchangeable.
Required Validation

Before accepting a production release, verify:

Temporal regression tests prevent future forecasts from leaking into historical decisions.
Daylight-saving transitions and UK settlement periods are handled correctly.
Missing or duplicate source observations are detected and reported.
Snapshot reconstruction remains reproducible.
Exported CSV files are safe against spreadsheet formula injection.
Data quality limitations are visible to analysts.
Testing and Code Quality
Backend

Run from backend/:

bash
# Complete backend test suite with coverage
uv run pytest tests/ --cov=app --cov-report=term-missing

# Critical temporal regression tests
uv run pytest tests/integration/test_temporal_regression.py -v

# Linting
uv run ruff check .

# Formatting validation
uv run ruff format --check .


The backend test suite includes unit tests, Elexon contract tests, temporal regression tests, API integration tests, CSV export tests, and CLI integration tests.

Frontend

Run from frontend/:

bash
# Unit and component tests
npm test

# Interactive test watch mode
npm run test:watch

# Type checking, if configured as a package script
npm run typecheck

# Production build
npm run build


The typecheck command must be present in frontend/package.json; if it is not, run the project's configured TypeScript compiler command instead.

Release Validation

Run the backend and frontend test suites in CI. Add production-build checks, dependency vulnerability scanning, configuration validation, and integration tests against a disposable database.

A passing test suite provides evidence of tested behavior; it does not, by itself, certify operational readiness.

Production Deployment

The backend and frontend can be deployed as separate containers or through an orchestrated deployment. They must use compatible API configuration and security policies.

Backend Container

From backend/:

bash
docker build -t gridbricks-backend:latest .

docker run -d \
  --name gridbricks-backend \
  -p 8000:8000 \
  --env-file .env \
  gridbricks-backend:latest


Use a production-specific environment file and deployment secrets rather than copying development credentials into the container.

Frontend Container

From frontend/:

bash
docker build -t gridbricks-frontend:latest .

docker run -d \
  --name gridbricks-frontend \
  -p 8080:80 \
  gridbricks-frontend:latest


The frontend is served by Nginx on container port 80. The published port above exposes it at http://localhost:8080.

Configure VITE_API_BASE_URL for the intended API endpoint when building the frontend image, unless the frontend has an explicitly implemented runtime configuration mechanism.

Local Container Stack

The backend includes a compose.yaml for its local stack. From backend/, run:

bash
docker compose up -d


Review the Compose file before use to understand which services it starts and how environment variables, volumes, and ports are configured. Do not assume it deploys the frontend unless the Compose configuration explicitly includes it.

Production Deployment Requirements

Before exposing the application to users:

Database: Configure managed PostgreSQL, TLS, least-privilege credentials, connection limits, backups, and a tested recovery process.
Migrations: Run Alembic migrations as a controlled deployment step. Avoid having every application replica independently perform schema migrations.
Secrets: Use a managed secrets facility or protected deployment environment. Never commit populated .env files.
Transport security: Terminate HTTPS at a trusted ingress, load balancer, or reverse proxy.
Access control: Confirm authentication, authorization, and administrative access controls are implemented and enabled for the deployment. Do not assume CORS provides authentication.
Network policy: Restrict database and internal service access; expose only required public endpoints.
Observability: Centralize logs, monitor health and error rates, and alert on ingestion failures, stale upstream data, and unexpected data-quality changes.
Reliability: Set bounded request timeouts, retry limits, and connection pools appropriate to production traffic.
Caching: Define cache expiration and invalidation policies so historical results remain consistent after ingestion or methodology changes.
Background processing: Configure and monitor QStash callbacks, authentication signatures, retries, and idempotency where used.
Frontend delivery: Enable appropriate cache headers, SPA routing fallback, content security controls, and restricted API origins.
Recovery: Test backup restoration, failed deployment rollback, and historical snapshot rebuild procedures.
Data integrity: Verify the cutoff configuration, timezone handling, source completeness, and temporal regression suite before release.

Production suitability must be established against the actual deployment configuration. The presence of Dockerfiles, cloud integrations, and tests should not be interpreted as proof that every security and operational control is already enabled.

Operational Commands

Run the following commands from backend/.

Configuration and Connectivity
bash
uv run python -m app.cli check-config
uv run python -m app.cli check-source-connectivity

Ingest Actual Generation
bash
uv run python -m app.cli ingest-actuals \
  --from-date 2026-01-02 \
  --to-date 2026-02-01

Ingest Forecast Publications
bash
uv run python -m app.cli ingest-forecasts \
  --decision-from 2026-01-01 \
  --decision-to 2026-01-31

Rebuild Historical Snapshots
bash
uv run python -m app.cli rebuild-snapshots \
  --decision-from 2026-01-01 \
  --decision-to 2026-01-31


Use controlled change procedures when rebuilding production snapshots after a methodology or cutoff change. Preserve enough run metadata to explain which configuration and source data produced each result.

Generate a Data Quality Report
bash
uv run python -m app.cli data-quality-report \
  --decision-from 2026-01-01 \
  --decision-to 2026-01-31


These date ranges are examples. Validate CLI argument semantics, target environment, expected data volume, and operational impact before execution.

API Documentation

When the backend is running locally:

Swagger UI: http://localhost:8000/docs
ReDoc: http://localhost:8000/redoc

The API provides the frontend's analytical data and operational views, including health, overview, decisions, accuracy, forecast evolution, data quality, ingestion, and exports.

For production, expose interactive API documentation only according to the deployment's access and information-disclosure policy.

Engineering Documentation

The backend engineering documentation is maintained in backend/docs/:

Architecture and Data Flow
Assumptions and Business Rules Register
Data Dictionary and Schema
Analytics and Metric Formulas
REST API Specification
Operations and Runbook
Testing Strategy and Evidence

Component-specific setup and implementation details are also available in backend/README.md and frontend/README.md.

Production Readiness Considerations

Gridbricks is designed around reproducibility, traceability, and reliable analytical behavior. A production rollout should explicitly establish:

The formally approved procurement cutoff and timezone policy.
The authoritative metric formulas and forecast residual sign convention.
Data completeness expectations and source outage procedures.
Authentication and authorization requirements for the intended user population.
Retention, backup, recovery, and audit-log policies.
Monitoring, alert thresholds, incident ownership, and escalation procedures.
A CI/CD process that validates both applications and safely applies database migrations.
Clear separation between live analytical results and demo fixtures.
An acceptance process for verifying historical results against independently reviewed cases.

Any unresolved configuration or business-rule placeholder should be treated as a release dependency, not silently assumed to be production-approved.

License

Add the applicable license and ownership information before public distribution. No license is implied by this README.