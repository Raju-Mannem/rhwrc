import type { ReactNode } from 'react'
import { Inbox, AlertCircle } from 'lucide-react'
import { Button } from '@/components/ui/Button'

interface EmptyStateProps {
  title: string
  description: string
  actionLabel?: string
  onAction?: () => void
  isError?: boolean
  icon?: ReactNode
}

export function EmptyState({
  title,
  description,
  actionLabel,
  onAction,
  isError = false,
  icon,
}: EmptyStateProps) {
  return (
    <div className="flex flex-col items-center justify-center p-8 text-center rounded-xl border border-dashed border-black/10 dark:border-white/10 bg-zinc-50/50 dark:bg-white/[0.01]">
      <div className="flex h-12 w-12 items-center justify-center rounded-full bg-zinc-100 dark:bg-zinc-800 text-zinc-500 mb-3.5">
        {icon ? (
          icon
        ) : isError ? (
          <AlertCircle className="h-6 w-6 text-rose-500" />
        ) : (
          <Inbox className="h-6 w-6 text-zinc-400" />
        )}
      </div>
      <h3 className="text-sm font-semibold text-zinc-900 dark:text-zinc-100 mb-1">
        {title}
      </h3>
      <p className="max-w-md text-xs text-zinc-500 dark:text-zinc-400 mb-4 leading-relaxed">
        {description}
      </p>
      {actionLabel && onAction && (
        <Button variant="secondary" size="sm" onClick={onAction}>
          {actionLabel}
        </Button>
      )}
    </div>
  )
}
