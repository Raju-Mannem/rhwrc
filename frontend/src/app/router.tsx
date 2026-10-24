import { lazy, Suspense } from 'react'
import { createBrowserRouter, Navigate } from 'react-router-dom'
import { Shell } from '@/components/layout/Shell'
import { Skeleton } from '@/components/ui/Skeleton'
import { ErrorBoundary } from '@/components/feedback/ErrorBoundary'

const OverviewPage = lazy(() =>
  import('@/features/overview/OverviewPage').then((m) => ({ default: m.OverviewPage }))
)
const DecisionReviewPage = lazy(() =>
  import('@/features/decision-review/DecisionReviewPage').then((m) => ({ default: m.DecisionReviewPage }))
)
const ForecastEvolutionPage = lazy(() =>
  import('@/features/forecast-evolution/ForecastEvolutionPage').then((m) => ({ default: m.ForecastEvolutionPage }))
)
const ProvenanceExplorerPage = lazy(() =>
  import('@/features/provenance/ProvenanceExplorerPage').then((m) => ({ default: m.ProvenanceExplorerPage }))
)
const DataQualityPage = lazy(() =>
  import('@/features/data-quality/DataQualityPage').then((m) => ({ default: m.DataQualityPage }))
)
const MethodologyPage = lazy(() =>
  import('@/features/methodology/MethodologyPage').then((m) => ({ default: m.MethodologyPage }))
)

function RouteFallback() {
  return (
    <div className="space-y-6 animate-pulse">
      <Skeleton className="h-8 w-64" />
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <Skeleton key={i} className="h-24 w-full rounded-xl" />
        ))}
      </div>
      <Skeleton className="h-80 w-full rounded-xl" />
    </div>
  )
}

export const router = createBrowserRouter([
  {
    path: '/',
    element: (
      <ErrorBoundary fallbackTitle="Application Shell Error">
        <Shell />
      </ErrorBoundary>
    ),
    children: [
      {
        index: true,
        element: <Navigate to="/overview" replace />,
      },
      {
        path: 'overview',
        element: (
          <Suspense fallback={<RouteFallback />}>
            <OverviewPage />
          </Suspense>
        ),
      },
      {
        path: 'decision/:date',
        element: (
          <Suspense fallback={<RouteFallback />}>
            <DecisionReviewPage />
          </Suspense>
        ),
      },
      {
        path: 'decision/:date/provenance',
        element: (
          <Suspense fallback={<RouteFallback />}>
            <ProvenanceExplorerPage />
          </Suspense>
        ),
      },
      {
        path: 'provenance',
        element: <Navigate to="/decision/2026-01-02/provenance" replace />,
      },
      {
        path: 'forecast-evolution',
        element: (
          <Suspense fallback={<RouteFallback />}>
            <ForecastEvolutionPage />
          </Suspense>
        ),
      },
      {
        path: 'data-quality',
        element: (
          <Suspense fallback={<RouteFallback />}>
            <DataQualityPage />
          </Suspense>
        ),
      },
      {
        path: 'methodology',
        element: (
          <Suspense fallback={<RouteFallback />}>
            <MethodologyPage />
          </Suspense>
        ),
      },
      {
        path: '*',
        element: <Navigate to="/overview" replace />,
      },
    ],
  },
])
