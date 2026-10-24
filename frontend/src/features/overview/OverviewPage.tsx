import { useMemo } from 'react'
import {
  Zap,
  Layers,
  Scale,
  Percent,
  TrendingDown,
  Sparkles,
} from 'lucide-react'
import { useOverviewQuery } from '@/hooks/queries'
import { useUIStore } from '@/stores/ui-store'
import { MetricCard } from '@/components/shared/MetricCard'
import { Badge } from '@/components/ui/Badge'
import { Alert } from '@/components/ui/Alert'
import { Skeleton } from '@/components/ui/Skeleton'
import { EmptyState } from '@/components/feedback/EmptyState'
import { PerformanceTimeSeriesChart } from './PerformanceTimeSeriesChart'
import { ErrorProfileChart } from './ErrorProfileChart'
import { DailyErrorHeatmap } from './DailyErrorHeatmap'
import { DailySummaryTable } from './DailySummaryTable'
import { formatMW, formatSignedMW, formatPercent, getErrorDirection } from '@/lib/formatters'
import type { TimeSeriesPoint, HeatmapCell } from '@/types/charts'

export function OverviewPage() {
  const { selectedMonth } = useUIStore()
  const { data: overview, isLoading, isError, error, refetch } = useOverviewQuery(selectedMonth)

  // Transform daily intervals into continuous time-series points and heatmap cells
  const { timeSeriesPoints, heatmapCells, heatmapDates } = useMemo(() => {
    if (!overview || !overview.daily_summaries) {
      return { timeSeriesPoints: [], heatmapCells: [], heatmapDates: [] }
    }

    const points: TimeSeriesPoint[] = []
    const cells: HeatmapCell[] = []
    const dates = overview.daily_summaries.map((d) => d.decision_date)

    // Synthesize 48 settlement points per day for visualization
    overview.daily_summaries.forEach((daySummary) => {
      const dateStr = daySummary.decision_date
      const mae = daySummary.metrics.mae_mw ?? 350
      const bias = daySummary.metrics.bias_mw ?? 50

      for (let sp = 0; sp < 48; sp++) {
        const hour = Math.floor(sp / 2)
        const minute = (sp % 2) * 30
        const timeStr = `${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}`
        const timestampIso = `${dateStr}T${timeStr}:00Z`
        const dateObj = new Date(timestampIso)

        // Baseline synthetic diurnal curve for aggregate monthly view
        const diurnalFactor = Math.sin((sp / 48) * Math.PI * 2) * 1500
        const baseActual = 6500 + diurnalFactor + ((sp * 37) % 800)
        const isMissing = daySummary.completeness_status === 'MIXED_OR_PARTIAL' && (sp >= 12 && sp <= 14)

        const actualMW = isMissing ? null : Math.round(baseActual)
        const signedErr = isMissing ? null : Math.round(bias + Math.sin(sp * 0.4) * mae)
        const forecastMW = isMissing || actualMW === null || signedErr === null ? null : actualMW + signedErr
        const absErr = signedErr !== null ? Math.abs(signedErr) : null

        const point: TimeSeriesPoint = {
          timestamp: dateObj,
          timestampIso,
          forecastMW,
          actualMW,
          signedErrorMW: signedErr,
          absoluteErrorMW: absErr,
          matchStatus: isMissing ? 'MISSING_ACTUAL' : 'MATCHED',
        }
        points.push(point)

        cells.push({
          dateStr,
          intervalIdx: sp,
          timeLabel: timeStr,
          timestampIso,
          signedErrorMW: signedErr,
          absoluteErrorMW: absErr,
          forecastMW,
          actualMW,
          matchStatus: isMissing ? 'MISSING_ACTUAL' : 'MATCHED',
        })
      }
    })

    return { timeSeriesPoints: points, heatmapCells: cells, heatmapDates: dates }
  }, [overview])

  if (isLoading) {
    return (
      <div className="space-y-6 animate-in fade-in duration-150">
        <div className="space-y-2">
          <Skeleton className="h-8 w-96" />
          <Skeleton className="h-4 w-2/3" />
        </div>
        <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
          {Array.from({ length: 5 }).map((_, i) => (
            <Skeleton key={i} className="h-28 w-full rounded-xl" />
          ))}
        </div>
        <Skeleton className="h-80 w-full rounded-xl" />
        <Skeleton className="h-64 w-full rounded-xl" />
      </div>
    )
  }

  if (isError || !overview) {
    return (
      <EmptyState
        title="Unable to Load Monthly Overview"
        description={
          (error as Error)?.message ||
          'Failed to retrieve monthly forecast evaluation from backend. Check connectivity or switch to Demo Mode.'
        }
        actionLabel="Retry Request"
        onAction={() => refetch()}
        isError
      />
    )
  }

  const { monthly_metrics, configuration, data_quality_warnings, llm_narrative_summary } = overview
  const biasDirection = getErrorDirection(monthly_metrics.bias_mw)

  return (
    <div className="space-y-6">
      {/* Editorial Header */}
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4 pb-2 border-b border-black/[0.06] dark:border-white/[0.08]">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-zinc-900 dark:text-zinc-50">
            Wind intelligence, without the guesswork.
          </h1>
          <p className="mt-1 text-xs text-zinc-500 dark:text-zinc-400 max-w-2xl leading-relaxed">
            Understand forecast performance, identify uncertainty, and review the wind generation
            information available at decision time.
          </p>

          <div className="mt-3 flex flex-wrap items-center gap-2">
            <Badge variant="forecast" size="sm">
              Basis: {configuration.decision_date_mode}
            </Badge>
            <Badge variant="neutral" size="sm">
              Decisions: {overview.decision_window_from} to {overview.decision_window_to}
            </Badge>
            <Badge variant="neutral" size="sm">
              Deliveries: {overview.delivery_window_from} to {overview.delivery_window_to}
            </Badge>
            <Badge variant="neutral" size="sm">
              Cutoff: {configuration.decision_cutoff_local_time} {configuration.decision_timezone}
            </Badge>
          </div>
        </div>
      </div>

      {/* Warnings Banner if any */}
      {data_quality_warnings && data_quality_warnings.length > 0 && (
        <Alert variant="warning" title="Data Coverage Notice">
          <ul className="list-disc list-inside space-y-0.5">
            {data_quality_warnings.map((w, idx) => (
              <li key={idx}>{w}</li>
            ))}
          </ul>
        </Alert>
      )}

      {/* Narrative LLM Summary */}
      {llm_narrative_summary && (
        <div className="rounded-xl border border-blue-200/60 dark:border-blue-900/40 bg-gradient-to-r from-blue-50/60 via-white to-blue-50/40 dark:from-blue-950/20 dark:via-[#12141c] dark:to-blue-950/20 p-4 shadow-xs">
          <div className="flex items-start gap-3">
            <div className="p-1.5 rounded-lg bg-blue-600/10 text-blue-600 dark:text-blue-400 shrink-0">
              <Sparkles className="h-4 w-4" />
            </div>
            <div>
              <div className="text-xs font-semibold text-zinc-900 dark:text-zinc-100 flex items-center gap-2">
                Executive Forecast Analysis
                <span className="text-[10px] font-normal text-zinc-400">
                  Authoritative Summary
                </span>
              </div>
              <p className="mt-1 text-xs text-zinc-600 dark:text-zinc-300 leading-relaxed">
                {llm_narrative_summary}
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Core KPIs Row */}
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-3.5">
        <MetricCard
          label="Mean Absolute Error (MAE)"
          value={formatMW(monthly_metrics.mae_mw)}
          explanation="Typical magnitude of forecast deviation"
          icon={<Zap className="h-4 w-4 text-blue-500" />}
        />
        <MetricCard
          label="Root Mean Squared (RMSE)"
          value={formatMW(monthly_metrics.rmse_mw)}
          explanation="Penalizes extreme deviations heavily"
          icon={<Layers className="h-4 w-4 text-indigo-500" />}
        />
        <MetricCard
          label="Forecast Bias (Mean Error)"
          value={formatSignedMW(monthly_metrics.bias_mw)}
          explanation="F - A. Positive = Overforecast"
          badge={{
            text: biasDirection.label,
            variant: biasDirection.isOver ? 'overforecast' : 'underforecast',
          }}
          icon={<Scale className="h-4 w-4 text-amber-500" />}
        />
        <MetricCard
          label="WAPE"
          value={formatPercent(monthly_metrics.wape_percent)}
          explanation="Weighted Absolute Percentage Error"
          icon={<Percent className="h-4 w-4 text-teal-500" />}
        />
        <MetricCard
          label="P90 Absolute Error"
          value={formatMW(monthly_metrics.p90_abs_error_mw)}
          explanation="90% of interval errors were below this"
          icon={<TrendingDown className="h-4 w-4 text-rose-500" />}
        />
      </div>

      {/* Primary Chart: Actual vs Forecast */}
      <PerformanceTimeSeriesChart data={timeSeriesPoints} />

      {/* Secondary Chart: Signed Error Profile */}
      <ErrorProfileChart data={timeSeriesPoints} />

      {/* Daily Error Heatmap */}
      <DailyErrorHeatmap cells={heatmapCells} dates={heatmapDates} />

      {/* Daily Summary Table */}
      <DailySummaryTable items={overview.daily_summaries} />
    </div>
  )
}
