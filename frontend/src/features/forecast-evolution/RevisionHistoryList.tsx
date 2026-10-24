import { Badge } from '@/components/ui/Badge'
import { Card } from '@/components/ui/Card'
import { formatMW, formatSignedMW } from '@/lib/formatters'
import { formatUKDateTime } from '@/lib/dates'
import { ArrowUpRight, ArrowDownRight, Minus, CheckCircle, Clock } from 'lucide-react'
import type { ForecastEvolutionItem } from '@/types/api'

interface RevisionHistoryListProps {
  revisions: ForecastEvolutionItem[]
  actualMW: number | null
}

export function RevisionHistoryList({ revisions, actualMW }: RevisionHistoryListProps) {
  if (!revisions.length) {
    return (
      <Card title="Publication Timeline">
        <p className="text-xs text-zinc-500 py-4 text-center">
          No revision vintages recorded for this delivery interval.
        </p>
      </Card>
    )
  }

  return (
    <Card
      title="Chronological Publication Audit"
      subtitle="Examine each National Grid ESO forecast issue, revision deltas (Δ), and decision cutoff eligibility"
    >
      <div className="space-y-3">
        {revisions.map((rev, idx) => {
          const prev = idx > 0 ? revisions[idx - 1] : null
          const delta = prev ? rev.generation_mw - prev.generation_mw : null
          const errorVsAct = actualMW !== null ? rev.generation_mw - actualMW : null

          return (
            <div
              key={rev.publish_time_utc}
              className={`p-3.5 rounded-lg border transition-all ${
                rev.is_selected_in_snapshot
                  ? 'border-blue-300 dark:border-blue-800 bg-blue-50/40 dark:bg-blue-950/20 shadow-xs'
                  : 'border-black/[0.06] dark:border-white/[0.08] bg-white dark:bg-[#12141c]'
              }`}
            >
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                {/* Left: Timestamp & Snapshot badge */}
                <div className="flex items-center gap-2">
                  <Clock className="h-4 w-4 text-zinc-400 shrink-0" />
                  <div>
                    <span className="font-mono text-xs font-semibold text-zinc-900 dark:text-zinc-100">
                      {formatUKDateTime(rev.publish_time_utc)}
                    </span>
                    <span className="text-[10px] text-zinc-400 ml-2 font-mono">
                      (Vintage #{idx + 1})
                    </span>
                  </div>

                  {rev.is_selected_in_snapshot && (
                    <Badge variant="forecast" size="sm" className="ml-2 font-semibold">
                      <CheckCircle className="h-3 w-3 mr-1" />
                      SELECTED SNAPSHOT
                    </Badge>
                  )}
                </div>

                {/* Right: Cutoff Eligibility */}
                <div>
                  <Badge
                    variant={rev.is_eligible_at_cutoff ? 'success' : 'neutral'}
                    size="sm"
                  >
                    {rev.is_eligible_at_cutoff
                      ? 'ELIGIBLE AT CUTOFF'
                      : 'POST-CUTOFF (EXCLUDED)'}
                  </Badge>
                </div>
              </div>

              {/* Metric Row */}
              <div className="mt-3 grid grid-cols-2 sm:grid-cols-4 gap-2 pt-2 border-t border-black/[0.04] dark:border-white/[0.05] text-xs">
                <div>
                  <span className="text-[10px] text-zinc-400 block">Forecast Generation</span>
                  <span className="font-mono font-bold text-zinc-900 dark:text-zinc-100">
                    {formatMW(rev.generation_mw)}
                  </span>
                </div>

                <div>
                  <span className="text-[10px] text-zinc-400 block">Delta vs Prior (Δ)</span>
                  {delta !== null ? (
                    <span
                      className={`font-mono font-semibold flex items-center gap-0.5 ${
                        delta > 0
                          ? 'text-orange-600 dark:text-orange-400'
                          : delta < 0
                          ? 'text-indigo-600 dark:text-indigo-400'
                          : 'text-zinc-500'
                      }`}
                    >
                      {delta > 0 ? (
                        <ArrowUpRight className="h-3 w-3" />
                      ) : delta < 0 ? (
                        <ArrowDownRight className="h-3 w-3" />
                      ) : (
                        <Minus className="h-3 w-3" />
                      )}
                      {formatSignedMW(delta)}
                    </span>
                  ) : (
                    <span className="text-zinc-400 font-mono">Initial issue</span>
                  )}
                </div>

                <div>
                  <span className="text-[10px] text-zinc-400 block">Residual vs Actual</span>
                  {errorVsAct !== null ? (
                    <span className="font-mono font-medium text-zinc-700 dark:text-zinc-300">
                      {formatSignedMW(errorVsAct)}
                    </span>
                  ) : (
                    <span className="text-zinc-400 font-mono">—</span>
                  )}
                </div>

                <div>
                  <span className="text-[10px] text-zinc-400 block">Policy Rule</span>
                  <span className="text-[11px] text-zinc-500">
                    {rev.is_selected_in_snapshot
                      ? 'Latest prior to 10:00 cutoff'
                      : rev.is_eligible_at_cutoff
                      ? 'Superseded by newer issue'
                      : 'Received post-deadline'}
                  </span>
                </div>
              </div>
            </div>
          )
        })}
      </div>
    </Card>
  )
}
