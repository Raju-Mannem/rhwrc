import { useState } from 'react'
import {
  Activity,
  CheckCircle2,
  AlertTriangle,
  AlertCircle,
  Clock,
  ShieldCheck,
  RefreshCw,
} from 'lucide-react'
import { useDataHealthQuery, useIngestionRunsQuery } from '@/hooks/queries'
import { Card } from '@/components/ui/Card'
import { Badge } from '@/components/ui/Badge'
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from '@/components/ui/Table'
import { Skeleton } from '@/components/ui/Skeleton'
import { EmptyState } from '@/components/feedback/EmptyState'
import { formatUKDateTime } from '@/lib/dates'

export function DataQualityPage() {
  const [selectedDataset, setSelectedDataset] = useState<string | undefined>(undefined)
  const [selectedStatus, setSelectedStatus] = useState<string | undefined>(undefined)
  const [page, setPage] = useState<number>(1)

  const {
    data: health,
    isLoading: isHealthLoading,
    isError: isHealthError,
    error: healthError,
    refetch: refetchHealth,
  } = useDataHealthQuery()

  const {
    data: runsData,
    isLoading: isRunsLoading,
    isError: isRunsError,
    refetch: refetchRuns,
  } = useIngestionRunsQuery(page, 15, selectedDataset, selectedStatus)

  if (isHealthLoading) {
    return (
      <div className="space-y-6 animate-in fade-in duration-150">
        <Skeleton className="h-8 w-72" />
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-24 w-full rounded-xl" />
          ))}
        </div>
        <Skeleton className="h-64 w-full rounded-xl" />
        <Skeleton className="h-80 w-full rounded-xl" />
      </div>
    )
  }

  if (isHealthError || !health) {
    return (
      <EmptyState
        title="Unable to Load Pipeline Health"
        description={(healthError as Error)?.message || 'Failed to connect to data health endpoint.'}
        actionLabel="Retry"
        onAction={() => {
          refetchHealth()
          refetchRuns()
        }}
        isError
      />
    )
  }

  const isHealthy = health.status === 'HEALTHY'
  const isDegraded = health.status === 'DEGRADED'

  return (
    <div className="space-y-6">
      {/* Editorial Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-2 border-b border-black/[0.06] dark:border-white/[0.08]">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-zinc-900 dark:text-zinc-50 flex items-center gap-2">
            Data Quality & Pipeline Observability
          </h1>
          <p className="mt-1 text-xs text-zinc-500 dark:text-zinc-400">
            Real-time pipeline reliability audit, upstream BMRS freshness timestamps, and ingestion run histories.
          </p>
        </div>

        <button
          onClick={() => {
            refetchHealth()
            refetchRuns()
          }}
          className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg border border-black/[0.08] dark:border-white/[0.08] bg-white dark:bg-[#12141c] hover:bg-zinc-50 dark:hover:bg-zinc-800 transition-colors"
        >
          <RefreshCw className="h-3.5 w-3.5 text-zinc-500" />
          <span>Refresh Audit</span>
        </button>
      </div>

      {/* Freshness & Quality Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Overall Health Status */}
        <Card className="flex flex-col justify-between p-4">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-zinc-500">Pipeline Status</span>
            <Activity className="h-4 w-4 text-zinc-400" />
          </div>
          <div className="mt-2 flex items-center gap-2">
            {isHealthy ? (
              <CheckCircle2 className="h-5 w-5 text-emerald-500" />
            ) : isDegraded ? (
              <AlertTriangle className="h-5 w-5 text-amber-500" />
            ) : (
              <AlertCircle className="h-5 w-5 text-rose-500" />
            )}
            <span className="text-xl font-bold text-zinc-900 dark:text-zinc-100 font-mono">
              {health.status}
            </span>
          </div>
          <div className="mt-2 text-[11px] text-zinc-500">
            {health.total_issues_count} active validation findings
          </div>
        </Card>

        {/* Last Actuals Run */}
        <Card className="flex flex-col justify-between p-4">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-zinc-500">Actuals Freshness (FUELHH)</span>
            <Clock className="h-4 w-4 text-teal-500" />
          </div>
          <div className="mt-2 font-mono text-sm font-semibold text-zinc-900 dark:text-zinc-100">
            {health.ingestion_freshness.last_successful_actual_utc
              ? formatUKDateTime(health.ingestion_freshness.last_successful_actual_utc)
              : 'Unavailable'}
          </div>
          <div className="mt-2 text-[11px] text-zinc-500">
            BMRS stream last successfully polled
          </div>
        </Card>

        {/* Last Forecast Run */}
        <Card className="flex flex-col justify-between p-4">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-zinc-500">Forecast Freshness (WINDFOR)</span>
            <Clock className="h-4 w-4 text-sky-500" />
          </div>
          <div className="mt-2 font-mono text-sm font-semibold text-zinc-900 dark:text-zinc-100">
            {health.ingestion_freshness.last_successful_forecast_utc
              ? formatUKDateTime(health.ingestion_freshness.last_successful_forecast_utc)
              : 'Unavailable'}
          </div>
          <div className="mt-2 text-[11px] text-zinc-500">
            National Grid ESO publication stream
          </div>
        </Card>

        {/* Issues & Warnings */}
        <Card className="flex flex-col justify-between p-4">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-zinc-500">Audit Flags</span>
            <ShieldCheck className="h-4 w-4 text-emerald-500" />
          </div>
          <div className="mt-2 font-mono text-xl font-bold text-zinc-900 dark:text-zinc-100">
            {health.completeness_metrics.failed_or_partial_runs_count || 0}
            <span className="text-xs font-normal text-zinc-500 ml-1.5">failed/partial</span>
          </div>
          <div className="mt-2 text-[11px] text-zinc-500">
            {health.completeness_metrics.unresolved_critical_flags || 0} critical blockers
          </div>
        </Card>
      </div>

      {/* Data Quality Findings List */}
      <Card
        title="Detected Data Quality Findings"
        subtitle="Upstream stream interruptions, missing delivery observations, and schema validation flags"
      >
        {health.recent_issues.length === 0 ? (
          <p className="text-xs text-zinc-500 py-3 text-center">
            No active quality warnings detected. All datasets satisfy completeness requirements.
          </p>
        ) : (
          <div className="divide-y divide-black/[0.04] dark:divide-white/[0.05]">
            {health.recent_issues.map((iss) => (
              <div key={iss.id} className="py-3 flex items-start justify-between gap-4">
                <div className="flex items-start gap-2.5">
                  {iss.severity === 'CRITICAL' ? (
                    <AlertCircle className="h-4 w-4 text-rose-500 shrink-0 mt-0.5" />
                  ) : iss.severity === 'WARNING' ? (
                    <AlertTriangle className="h-4 w-4 text-amber-500 shrink-0 mt-0.5" />
                  ) : (
                    <CheckCircle2 className="h-4 w-4 text-blue-500 shrink-0 mt-0.5" />
                  )}
                  <div>
                    <div className="text-xs font-medium text-zinc-900 dark:text-zinc-100 flex items-center gap-2">
                      <span>{iss.description}</span>
                      {iss.record_identifier && (
                        <span className="font-mono text-[10px] text-zinc-400 bg-zinc-100 dark:bg-zinc-800 px-1.5 py-0.2 rounded">
                          {iss.record_identifier}
                        </span>
                      )}
                    </div>
                    <div className="text-[11px] text-zinc-500 mt-0.5">
                      Type: {iss.issue_type} • Detected: {formatUKDateTime(iss.detected_at)}
                    </div>
                  </div>
                </div>

                <div className="shrink-0 flex items-center gap-1.5">
                  <Badge variant="neutral" size="sm">
                    {iss.dataset}
                  </Badge>
                  <Badge
                    variant={
                      iss.severity === 'CRITICAL'
                        ? 'critical'
                        : iss.severity === 'WARNING'
                        ? 'warning'
                        : 'neutral'
                    }
                    size="sm"
                  >
                    {iss.severity}
                  </Badge>
                </div>
              </div>
            ))}
          </div>
        )}
      </Card>

      {/* Ingestion Runs Audit Table */}
      <Card
        title="Pipeline Ingestion Run Audit"
        subtitle="Chronological audit log of batch and stream sync operations"
        headerAction={
          <div className="flex items-center gap-2">
            <select
              value={selectedDataset || ''}
              onChange={(e) => {
                setSelectedDataset(e.target.value || undefined)
                setPage(1)
              }}
              className="h-8 px-2 text-xs rounded-md border border-black/10 dark:border-white/10 bg-white dark:bg-[#12141c] text-zinc-700 dark:text-zinc-300"
            >
              <option value="">All Datasets</option>
              <option value="FUELHH">FUELHH (Actuals)</option>
              <option value="WINDFOR">WINDFOR (Forecasts)</option>
            </select>

            <select
              value={selectedStatus || ''}
              onChange={(e) => {
                setSelectedStatus(e.target.value || undefined)
                setPage(1)
              }}
              className="h-8 px-2 text-xs rounded-md border border-black/10 dark:border-white/10 bg-white dark:bg-[#12141c] text-zinc-700 dark:text-zinc-300"
            >
              <option value="">All Statuses</option>
              <option value="SUCCESS">SUCCESS</option>
              <option value="PARTIAL">PARTIAL</option>
              <option value="FAILED">FAILED</option>
            </select>
          </div>
        }
      >
        {isRunsLoading ? (
          <div className="space-y-2 py-4">
            <Skeleton className="h-8 w-full" />
            <Skeleton className="h-8 w-full" />
            <Skeleton className="h-8 w-full" />
          </div>
        ) : isRunsError || !runsData ? (
          <p className="text-xs text-rose-500 py-3 text-center">
            Failed to load ingestion runs from backend audit repository.
          </p>
        ) : runsData.items.length === 0 ? (
          <p className="text-xs text-zinc-500 py-3 text-center">
            No ingestion runs match the selected filter.
          </p>
        ) : (
          <div className="max-h-96 overflow-y-auto">
            <Table>
              <TableHeader>
                <TableRow className="hover:bg-transparent cursor-default">
                  <TableHead>Run ID</TableHead>
                  <TableHead>Dataset</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Started (UTC)</TableHead>
                  <TableHead>Fetched</TableHead>
                  <TableHead>Inserted</TableHead>
                  <TableHead>Rejected</TableHead>
                  <TableHead>Error / Summary</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {runsData.items.map((r) => (
                  <TableRow key={r.id}>
                    <TableCell className="font-mono text-zinc-600 dark:text-zinc-400 text-[11px]">
                      {r.id}
                    </TableCell>
                    <TableCell>
                      <Badge variant={r.dataset === 'FUELHH' ? 'actual' : 'forecast'} size="sm">
                        {r.dataset}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <Badge
                        variant={
                          r.status === 'SUCCESS'
                            ? 'success'
                            : r.status === 'PARTIAL'
                            ? 'warning'
                            : 'critical'
                        }
                        size="sm"
                      >
                        {r.status}
                      </Badge>
                    </TableCell>
                    <TableCell className="font-mono text-[11px]">
                      {formatUKDateTime(r.started_at)}
                    </TableCell>
                    <TableCell className="font-mono">{r.fetched_count}</TableCell>
                    <TableCell className="font-mono text-emerald-600 dark:text-emerald-400">
                      {r.inserted_count}
                    </TableCell>
                    <TableCell className="font-mono text-rose-600 dark:text-rose-400">
                      {r.rejected_count}
                    </TableCell>
                    <TableCell className="text-[11px] text-zinc-500 max-w-xs truncate">
                      {r.error_summary || 'Clean sync completed.'}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </Card>
    </div>
  )
}
