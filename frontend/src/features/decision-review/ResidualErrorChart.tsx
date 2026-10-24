import { useMemo } from 'react'
import * as d3 from 'd3'
import { useChartDimensions } from '@/charts/hooks/useChartDimensions'
import { SvgContainer } from '@/charts/primitives/SvgContainer'
import { AxisBottom } from '@/charts/primitives/AxisBottom'
import { AxisLeft } from '@/charts/primitives/AxisLeft'
import { Card } from '@/components/ui/Card'
import type { IntervalObservationItem } from '@/types/api'

interface ResidualErrorChartProps {
  intervals: IntervalObservationItem[]
  selectedInterval: IntervalObservationItem | null
  onSelectInterval: (interval: IntervalObservationItem) => void
  hoveredInterval: IntervalObservationItem | null
}

export function ResidualErrorChart({
  intervals,
  selectedInterval,
  onSelectInterval,
  hoveredInterval,
}: ResidualErrorChartProps) {
  const [containerRef, dimensions] = useChartDimensions(160, {
    top: 15,
    right: 25,
    bottom: 30,
    left: 60,
  })

  const { xScale, yScale, zeroY } = useMemo(() => {
    if (!intervals.length || dimensions.innerWidth <= 0 || dimensions.innerHeight <= 0) {
      return {
        xScale: d3.scaleLinear().range([0, 100]),
        yScale: d3.scaleLinear().range([100, 0]),
        zeroY: 50,
      }
    }

    const errors = intervals.map((i) => i.signed_error_mw).filter((e): e is number => e !== null)
    const maxAbs = errors.length ? Math.max(...errors.map(Math.abs)) : 1000
    const limit = Math.max(300, maxAbs * 1.2)

    const x = d3.scaleLinear().domain([0, 47]).range([0, dimensions.innerWidth])
    const y = d3.scaleLinear().domain([-limit, limit]).range([dimensions.innerHeight, 0]).nice()

    return {
      xScale: x,
      yScale: y,
      zeroY: y(0),
    }
  }, [intervals, dimensions.innerWidth, dimensions.innerHeight])

  const activeItem = hoveredInterval || selectedInterval
  const activeIdx = activeItem
    ? intervals.findIndex((i) => i.start_time_utc === activeItem.start_time_utc)
    : null

  const barWidth = Math.max(4, dimensions.innerWidth / 48 - 2)

  return (
    <Card
      title="Settlement Residual Error Profile (MW)"
      subtitle="Aligned interval-by-interval deviation with zero-baseline and explicit over/under sign conventions"
    >
      <div ref={containerRef} className="w-full relative touch-none">
        <SvgContainer dimensions={dimensions}>
          <AxisLeft scale={yScale} innerWidth={dimensions.innerWidth} />
          <AxisBottom
            scale={xScale}
            innerHeight={dimensions.innerHeight}
            tickCount={8}
            formatTick={(idx) => {
              const num = Number(idx)
              const hour = Math.floor(num / 2)
              const min = (num % 2) * 30
              return `${String(hour).padStart(2, '0')}:${String(min).padStart(2, '0')}`
            }}
          />

          {/* Zero baseline */}
          <line
            x1={0}
            x2={dimensions.innerWidth}
            y1={zeroY}
            y2={zeroY}
            stroke="var(--color-zero-baseline)"
            strokeWidth={1.2}
            strokeDasharray="4 2"
          />

          {/* Residual Bars */}
          {intervals.map((iv, idx) => {
            if (iv.signed_error_mw === null) return null
            const x = xScale(idx) - barWidth / 2
            const isOver = iv.signed_error_mw >= 0
            const y = yScale(iv.signed_error_mw)
            const height = Math.abs(zeroY - y)
            const top = isOver ? y : zeroY
            const isSelected = activeIdx === idx

            return (
              <rect
                key={idx}
                x={x}
                y={top}
                width={barWidth}
                height={Math.max(1.5, height)}
                rx={1}
                fill={isOver ? 'var(--color-overforecast)' : 'var(--color-underforecast)'}
                opacity={isSelected ? 1 : 0.75}
                stroke={isSelected ? '#2563eb' : 'transparent'}
                strokeWidth={isSelected ? 1.5 : 0}
                className="cursor-pointer transition-opacity"
                onClick={() => onSelectInterval(iv)}
              />
            )
          })}
        </SvgContainer>
      </div>
    </Card>
  )
}
