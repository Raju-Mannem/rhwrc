import { useState } from 'react'
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from '@/components/ui/Table'
import { Card } from '@/components/ui/Card'
import { Badge } from '@/components/ui/Badge'
import { formatMW, formatSignedMW } from '@/lib/formatters'
import { formatUKTime, formatUKDateTime } from '@/lib/dates'
import type { IntervalObservationItem } from '@/types/api'

interface IntervalTableProps {
  intervals: IntervalObservationItem[]
  selectedInterval: IntervalObservationItem | null
  onSelectInterval: (interval: IntervalObservationItem) => void
}

export function IntervalTable({
  intervals,
  selectedInterval,
  onSelectInterval,
}: IntervalTableProps) {
  const [filterStatus, setFilterStatus] = useState<string>('ALL')

  const filtered = intervals.filter((iv) => {
    if (filterStatus === 'ALL') return true
    if (filterStatus === 'MATCHED') return iv.match_status === 'MATCHED'
    if (filterStatus === 'MISSING') return iv.match_status !== 'MATCHED'
    return true
  })

  return (
    <Card
      title="Settlement Intervals Ledger (48 Half-Hourly Periods)"
      subtitle="Examine granular forecast vs actual matching, publication timestamps, and signed residual error."
      headerAction={
        <div className="flex items-center gap-2">
          <button
            onClick={() => setFilterStatus('ALL')}
            className={`px-2.5 py-1 text-xs rounded-md font-medium transition-colors ${
              filterStatus === 'ALL'
                ? 'bg-zinc-200 dark:bg-zinc-700 text-zinc-900 dark:text-zinc-100'
                : 'text-zinc-500 hover:text-zinc-900 dark:hover:text-zinc-200'
            }`}
          >
            All (48)
          </button>
          <button
            onClick={() => setFilterStatus('MATCHED')}
            className={`px-2.5 py-1 text-xs rounded-md font-medium transition-colors ${
              filterStatus === 'MATCHED'
                ? 'bg-zinc-200 dark:bg-zinc-700 text-zinc-900 dark:text-zinc-100'
                : 'text-zinc-500 hover:text-zinc-900 dark:hover:text-zinc-200'
            }`}
          >
            Matched
          </button>
          <button
            onClick={() => setFilterStatus('MISSING')}
            className={`px-2.5 py-1 text-xs rounded-md font-medium transition-colors ${
              filterStatus === 'MISSING'
                ? 'bg-zinc-200 dark:bg-zinc-700 text-zinc-900 dark:text-zinc-100'
                : 'text-zinc-500 hover:text-zinc-900 dark:hover:text-zinc-200'
            }`}
          >
            Missing/Partial
          </button>
        </div>
      }
    >
      <div className="max-h-96 overflow-y-auto">
        <Table>
          <TableHeader>
            <TableRow className="hover:bg-transparent cursor-default">
              <TableHead className="w-14">SP</TableHead>
              <TableHead>Local Delivery Time</TableHead>
              <TableHead>Forecast MW</TableHead>
              <TableHead>Actual MW</TableHead>
              <TableHead>Signed Error (F-A)</TableHead>
              <TableHead>Absolute Error</TableHead>
              <TableHead>Forecast Published (UTC)</TableHead>
              <TableHead>Status</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filtered.map((iv, idx) => {
              const isSelected = selectedInterval?.start_time_utc === iv.start_time_utc
              const isOver = (iv.signed_error_mw ?? 0) > 0
              const isUnder = (iv.signed_error_mw ?? 0) < 0
              const isMatched = iv.match_status === 'MATCHED'

              return (
                <TableRow
                  key={iv.start_time_utc}
                  onClick={() => onSelectInterval(iv)}
                  className={isSelected ? 'bg-blue-50/70 dark:bg-blue-950/30' : undefined}
                >
                  <TableCell className="font-mono text-zinc-500">{idx + 1}</TableCell>
                  <TableCell className="font-mono font-medium text-zinc-900 dark:text-zinc-100">
                    {formatUKTime(iv.start_time_utc)}
                  </TableCell>
                  <TableCell className="font-mono text-sky-700 dark:text-sky-300 font-medium">
                    {formatMW(iv.forecast_mw)}
                  </TableCell>
                  <TableCell className="font-mono text-teal-700 dark:text-teal-300 font-medium">
                    {formatMW(iv.actual_mw)}
                  </TableCell>
                  <TableCell
                    className={`font-mono font-semibold ${
                      isOver
                        ? 'text-orange-600 dark:text-orange-400'
                        : isUnder
                        ? 'text-indigo-600 dark:text-indigo-400'
                        : 'text-zinc-600'
                    }`}
                  >
                    {formatSignedMW(iv.signed_error_mw)}
                  </TableCell>
                  <TableCell className="font-mono">{formatMW(iv.absolute_error_mw)}</TableCell>
                  <TableCell className="font-mono text-[11px] text-zinc-500">
                    {iv.forecast_publish_time_utc
                      ? formatUKDateTime(iv.forecast_publish_time_utc)
                      : '—'}
                  </TableCell>
                  <TableCell>
                    <Badge variant={isMatched ? 'success' : 'warning'} size="sm">
                      {iv.match_status}
                    </Badge>
                  </TableCell>
                </TableRow>
              )
            })}
          </TableBody>
        </Table>
      </div>
    </Card>
  )
}
