import type { ScaleLinear } from 'd3'

interface AxisLeftProps {
  scale: ScaleLinear<number, number>
  innerWidth: number
  tickCount?: number
  formatTick?: (val: number) => string
  showGridLines?: boolean
}

export function AxisLeft({
  scale,
  innerWidth,
  tickCount = 5,
  formatTick = (v) => `${(v / 1000).toFixed(0)}k`,
  showGridLines = true,
}: AxisLeftProps) {
  const ticks = scale.ticks(tickCount)

  return (
    <g className="text-[11px] text-zinc-500 font-mono">
      {ticks.map((tickVal, idx) => {
        const y = scale(tickVal)
        return (
          <g key={idx} transform={`translate(0, ${y})`}>
            {showGridLines && (
              <line
                x1={0}
                x2={innerWidth}
                y1={0}
                y2={0}
                stroke="currentColor"
                strokeOpacity={0.08}
                strokeDasharray="3 3"
              />
            )}
            <line x1={-5} x2={0} y1={0} y2={0} stroke="currentColor" strokeOpacity={0.2} />
            <text
              x={-10}
              y={3}
              textAnchor="end"
              fill="currentColor"
              className="fill-zinc-500 dark:fill-zinc-400 select-none text-[10px]"
            >
              {formatTick(tickVal)}
            </text>
          </g>
        )
      })}
    </g>
  )
}
