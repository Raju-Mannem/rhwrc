import { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import {
  Download,
  Calendar,
  Clock,
  ShieldCheck,
  ChevronLeft,
  ChevronRight,
  GitFork,
  CheckCircle2,
} from 'lucide-react'
import { useDecisionDayQuery } from '@/hooks/queries'
import { useUIStore } from '@/stores/ui-store'
import { Button } from '@/components/ui/Button'
import { Badge } from '@/components/ui/Badge'
import { Card } from '@/components/ui/Card'
import { Skeleton } from '@/components/ui/Skeleton'
import { EmptyState } from '@/components/feedback/EmptyState'
import { DeliveryDayChart } from './DeliveryDayChart'
import { ResidualErrorChart } from './ResidualErrorChart'
import { IntervalTable } from './IntervalTable'
import { IntervalDetailDrawer } from './IntervalDetailDrawer'
import { downloadIntervalsCsv } from '@/services/endpoints'
import { formatMW, formatSignedMW } from '@/lib/formatters'
import type { IntervalObservationItem } from '@/types/api'

export function DecisionReviewPage() {
  const { date: routeDate } = useParams<{ date: string }>()
  const navigate = useNavigate()
  const { selectedDecisionDate, setSelectedDecisionDate } = useUIStore()

  // Use URL date parameter or default to selectedDecisionDate
  const activeDate = routeDate || selectedDecisionDate || '2026-01-02'

  useEffect(() => {
    if (routeDate && routeDate !== selectedDecisionDate) {
      setSelectedDecisionDate(routeDate)
    }
  }, [routeDate, selectedDecisionDate, setSelectedDecisionDate])

  const { data: decisionDay, isLoading, isError, error, refetch } = useDecisionDayQuery(activeDate)

  const [selectedInterval, setSelectedInterval] = useState<IntervalObservationItem | null>(null)
  const [hoveredInterval, setHoveredInterval] = useState<IntervalObservationItem | null>(null)
  const [isDrawerOpen, setIsDrawerOpen] = useState(false)
  const [isExporting, setIsExporting] = useState(false)
  const [exportSuccess, setExportSuccess] = useState(false)

  const handleSelectInterval = (iv: IntervalObservationItem) => {
    setSelectedInterval(iv)
    setIsDrawerOpen(true)
  }

  const handleExportCsv = async () => {
    setIsExporting(true)
    setExportSuccess(false)
    try {
      await downloadIntervalsCsv(activeDate)
      setExportSuccess(true)
      setTimeout(() => setExportSuccess(false), 3000)
    } catch (err) {
      alert(`Export failed: ${(err as Error).message}`)
    } finally {
      setIsExporting(false)
    }
  }

  // Day navigation helper
  const navigateDay = (offset: number) => {
    const current = new Date(activeDate)
    current.setDate(current.getDate() + offset)
    const newDateStr = current.toISOString().slice(0, 10)
    setSelectedDecisionDate(newDateStr)
    navigate(`/decision/${newDateStr}`)
  }

  if (isLoading) {
    return (
      <div className="space-y-6 animate-in fade-in duration-150">
        <div className="flex justify-between items-center">
          <Skeleton className="h-8 w-64" />
          <Skeleton className="h-8 w-32" />
        </div>
        <Skeleton className="h-24 w-full rounded-xl" />
        <Skeleton className="h-80 w-full rounded-xl" />
        <Skeleton className="h-44 w-full rounded-xl" />
      </div>
    )
  }

  if (isError || !decisionDay) {
    return (
      <EmptyState
        title="Unable to Load Decision Day Snapshot"
        description={
          (error as Error)?.message ||
          `Failed to load snapshot for ${activeDate}. The date may have no ingested forecast data or the backend is offline.`
        }
        actionLabel="Retry"
        onAction={() => refetch()}
        isError
      />
    )
  }

  const { metrics, intervals } = decisionDay

  return (
    <div className="space-y-6">
      {/* Editorial Header & Day Stepper */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-2 border-b border-black/[0.06] dark:border-white/[0.08]">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-zinc-900 dark:text-zinc-50">
            Decision-Day Settlement Audit
          </h1>
          <p className="mt-1 text-xs text-zinc-500 dark:text-zinc-400">
            Day-ahead forecast available at decision cutoff vs actual half-hourly outturn generation.
          </p>
        </div>

        {/* Date Stepper & Actions */}
        <div className="flex items-center gap-2">
          <div className="flex items-center bg-white dark:bg-[#12141c] border border-black/[0.07] dark:border-white/[0.08] rounded-lg p-0.5 shadow-2xs">
            <button
              onClick={() => navigateDay(-1)}
              className="p-1.5 text-zinc-500 hover:text-zinc-900 dark:hover:text-zinc-100 rounded-md hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors"
              title="Previous Day"
            >
              <ChevronLeft className="h-4 w-4" />
            </button>
            <span className="px-3 font-mono text-xs font-semibold text-zinc-900 dark:text-zinc-100">
              {activeDate}
            </span>
            <button
              onClick={() => navigateDay(1)}
              className="p-1.5 text-zinc-500 hover:text-zinc-900 dark:hover:text-zinc-100 rounded-md hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors"
              title="Next Day"
            >
              <ChevronRight className="h-4 w-4" />
            </button>
          </div>

          <Button
            variant="outline"
            size="sm"
            onClick={handleExportCsv}
            isLoading={isExporting}
            className="gap-1.5"
          >
            {exportSuccess ? (
              <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600" />
            ) : (
              <Download className="h-3.5 w-3.5 text-zinc-500" />
            )}
            <span>{exportSuccess ? 'Downloaded' : 'Export CSV'}</span>
          </Button>

          <Button
            variant="secondary"
            size="sm"
            onClick={() => navigate(`/decision/${activeDate}/provenance`)}
            className="gap-1.5"
          >
            <GitFork className="h-3.5 w-3.5 text-blue-600 dark:text-blue-400" />
            <span>Trace Lineage</span>
          </Button>
        </div>
      </div>

      {/* Decision Context Panel */}
      <Card className="bg-white dark:bg-[#12141c] border-black/[0.07] dark:border-white/[0.08]">
        <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-4 text-xs">
          <div>
            <span className="text-[11px] text-zinc-400 block mb-0.5">Decision Date</span>
            <span className="font-mono font-semibold text-zinc-900 dark:text-zinc-100 flex items-center gap-1.5">
              <Calendar className="h-3.5 w-3.5 text-blue-500" />
              {decisionDay.decision_date}
            </span>
          </div>

          <div>
            <span className="text-[11px] text-zinc-400 block mb-0.5">Delivery Date</span>
            <span className="font-mono font-semibold text-zinc-900 dark:text-zinc-100 flex items-center gap-1.5">
              <Calendar className="h-3.5 w-3.5 text-teal-500" />
              {decisionDay.delivery_date}
            </span>
          </div>

          <div>
            <span className="text-[11px] text-zinc-400 block mb-0.5">Enforced Cutoff</span>
            <span className="font-mono text-zinc-700 dark:text-zinc-300 flex items-center gap-1">
              <Clock className="h-3 w-3 text-zinc-400" />
              {decisionDay.decision_cutoff_local}
            </span>
          </div>

          <div>
            <span className="text-[11px] text-zinc-400 block mb-0.5">Selection Policy</span>
            <span className="font-mono text-zinc-700 dark:text-zinc-300">
              {decisionDay.selection_policy}
            </span>
          </div>

          <div>
            <span className="text-[11px] text-zinc-400 block mb-0.5">Matched Coverage</span>
            <span className="font-mono font-medium text-zinc-900 dark:text-zinc-100 flex items-center gap-1">
              <ShieldCheck className="h-3.5 w-3.5 text-emerald-500" />
              {metrics.matched_intervals} / {metrics.expected_intervals} (
              {((metrics.matched_intervals / metrics.expected_intervals) * 100).toFixed(0)}%)
            </span>
          </div>

          <div>
            <span className="text-[11px] text-zinc-400 block mb-0.5">Completeness</span>
            <Badge
              variant={decisionDay.completeness_status === 'COMPLETE' ? 'success' : 'warning'}
              size="sm"
            >
              {decisionDay.completeness_status}
            </Badge>
          </div>
        </div>

        {/* Day Metric Summary Badges */}
        <div className="mt-4 pt-3 border-t border-black/[0.05] dark:border-white/[0.05] flex flex-wrap items-center gap-6 text-xs font-mono">
          <div>
            <span className="text-zinc-400 mr-2">MAE:</span>
            <span className="font-bold text-zinc-900 dark:text-zinc-100">
              {formatMW(metrics.mae_mw)}
            </span>
          </div>
          <div>
            <span className="text-zinc-400 mr-2">Bias:</span>
            <span
              className={`font-bold ${
                (metrics.bias_mw ?? 0) > 0
                  ? 'text-orange-600 dark:text-orange-400'
                  : (metrics.bias_mw ?? 0) < 0
                  ? 'text-indigo-600 dark:text-indigo-400'
                  : 'text-zinc-600'
              }`}
            >
              {formatSignedMW(metrics.bias_mw)}
            </span>
          </div>
          <div>
            <span className="text-zinc-400 mr-2">RMSE:</span>
            <span className="text-zinc-700 dark:text-zinc-300">
              {formatMW(metrics.rmse_mw)}
            </span>
          </div>
          <div>
            <span className="text-zinc-400 mr-2">P90 Error:</span>
            <span className="text-zinc-700 dark:text-zinc-300">
              {formatMW(metrics.p90_abs_error_mw)}
            </span>
          </div>
        </div>
      </Card>

      {/* Main 48-Interval D3 Time-Series Visualization */}
      <DeliveryDayChart
        intervals={intervals}
        selectedInterval={selectedInterval}
        onSelectInterval={handleSelectInterval}
        hoveredInterval={hoveredInterval}
        onHoverInterval={setHoveredInterval}
      />

      {/* Paired Aligned Residual Chart */}
      <ResidualErrorChart
        intervals={intervals}
        selectedInterval={selectedInterval}
        onSelectInterval={handleSelectInterval}
        hoveredInterval={hoveredInterval}
      />

      {/* Settlement Intervals Table */}
      <IntervalTable
        intervals={intervals}
        selectedInterval={selectedInterval}
        onSelectInterval={handleSelectInterval}
      />

      {/* Selected Interval Detail Drawer */}
      <IntervalDetailDrawer
        interval={selectedInterval}
        isOpen={isDrawerOpen}
        onClose={() => setIsDrawerOpen(false)}
        decisionDate={activeDate}
        cutoffUtc={decisionDay.decision_cutoff_utc}
      />
    </div>
  )
}
