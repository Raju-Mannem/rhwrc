import type { ReactNode } from 'react'
import { Card } from '@/components/ui/Card'
import { Badge } from '@/components/ui/Badge'
import { cn } from '@/lib/utils'

interface MetricCardProps {
  label: string
  value: string | number | null | undefined
  unit?: string
  explanation: string
  badge?: {
    text: string
    variant?: 'default' | 'neutral' | 'success' | 'warning' | 'critical' | 'overforecast' | 'underforecast'
  }
  icon?: ReactNode
  className?: string
}

export function MetricCard({
  label,
  value,
  unit,
  explanation,
  badge,
  icon,
  className,
}: MetricCardProps) {
  const displayVal = value !== null && value !== undefined && value !== '' ? String(value) : '—'

  return (
    <Card className={cn('flex flex-col justify-between p-4', className)}>
      <div>
        <div className="flex items-center justify-between gap-2 mb-2">
          <span className="text-xs font-medium text-zinc-500 dark:text-zinc-400">
            {label}
          </span>
          {icon && <div className="text-zinc-400 dark:text-zinc-500">{icon}</div>}
        </div>

        <div className="flex items-baseline gap-1.5 my-1">
          <span className="text-2xl font-bold tracking-tight text-zinc-900 dark:text-zinc-100 tabular-nums">
            {displayVal}
          </span>
          {unit && (
            <span className="text-xs font-semibold text-zinc-500 dark:text-zinc-400">
              {unit}
            </span>
          )}
        </div>
      </div>

      <div className="mt-3 pt-2.5 border-t border-black/[0.04] dark:border-white/[0.05] flex items-center justify-between gap-2">
        <p className="text-[11px] text-zinc-500 dark:text-zinc-400 line-clamp-1 leading-normal">
          {explanation}
        </p>
        {badge && (
          <Badge variant={badge.variant ?? 'default'} size="sm">
            {badge.text}
          </Badge>
        )}
      </div>
    </Card>
  )
}
