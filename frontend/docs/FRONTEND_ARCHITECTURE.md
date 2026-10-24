# Gridbricks Frontend Architecture

## 1. Architectural Principles

1. **Separation of Concerns**:
   - **Remote Data**: Exclusively owned and cached by TanStack Query (`@tanstack/react-query`).
   - **Client Transient UI**: Owned by Zustand (`src/stores/ui-store.ts`).
   - **URL State**: Route params (`/decision/:date`) and search params (`?start_time_utc=...`) handle shareable analytical context.
2. **React and D3 Ownership Boundary**:
   - React owns the DOM and SVG element lifecycle (`<svg>`, `<g>`, `<path>`, `<rect>`, `<line>`).
   - D3 is used strictly for mathematical transformations, scale mapping (`scaleTime`, `scaleLinear`, `scaleDiverging`), line generators (`d3.line`), and bisectors (`d3.bisector`).
   - This eliminates hydration mismatches, duplicate mutation cycles, and memory leaks.
3. **Data Integrity & Server Authoritative Calculations**:
   - The frontend never attempts to re-calculate official MAE, RMSE, Bias, or WAPE from raw chart points. The backend's canonical summary remains authoritative.
   - Missing data is never treated as 0 MW. Partial observation states are explicitly highlighted.

---

## 2. Directory Hierarchy

```
src/
├── app/
│   ├── App.tsx             # Root application component
│   ├── router.tsx          # Code-split client-side router
│   ├── providers.tsx       # TanStack Query & Theme provider wrapper
│   └── query-client.ts     # QueryClient singleton with historical caching policies
├── charts/
│   ├── primitives/         # SvgContainer, AxisBottom, AxisLeft, TooltipGuide, ChartLegend
│   └── hooks/              # useChartDimensions (ResizeObserver wrapper)
├── components/
│   ├── ui/                 # Card, Button, Badge, Table, Drawer, Tabs, Skeleton, Alert
│   ├── feedback/           # DemoBadge, EmptyState, ErrorBoundary
│   ├── layout/             # Shell, Sidebar, Topbar, CommandMenu (⌘K)
│   └── shared/             # MetricCard
├── features/
│   ├── overview/           # PerformanceTimeSeriesChart, ErrorProfileChart, DailyErrorHeatmap, DailySummaryTable
│   ├── decision-review/    # DeliveryDayChart, ResidualErrorChart, IntervalTable, IntervalDetailDrawer
│   ├── forecast-evolution/ # EvolutionTimelineChart, RevisionHistoryList
│   ├── provenance/         # ProvenanceExplorerPage with custom React Flow nodes
│   ├── data-quality/       # Freshness counters, DataQualityPage, IngestionRunsTable
│   └── methodology/        # Formal definitions, formulas, and market conventions
├── services/
│   ├── api-client.ts       # Centralized fetchJson client with timeout & AbortSignal
│   ├── endpoints.ts        # Typed endpoint fetchers & queryKeys factories
│   └── fixtures.ts         # Deterministic offline test fixtures
├── stores/
│   └── ui-store.ts         # Zustand store for theme, selected date, heatmap mode, demo mode
├── types/
│   ├── api.ts              # FastAPI / Pydantic schema TypeScript types
│   └── charts.ts           # Chart geometry, point, and heatmap interfaces
└── lib/
    ├── utils.ts            # Classnames merger (clsx + tailwind-merge)
    ├── dates.ts            # Europe/London timezone-aware Intl formatters
    └── formatters.ts       # Power MW, energy MWh, signed error formatters
```

---

## 3. Remote Data Management & Caching

### Query Keys Factory
Centralized query key factory ensures deterministic invalidation:
```typescript
export const queryKeys = {
  overview: (month: string) => ['overview', month] as const,
  decisionDay: (date: string) => ['decisionDay', date] as const,
  evolution: (startTimeUtc: string) => ['forecastEvolution', startTimeUtc] as const,
  dataHealth: ['dataHealth'] as const,
  ingestionRuns: (page: number, pageSize: number, dataset?: string, status?: string) =>
    ['ingestionRuns', page, pageSize, dataset, status] as const,
}
```

### Stale-Time Policies
- **Historical Analysis Data** (`overview`, `decisionDay`, `evolution`):
  - `staleTime: 5 minutes`
  - `gcTime: 30 minutes`
  - Eliminates redundant network calls during rapid interval inspection.
- **Operational Data** (`dataHealth`, `ingestionRuns`):
  - `staleTime: 1 minute`
  - Allows manual refetching with "Refresh Audit" button.

---

## 4. Performance & Code Splitting

- Route components are lazy-loaded via `React.lazy()` with route-level skeleton fallbacks.
- Heavy diagramming libraries (`@xyflow/react`) are isolated into independent chunks (`ProvenanceExplorerPage-*.js`, 139 kB), ensuring the initial application payload remains lightweight (394 kB uncompressed, 124 kB gzip).
- All D3 charts use `useChartDimensions` with `window.requestAnimationFrame` to prevent layout thrashing on window resize.
