import { useState, useId } from 'react'
import { useSearchParams } from 'react-router-dom'
import { Clock, CheckCircle2 } from 'lucide-react'
import { useForecastEvolutionQuery } from '@/hooks/queries'
import { EvolutionTimelineChart } from './EvolutionTimelineChart'
import { RevisionHistoryList } from './RevisionHistoryList'
import { Card } from '@/components/ui/Card'
import { Badge } from '@/components/ui/Badge'
import { Skeleton } from '@/components/ui/Skeleton'
import { EmptyState } from '@/components/feedback/EmptyState'
import { formatMW, formatSignedMW } from '@/lib/formatters'
import { formatUKDateTime } from '@/lib/dates'

export function ForecastEvolutionPage() {
  const [searchParams, setSearchParams] = useSearchParams()
  const intervalSelectId = useId()

  // Default target interval: 2026-01-02T14:00:00Z (afternoon peak)
  const paramTime = searchParams.get('start_time_utc')
  const [selectedIntervalUtc, setSelectedIntervalUtc] = useState<string>(
    paramTime || '2026-01-02T14:00:00Z'
  )

  const { data: evolution, isLoading, isError, error, refetch } =
    useForecastEvolutionQuery(selectedIntervalUtc)

  const commonIntervals = [
    { value: '2026-01-02T04:00:00Z', label: '2026-01-02 04:00 UTC (Night Minimum)' },
    { value: '2026-01-02T14:00:00Z', label: '2026-01-02 14:00 UTC (Afternoon Wind Peak)' },
    { value: '2026-01-02T18:30:00Z', label: '2026-01-02 18:30 UTC (Evening System Peak)' },
    { value: '2026-01-03T12:00:00Z', label: '2026-01-03 12:00 UTC (Frontal Passage)' },
    { value: '2026-01-15T15:00:00Z', label: '2026-01-15 15:00 UTC (High Error Storm Window)' },
  ]

  const handleIntervalChange = (val: string) => {
    setSelectedIntervalUtc(val)
    setSearchParams({ start_time_utc: val })
  }

  if (isLoading) {
    return (
      <div className="space-y-6 animate-in fade-in duration-150">
        <Skeleton className="h-8 w-80" />
        <Skeleton className="h-28 w-full rounded-xl" />
        <Skeleton className="h-80 w-full rounded-xl" />
        <Skeleton className="h-64 w-full rounded-xl" />
      </div>
    )
  }

  if (isError || !evolution) {
    return (
      <EmptyState
        title="Unable to Load Forecast Evolution"
        description={
          (error as Error)?.message ||
          'No publication evolution records returned for this delivery timestamp.'
        }
        actionLabel="Retry"
        onAction={() => refetch()}
        isError
      />
    )
  }

  const { revisions, actual_generation_mw, decision_cutoff_utc } = evolution

  const selectedInSnapshot = revisions.find((r) => r.is_selected_in_snapshot)
  const latestRevision = revisions.length ? revisions[revisions.length - 1] : null
  const laterCount = revisions.filter((r) => !r.is_eligible_at_cutoff).length

  return (
    <div className="space-y-6">
      {/* Editorial Header & Target Interval Selector */}
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4 pb-2 border-b border-black/[0.06] dark:border-white/[0.08]">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-zinc-900 dark:text-zinc-50 flex items-center gap-2">
            Forecast Evolution Explorer
          </h1>
          <p className="mt-1 text-xs text-zinc-500 dark:text-zinc-400 max-w-2xl">
            Trace how expected wind power generation shifted across successive publication
            vintages, and isolate the version available at decision deadline.
          </p>
        </div>

        {/* Target Interval Selector */}
        <div className="flex items-center gap-2">
          <label htmlFor={intervalSelectId} className="text-xs font-medium text-zinc-500">
            Target Delivery:
          </label>
          <select
            id={intervalSelectId}
            value={selectedIntervalUtc}
            onChange={(e) => handleIntervalChange(e.target.value)}
            className="h-9 px-3 text-xs font-mono rounded-lg border border-black/[0.08] dark:border-white/[0.08] bg-white dark:bg-[#12141c] text-zinc-900 dark:text-zinc-100 shadow-2xs focus:outline-none focus:ring-2 focus:ring-blue-500/30"
          >
            {commonIntervals.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Analytical Comparison Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {/* Card 1: Eligible at Cutoff */}
        <Card className="border-blue-200/80 dark:border-blue-900/40 bg-blue-50/20 dark:bg-blue-950/10">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-semibold text-blue-900 dark:text-blue-200">
              Eligible Decision Basis
            </span>
            <Badge variant="forecast" size="sm">
              Snapshot Selected
            </Badge>
          </div>
          <div className="text-2xl font-bold font-mono text-zinc-900 dark:text-zinc-100 mt-1">
            {selectedInSnapshot ? formatMW(selectedInSnapshot.generation_mw) : '—'}
          </div>
          <div className="mt-2 text-[11px] text-zinc-500 flex items-center gap-1">
            <Clock className="h-3 w-3" />
            <span>
              Published{' '}
              {selectedInSnapshot ? formatUKDateTime(selectedInSnapshot.publish_time_utc) : '—'}
            </span>
          </div>
        </Card>

        {/* Card 2: Actual Outturn */}
        <Card className="border-teal-200/80 dark:border-teal-900/40 bg-teal-50/20 dark:bg-teal-950/10">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-semibold text-teal-900 dark:text-teal-200">
              Eventual Actual Outturn
            </span>
            <Badge variant="actual" size="sm">
              Elexon FUELHH
            </Badge>
          </div>
          <div className="text-2xl font-bold font-mono text-zinc-900 dark:text-zinc-100 mt-1">
            {formatMW(actual_generation_mw)}
          </div>
          <div className="mt-2 text-[11px] text-zinc-500 flex items-center gap-1">
            <CheckCircle2 className="h-3 w-3 text-teal-600 dark:text-teal-400" />
            <span>
              Decision Error:{' '}
              {selectedInSnapshot && actual_generation_mw !== null
                ? formatSignedMW(selectedInSnapshot.generation_mw - actual_generation_mw)
                : '—'}
            </span>
          </div>
        </Card>

        {/* Card 3: Subsequent Revisions */}
        <Card>
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-semibold text-zinc-700 dark:text-zinc-300">
              Subsequent Intraday Updates
            </span>
            <Badge variant="neutral" size="sm">
              {laterCount} Later Issues
            </Badge>
          </div>
          <div className="text-2xl font-bold font-mono text-zinc-900 dark:text-zinc-100 mt-1">
            {latestRevision && !latestRevision.is_eligible_at_cutoff
              ? formatMW(latestRevision.generation_mw)
              : 'None'}
          </div>
          <div className="mt-2 text-[11px] text-zinc-500">
            {latestRevision && !latestRevision.is_eligible_at_cutoff
              ? `Final issue revised output by ${formatSignedMW(
                  selectedInSnapshot
                    ? latestRevision.generation_mw - selectedInSnapshot.generation_mw
                    : 0
                )}`
              : 'No revisions published after deadline'}
          </div>
        </Card>
      </div>

      {/* Main D3 Evolution Chart */}
      <EvolutionTimelineChart
        revisions={revisions}
        actualMW={actual_generation_mw}
        cutoffUtc={decision_cutoff_utc}
        startTimeUtc={selectedIntervalUtc}
      />

      {/* Chronological Table of Issues */}
      <RevisionHistoryList revisions={revisions} actualMW={actual_generation_mw} />
    </div>
  )
}
