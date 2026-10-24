import type { ReactNode } from 'react'
import { cn } from '@/lib/utils'

interface CardProps {
  children: ReactNode
  className?: string
  title?: ReactNode
  subtitle?: ReactNode
  headerAction?: ReactNode
}

export function Card({
  children,
  className,
  title,
  subtitle,
  headerAction,
}: CardProps) {
  return (
    <div
      className={cn(
        'rounded-xl border border-black/[0.07] dark:border-white/[0.08] bg-white dark:bg-[#12141c] p-5 shadow-[0_1px_2px_0_rgba(0,0,0,0.03)] transition-all',
        className
      )}
    >
      {(title || subtitle || headerAction) && (
        <div className="mb-4 flex items-start justify-between gap-4">
          <div>
            {title && (
              <h3 className="text-sm font-semibold tracking-tight text-zinc-900 dark:text-zinc-100">
                {title}
              </h3>
            )}
            {subtitle && (
              <p className="mt-0.5 text-xs text-zinc-500 dark:text-zinc-400">
                {subtitle}
              </p>
            )}
          </div>
          {headerAction && <div className="flex-shrink-0">{headerAction}</div>}
        </div>
      )}
      {children}
    </div>
  )
}
