import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { ChevronRight, ArrowUpDown } from 'lucide-react'
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from '@/components/ui/Table'
import { Card } from '@/components/ui/Card'
import { Badge } from '@/components/ui/Badge'
import { formatMW, formatSignedMW, formatPercent } from '@/lib/formatters'
import { useUIStore } from '@/stores/ui-store'
import type { DailyAccuracyItem } from '@/types/api'

interface DailySummaryTableProps {
  items: DailyAccuracyItem[]
}

type SortKey = 'decision_date' | 'mae' | 'bias' | 'coverage'
type SortDir = 'asc' | 'desc'

export function DailySummaryTable({ items }: DailySummaryTableProps) {
  const navigate = useNavigate()
  const { setSelectedDecisionDate } = useUIStore()
  const [sortKey, setSortKey] = useState<SortKey>('decision_date')
  const [sortDir, setSortDir] = useState<SortDir>('asc')

  const handleSort = (key: SortKey) => {
    if (sortKey === key) {
      setSortDir(sortDir === 'asc' ? 'desc' : 'asc')
    } else {
      setSortKey(key)
      setSortDir('asc')
    }
  }

  const sortedItems = [...items].sort((a, b) => {
    let cmp = 0
    if (sortKey === 'decision_date') {
      cmp = a.decision_date.localeCompare(b.decision_date)
    } else if (sortKey === 'mae') {
      cmp = (a.metrics.mae_mw ?? 0) - (b.metrics.mae_mw ?? 0)
    } else if (sortKey === 'bias') {
      cmp = (a.metrics.bias_mw ?? 0) - (b.metrics.bias_mw ?? 0)
    } else if (sortKey === 'coverage') {
      cmp = a.metrics.coverage_ratio - b.metrics.coverage_ratio
    }
    return sortDir === 'asc' ? cmp : -cmp
  })

  const handleRowClick = (dateStr: string) => {
    setSelectedDecisionDate(dateStr)
    navigate(`/decision/${dateStr}`)
  }

  return (
    <Card
      title="Daily Decision Performance Breakdown"
      subtitle="Canonical metrics calculated strictly across valid matched intervals for each day-ahead decision."
    >
      <Table>
        <TableHeader>
          <TableRow className="hover:bg-transparent cursor-default">
            <TableHead>
              <button
                className="flex items-center gap-1 hover:text-zinc-900 dark:hover:text-zinc-100"
                onClick={() => handleSort('decision_date')}
              >
                Decision Date
                <ArrowUpDown className="h-3 w-3" />
              </button>
            </TableHead>
            <TableHead>Delivery Date</TableHead>
            <TableHead>
              <button
                className="flex items-center gap-1 hover:text-zinc-900 dark:hover:text-zinc-100"
                onClick={() => handleSort('mae')}
              >
                MAE (MW)
                <ArrowUpDown className="h-3 w-3" />
              </button>
            </TableHead>
            <TableHead>
              <button
                className="flex items-center gap-1 hover:text-zinc-900 dark:hover:text-zinc-100"
                onClick={() => handleSort('bias')}
              >
                Forecast Bias (MW)
                <ArrowUpDown className="h-3 w-3" />
              </button>
            </TableHead>
            <TableHead>P90 Error</TableHead>
            <TableHead>
              <button
                className="flex items-center gap-1 hover:text-zinc-900 dark:hover:text-zinc-100"
                onClick={() => handleSort('coverage')}
              >
                Matched Coverage
                <ArrowUpDown className="h-3 w-3" />
              </button>
            </TableHead>
            <TableHead>Snapshot Status</TableHead>
            <TableHead className="w-8"></TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {sortedItems.map((item) => {
            const isComplete = item.completeness_status === 'COMPLETE'
            const isOver = (item.metrics.bias_mw ?? 0) > 0
            const isUnder = (item.metrics.bias_mw ?? 0) < 0

            return (
              <TableRow
                key={item.decision_date}
                onClick={() => handleRowClick(item.decision_date)}
              >
                <TableCell className="font-mono font-medium text-zinc-900 dark:text-zinc-100">
                  {item.decision_date}
                </TableCell>
                <TableCell className="font-mono text-zinc-500">
                  {item.delivery_date}
                </TableCell>
                <TableCell className="font-semibold">
                  {formatMW(item.metrics.mae_mw)}
                </TableCell>
                <TableCell
                  className={`font-mono font-medium ${
                    isOver
                      ? 'text-orange-600 dark:text-orange-400'
                      : isUnder
                      ? 'text-indigo-600 dark:text-indigo-400'
                      : 'text-zinc-600'
                  }`}
                >
                  {formatSignedMW(item.metrics.bias_mw)}
                </TableCell>
                <TableCell>{formatMW(item.metrics.p90_abs_error_mw)}</TableCell>
                <TableCell>
                  <span className="font-mono">
                    {item.metrics.matched_intervals}/{item.metrics.expected_intervals} (
                    {formatPercent(item.metrics.coverage_ratio * 100)})
                  </span>
                </TableCell>
                <TableCell>
                  <Badge variant={isComplete ? 'success' : 'warning'} size="sm">
                    {item.completeness_status}
                  </Badge>
                </TableCell>
                <TableCell className="text-zinc-400">
                  <ChevronRight className="h-4 w-4" />
                </TableCell>
              </TableRow>
            )
          })}
        </TableBody>
      </Table>
    </Card>
  )
}
