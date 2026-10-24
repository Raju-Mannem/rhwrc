import type { ReactNode } from 'react'
import { AlertCircle, AlertTriangle, Info, CheckCircle2 } from 'lucide-react'
import { cn } from '@/lib/utils'

interface AlertProps {
  children: ReactNode
  title?: ReactNode
  variant?: 'info' | 'warning' | 'critical' | 'success'
  className?: string
}

export function Alert({
  children,
  title,
  variant = 'info',
  className,
}: AlertProps) {
  const icons = {
    info: <Info className="h-4 w-4 text-blue-600 dark:text-blue-400 shrink-0 mt-0.5" />,
    warning: <AlertTriangle className="h-4 w-4 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />,
    critical: <AlertCircle className="h-4 w-4 text-rose-600 dark:text-rose-400 shrink-0 mt-0.5" />,
    success: <CheckCircle2 className="h-4 w-4 text-emerald-600 dark:text-emerald-400 shrink-0 mt-0.5" />,
  }

  const styles = {
    info: 'bg-blue-50/70 border-blue-200/80 text-blue-900 dark:bg-blue-950/30 dark:border-blue-900/40 dark:text-blue-200',
    warning: 'bg-amber-50/70 border-amber-200/80 text-amber-900 dark:bg-amber-950/30 dark:border-amber-900/40 dark:text-amber-200',
    critical: 'bg-rose-50/70 border-rose-200/80 text-rose-900 dark:bg-rose-950/30 dark:border-rose-900/40 dark:text-rose-200',
    success: 'bg-emerald-50/70 border-emerald-200/80 text-emerald-900 dark:bg-emerald-950/30 dark:border-emerald-900/40 dark:text-emerald-200',
  }

  return (
    <div
      role="alert"
      className={cn('flex items-start gap-3 rounded-lg border p-3.5 text-xs leading-relaxed', styles[variant], className)}
    >
      {icons[variant]}
      <div className="flex-1">
        {title && <p className="font-semibold mb-0.5 text-xs">{title}</p>}
        <div className="text-zinc-700 dark:text-zinc-300">{children}</div>
      </div>
    </div>
  )
}
