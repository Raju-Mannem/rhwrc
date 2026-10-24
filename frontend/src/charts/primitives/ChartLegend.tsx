interface LegendItem {
  label: string
  color: string
  type?: 'line' | 'rect' | 'circle'
}

interface ChartLegendProps {
  items: LegendItem[]
  className?: string
}

export function ChartLegend({ items, className = '' }: ChartLegendProps) {
  return (
    <div className={`flex flex-wrap items-center gap-4 text-xs font-medium text-zinc-600 dark:text-zinc-400 ${className}`}>
      {items.map((item, idx) => (
        <div key={idx} className="flex items-center gap-1.5">
          {item.type === 'rect' ? (
            <span
              className="inline-block h-2.5 w-2.5 rounded-sm"
              style={{ backgroundColor: item.color }}
            />
          ) : (
            <span
              className="inline-block h-1.5 w-4 rounded-full"
              style={{ backgroundColor: item.color }}
            />
          )}
          <span>{item.label}</span>
        </div>
      ))}
    </div>
  )
}
