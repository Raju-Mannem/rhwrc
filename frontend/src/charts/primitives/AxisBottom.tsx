import type { ScaleTime, ScaleLinear } from 'd3'

interface AxisBottomProps {
  scale: ScaleTime<number, number> | ScaleLinear<number, number>
  innerHeight: number
  tickCount?: number
  formatTick?: (val: Date | number) => string
}

export function AxisBottom({
  scale,
  innerHeight,
  tickCount = 6,
  formatTick,
}: AxisBottomProps) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const ticks = (scale as any).ticks ? (scale as any).ticks(tickCount) : []

  return (
    <g transform={`translate(0, ${innerHeight})`} className="text-[11px] text-zinc-500 font-mono">
      {/* Baseline */}
      <line x1={0} x2={scale.range()[1]} y1={0} y2={0} stroke="currentColor" strokeOpacity={0.2} />

      {ticks.map((tickVal: Date | number, idx: number) => {
        const x = scale(tickVal as unknown as Date & number)
        const label = formatTick
          ? formatTick(tickVal)
          : tickVal instanceof Date
          ? tickVal.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit', timeZone: 'Europe/London' })
          : String(tickVal)

        return (
          <g key={idx} transform={`translate(${x}, 0)`}>
            <line y1={0} y2={5} stroke="currentColor" strokeOpacity={0.3} />
            <text
              y={18}
              textAnchor="middle"
              fill="currentColor"
              className="fill-zinc-500 dark:fill-zinc-400 select-none"
            >
              {label}
            </text>
          </g>
        )
      })}
    </g>
  )
}
