import { Link } from 'react-router-dom'
import { Drawer } from '@/components/ui/Drawer'
import { Badge } from '@/components/ui/Badge'
import { Button } from '@/components/ui/Button'
import { formatMW, formatMWh, formatSignedMW, getErrorDirection } from '@/lib/formatters'
import { formatUKDateTime } from '@/lib/dates'
import { GitFork, ExternalLink, ShieldCheck } from 'lucide-react'
import type { IntervalObservationItem } from '@/types/api'

interface IntervalDetailDrawerProps {
  interval: IntervalObservationItem | null
  isOpen: boolean
  onClose: () => void
  decisionDate: string
  cutoffUtc: string
}

export function IntervalDetailDrawer({
  interval,
  isOpen,
  onClose,
  decisionDate,
  cutoffUtc,
}: IntervalDetailDrawerProps) {
  if (!interval) return null

  const isMatched = interval.match_status === 'MATCHED'
  const errorDir = getErrorDirection(interval.signed_error_mw)
  const isEligible = interval.forecast_publish_time_utc
    ? new Date(interval.forecast_publish_time_utc) <= new Date(cutoffUtc)
    : true

  return (
    <Drawer
      isOpen={isOpen}
      onClose={onClose}
      title="Settlement Interval Audit"
      subtitle={`Delivery window ${formatUKDateTime(interval.start_time_utc)} • Decision Date: ${decisionDate}`}
    >
      {/* Top Status & Match State */}
      <div className="flex items-center justify-between p-3.5 rounded-lg bg-zinc-50 dark:bg-zinc-800/60 border border-black/[0.05] dark:border-white/[0.05]">
        <div className="flex items-center gap-2">
          <ShieldCheck className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
          <span className="text-xs font-semibold text-zinc-900 dark:text-zinc-100">
            Observation Status
          </span>
        </div>
        <Badge variant={isMatched ? 'success' : 'warning'} size="sm">
          {interval.match_status}
        </Badge>
      </div>

      {/* Generation & Deviation Comparison */}
      <div className="space-y-3">
        <h4 className="text-xs font-semibold uppercase tracking-wider text-zinc-400">
          Power & Energy Comparison
        </h4>

        <div className="grid grid-cols-2 gap-3">
          <div className="p-3 rounded-lg border border-sky-200/60 dark:border-sky-900/40 bg-sky-50/40 dark:bg-sky-950/20">
            <div className="text-[11px] font-medium text-sky-700 dark:text-sky-300">
              Selected Forecast
            </div>
            <div className="text-lg font-bold text-sky-900 dark:text-sky-100 font-mono mt-0.5">
              {formatMW(interval.forecast_mw)}
            </div>
            <div className="text-[10px] text-zinc-500 mt-1">Day-ahead eligible snapshot</div>
          </div>

          <div className="p-3 rounded-lg border border-teal-200/60 dark:border-teal-900/40 bg-teal-50/40 dark:bg-teal-950/20">
            <div className="text-[11px] font-medium text-teal-700 dark:text-teal-300">
              Actual Outturn
            </div>
            <div className="text-lg font-bold text-teal-900 dark:text-teal-100 font-mono mt-0.5">
              {formatMW(interval.actual_mw)}
            </div>
            <div className="text-[10px] text-zinc-500 mt-1">Elexon FUELHH wind meter</div>
          </div>
        </div>

        <div className="p-3.5 rounded-lg border border-black/[0.06] dark:border-white/[0.08] bg-white dark:bg-[#12141c] space-y-2">
          <div className="flex justify-between items-center text-xs">
            <span className="text-zinc-500">Signed Error (F - A):</span>
            <span className="font-mono font-semibold">
              {formatSignedMW(interval.signed_error_mw)}
            </span>
          </div>

          <div className="flex justify-between items-center text-xs">
            <span className="text-zinc-500">Error Direction:</span>
            <Badge
              variant={errorDir.isOver ? 'overforecast' : errorDir.isUnder ? 'underforecast' : 'neutral'}
              size="sm"
            >
              {errorDir.label}
            </Badge>
          </div>

          <div className="flex justify-between items-center text-xs">
            <span className="text-zinc-500">Equivalent Energy Error:</span>
            <span className="font-mono font-medium text-zinc-800 dark:text-zinc-200">
              {formatMWh(interval.error_mwh)}
            </span>
          </div>
        </div>
      </div>

      {/* Publication Provenance */}
      <div className="space-y-3">
        <h4 className="text-xs font-semibold uppercase tracking-wider text-zinc-400">
          Publication Provenance
        </h4>

        <div className="p-3.5 rounded-lg border border-black/[0.06] dark:border-white/[0.08] bg-white dark:bg-[#12141c] space-y-2.5 text-xs">
          <div className="flex justify-between items-center">
            <span className="text-zinc-500">Publication Timestamp:</span>
            <span className="font-mono font-medium text-zinc-800 dark:text-zinc-200 text-[11px]">
              {interval.forecast_publish_time_utc
                ? formatUKDateTime(interval.forecast_publish_time_utc)
                : '—'}
            </span>
          </div>

          <div className="flex justify-between items-center">
            <span className="text-zinc-500">Decision Cutoff:</span>
            <span className="font-mono text-zinc-600 dark:text-zinc-400 text-[11px]">
              {formatUKDateTime(cutoffUtc)}
            </span>
          </div>

          <div className="flex justify-between items-center">
            <span className="text-zinc-500">Cutoff Eligibility:</span>
            <Badge variant={isEligible ? 'success' : 'critical'} size="sm">
              {isEligible ? 'ELIGIBLE AT CUTOFF' : 'POST-CUTOFF REVISION'}
            </Badge>
          </div>
        </div>
      </div>

      {/* Deep Link to Forecast Evolution */}
      <div className="pt-2">
        <Link
          to={`/forecast-evolution?start_time_utc=${encodeURIComponent(interval.start_time_utc)}`}
          className="w-full"
        >
          <Button variant="outline" className="w-full justify-center gap-2">
            <GitFork className="h-4 w-4 text-blue-600 dark:text-blue-400" />
            <span>Trace Full Revision History (Evolution)</span>
            <ExternalLink className="h-3 w-3 text-zinc-400 ml-auto" />
          </Button>
        </Link>
      </div>
    </Drawer>
  )
}
