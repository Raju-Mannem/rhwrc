import type { ReactNode } from 'react'
import { cn } from '@/lib/utils'

interface TabItem<T extends string> {
  id: T
  label: ReactNode
  count?: number | string
}

interface TabsProps<T extends string> {
  tabs: TabItem<T>[]
  activeTab: T
  onChange: (id: T) => void
  className?: string
}

export function Tabs<T extends string>({
  tabs,
  activeTab,
  onChange,
  className,
}: TabsProps<T>) {
  return (
    <div
      className={cn(
        'inline-flex items-center gap-1 p-1 rounded-lg bg-zinc-100 dark:bg-zinc-800/80 border border-black/[0.04] dark:border-white/[0.04]',
        className
      )}
      role="tablist"
    >
      {tabs.map((tab) => {
        const isActive = tab.id === activeTab
        return (
          <button
            key={tab.id}
            role="tab"
            aria-selected={isActive}
            onClick={() => onChange(tab.id)}
            className={cn(
              'px-3 py-1.5 text-xs font-medium rounded-md transition-all select-none flex items-center gap-1.5',
              isActive
                ? 'bg-white dark:bg-zinc-700 text-zinc-900 dark:text-zinc-100 shadow-xs'
                : 'text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-200'
            )}
          >
            <span>{tab.label}</span>
            {tab.count !== undefined && (
              <span
                className={cn(
                  'text-[10px] px-1.5 py-0.2 rounded-full tabular-nums',
                  isActive
                    ? 'bg-zinc-100 dark:bg-zinc-600 text-zinc-700 dark:text-zinc-200'
                    : 'bg-zinc-200/70 dark:bg-zinc-700/60 text-zinc-500 dark:text-zinc-400'
                )}
              >
                {tab.count}
              </span>
            )}
          </button>
        )
      })}
    </div>
  )
}
