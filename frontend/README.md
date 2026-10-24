# Gridbricks Frontend

> **Wind intelligence, without the guesswork.**  
> *A professional, Apple-inspired energy intelligence workspace for UK electricity procurement teams, built with React, TypeScript, Vite, D3.js, and `@xyflow/react`.*

---

## 1. Product Overview

In the UK wholesale electricity market, utilities procure physical electricity day-ahead to balance consumer demand. Because national wind generation fluctuates with weather, procurement analysts rely on half-hourly generation forecasts that may diverge from actual metered output.

**Gridbricks** provides a retrospective decision-support workspace that isolates the forecast available at the historical day-ahead purchasing decision deadline, pairs it with eventual actual outturn generation, quantifies forecast error and directional bias, traces forecast revision provenance, and audits pipeline data quality.

### Key Capabilities
- **Procurement Intelligence Overview (`/overview`)**: Executive KPIs (MAE, RMSE, Signed Bias, WAPE, P90), multi-day actual vs forecast D3 time series, signed residual profile, and a 48-interval settlement heatmap (diverging signed / sequential absolute error).
- **Decision-Day Settlement Audit (`/decision/:date`)**: 48 settlement periods (00:00 to 23:30 UK time) detailed inspection, aligned D3 residual bars, interval detail side drawer, and server-side CSV export.
- **Forecast Evolution Explorer (`/forecast-evolution`)**: Longitudinal revision vintage tracker visualizing publication history across time, featuring a distinct **Decision Cutoff marker** that visually separates eligible forecasts from post-deadline revisions.
- **Interactive Provenance Explorer (`/decision/:date/provenance`)**: `@xyflow/react` node graph mapping:
  `Decision Configuration → Eligible Forecasts → Selected Snapshot → Settlement Comparison (fed by Actuals) → Accuracy Result`.
- **Data Quality & Observability (`/data-quality`)**: Upstream BMRS freshness timestamps (FUELHH and WINDFOR), pipeline run audit logs, and validation findings.
- **Methodology & Mathematical Formulas (`/methodology`)**: Authoritative reference guide explaining MAE, RMSE, Bias, WAPE, P90, MWh vs MW conversion, and market cutoff conventions.

---

## 2. Technology Stack

- **Core Framework**: React 19, TypeScript (Strict), Vite 8
- **Client Routing**: React Router v7 with dynamic `React.lazy()` route chunking
- **Data Fetching & Cache**: TanStack Query v5 with typed query key factories and historical stale-time policies
- **Client UI State**: Zustand (active interval, theme, heatmap mode, command menu)
- **Data Visualization**: D3.js v7 (`d3-scale`, `d3-array`, `d3-shape`, `d3-axis`, `d3-time`, `d3-interpolate`) with React owning the SVG DOM
- **Interactive Provenance Canvas**: `@xyflow/react` v12
- **Styling & Design System**: Tailwind CSS v4, Apple-inspired restrained design tokens, Lucide React icons
- **Testing**: Vitest, React Testing Library, jsdom
- **Production Serving**: Nginx 1.27 Alpine multi-stage Docker container with SPA routing fallback

---

## 3. Getting Started

### Prerequisites
- Node.js `v20+` or `v22+`
- npm `v10+`
- (Optional) Running Gridbricks FastAPI backend on port `8000`

### Installation
```bash
cd frontend
npm install
```

### Development Server
```bash
npm run dev
```
The application opens locally at `http://localhost:5173`.

### Production Build & Preview
```bash
npm run build
npm run preview
```

### Running Automated Tests
```bash
# Run unit and component test suite
npm test

# Run tests in interactive watch mode
npm run test:watch
```

---

## 4. Backend Integration & Strict "No Fake Data" Policy

Gridbricks connects directly to the FastAPI backend at `VITE_API_BASE_URL` (default: `http://localhost:8000`).

### Live Mode vs Demo Fixture Mode
In accordance with production integrity standards:
- **When backend is online**: All metrics, forecasts, actuals, and snapshots are fetched directly from live backend endpoints.
- **When backend is offline**: Gridbricks automatically activates **`DEMO FIXTURE MODE`**, indicated by a prominent amber banner in the top navigation. Deterministic fixtures clearly simulate realistic scenarios (e.g. complete days, telemetry gaps, and large storm overforecasts) so evaluators can inspect every visualization without fabricating fake live records.
- **To switch back**: Click **"Try Live API"** in the top banner once the backend is running.

---

## 5. Docker Deployment

### Building and Running the Production Container
```bash
# Build production Docker image
docker build -t gridbricks-frontend:latest .

# Run container on port 8080
docker run -d -p 8080:80 --name gridbricks-web gridbricks-frontend:latest
```
Visit `http://localhost:8080` in your browser.

---

## 6. Project Architecture

```
frontend/
├── public/                     # Static icons, favicons, manifests
├── src/
│   ├── app/                    # Routing, providers, query client, App shell
│   ├── charts/                 # D3 primitives, axes, legends, tooltips, hooks
│   ├── components/             # Reusable UI primitives, feedback, and layout
│   ├── features/               # Route features: overview, decision-review, evolution, provenance, quality, methodology
│   ├── lib/                    # UK date formatting, energy formatters, utils
│   ├── services/               # Centralized API client, endpoints, fixtures
│   ├── stores/                 # Zustand UI state store
│   ├── styles/                 # Design tokens and global CSS
│   ├── types/                  # TypeScript API contracts and chart models
│   └── test/                   # Vitest unit and component tests
├── Dockerfile                  # Multi-stage production container
├── nginx.conf                  # Nginx SPA fallback and caching config
└── README.md
```
