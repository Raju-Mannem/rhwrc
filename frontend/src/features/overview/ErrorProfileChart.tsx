import { useState, useMemo } from 'react'
import * as d3 from 'd3'
import { useChartDimensions } from '@/charts/hooks/useChartDimensions'
import { SvgContainer } from '@/charts/primitives/SvgContainer'
import { AxisBottom } from '@/charts/primitives/AxisBottom'
import { AxisLeft } from '@/charts/primitives/AxisLeft'
import { ChartLegend } from '@/charts/primitives/ChartLegend'
import { Card } from '@/components/ui/Card'
import { formatSignedMW, formatUKDateTime } from '@/lib/formatters'
import type { TimeSeriesPoint } from '@/types/charts'

interface ErrorProfileChartProps {
  data: TimeSeriesPoint[]
  height?: number
  onSelectInterval?: (point: TimeSeriesPoint) => void
}

export function ErrorProfileChart({
  data,
  height = 200,
  onSelectInterval,
}: ErrorProfileChartProps) {
  const [containerRef, dimensions] = useChartDimensions(height, {
    top: 15,
    right: 30,
    bottom: 30,
    left: 60,
  })

  const [hoveredPoint, setHoveredPoint] = useState<TimeSeriesPoint | null>(null)
  const [mouseX, setMouseX] = useState<number | null>(null)

  const { xScale, yScale, zeroY } = useMemo(() => {
    if (!data.length || dimensions.innerWidth <= 0 || dimensions.innerHeight <= 0) {
      return {
        xScale: d3.scaleTime().range([0, 100]),
        yScale: d3.scaleLinear().range([100, 0]),
        zeroY: 50,
      }
    }

    const xExtent = d3.extent(data, (d) => d.timestamp) as [Date, Date]
    const validErrors = data.filter((d) => d.signedErrorMW !== null).map((d) => d.signedErrorMW!)
    const maxAbsError = validErrors.length ? Math.max(...validErrors.map(Math.abs)) : 1000
    const domainLimit = Math.max(500, maxAbsError * 1.15)

    const x = d3.scaleTime().domain(xExtent).range([0, dimensions.innerWidth])
    const y = d3.scaleLinear().domain([-domainLimit, domainLimit]).range([dimensions.innerHeight, 0]).nice()

    return {
      xScale: x,
      yScale: y,
      zeroY: y(0),
    }
  }, [data, dimensions.innerWidth, dimensions.innerHeight])

  const handlePointerMove = (e: React.PointerEvent<SVGSVGElement>) => {
    if (!data.length || dimensions.innerWidth <= 0) return

    const rect = e.currentTarget.getBoundingClientRect()
    const relativeX = e.clientX - rect.left - dimensions.margin.left

    if (relativeX < 0 || relativeX > dimensions.innerWidth) {
      setHoveredPoint(null)
      setMouseX(null)
      return
    }

    const targetDate = xScale.invert(relativeX)
    const bisect = d3.bisector<TimeSeriesPoint, Date>((d) => d.timestamp).center
    const idx = bisect(data, targetDate)
    const point = data[idx]

    if (point) {
      setHoveredPoint(point)
      setMouseX(xScale(point.timestamp))
    }
  }

  const handlePointerLeave = () => {
    setHoveredPoint(null)
    setMouseX(null)
  }

  const legendItems = [
    { label: 'Overforecast (+ MW)', color: 'var(--color-overforecast)', type: 'rect' as const },
    { label: 'Underforecast (- MW)', color: 'var(--color-underforecast)', type: 'rect' as const },
  ]

  return (
    <Card
      title="Signed Error Profile (Forecast - Actual)"
      subtitle="Zero-baseline residual profile revealing temporal overforecasting (+) vs underforecasting (-)"
      headerAction={<ChartLegend items={legendItems} />}
    >
      <div ref={containerRef} className="w-full relative touch-none">
        <SvgContainer
          dimensions={dimensions}
          onPointerMove={handlePointerMove}
          onPointerLeave={handlePointerLeave}
        >
          {/* Grid & Axes */}
          <AxisLeft scale={yScale} innerWidth={dimensions.innerWidth} />
          <AxisBottom
            scale={xScale}
            innerHeight={dimensions.innerHeight}
            formatTick={(d) => {
              if (d instanceof Date) {
                return d.toLocaleDateString('en-GB', { day: '2-digit', month: 'short' })
              }
              return String(d)
            }}
          />

          {/* Prominent Zero Baseline */}
          <line
            x1={0}
            x2={dimensions.innerWidth}
            y1={zeroY}
            y2={zeroY}
            stroke="var(--color-zero-baseline)"
            strokeWidth={1.5}
            strokeDasharray="4 2"
          />

          {/* Individual error bars or stem lines */}
          {data.map((d, idx) => {
            if (d.signedErrorMW === null || isNaN(d.signedErrorMW)) return null
            const x = xScale(d.timestamp)
            const y = yScale(d.signedErrorMW)
            const isOver = d.signedErrorMW >= 0
            const barHeight = Math.abs(zeroY - y)
            const barTop = isOver ? y : zeroY

            return (
              <rect
                key={idx}
                x={x - 1.5}
                y={barTop}
                width={3}
                height={Math.max(1.5, barHeight)}
                fill={isOver ? 'var(--color-overforecast)' : 'var(--color-underforecast)'}
                opacity={hoveredPoint?.timestampIso === d.timestampIso ? 1 : 0.75}
                className="transition-opacity cursor-pointer"
                onClick={() => onSelectInterval?.(d)}
              />
            )
          })}

          {/* Hover indicator */}
          {hoveredPoint && mouseX !== null && hoveredPoint.signedErrorMW !== null && (
            <circle
              cx={mouseX}
              cy={yScale(hoveredPoint.signedErrorMW)}
              r={4.5}
              fill={
                hoveredPoint.signedErrorMW >= 0
                  ? 'var(--color-overforecast)'
                  : 'var(--color-underforecast)'
              }
              stroke="#ffffff"
              strokeWidth={2}
            />
          )}
        </SvgContainer>

        {/* Floating Tooltip */}
        {hoveredPoint && mouseX !== null && (
          <div
            className="pointer-events-none absolute z-20 rounded-lg border border-black/10 dark:border-white/10 bg-white/95 dark:bg-[#181b26]/95 p-2.5 shadow-md backdrop-blur-xs text-xs space-y-1 transition-all duration-75 min-w-[180px]"
            style={{
              left: Math.min(
                dimensions.width - 200,
                Math.max(10, mouseX + dimensions.margin.left - 90)
              ),
              top: 5,
            }}
          >
            <div className="font-mono text-[11px] text-zinc-500 pb-1 border-b border-black/[0.05] dark:border-white/[0.05]">
              {formatUKDateTime(hoveredPoint.timestamp)}
            </div>
            <div className="flex justify-between items-center">
              <span className="text-zinc-600 dark:text-zinc-400">Signed Residual:</span>
              <span
                className={`font-mono font-semibold ${
                  (hoveredPoint.signedErrorMW ?? 0) >= 0
                    ? 'text-orange-600 dark:text-orange-400'
                    : 'text-indigo-600 dark:text-indigo-400'
                }`}
              >
                {formatSignedMW(hoveredPoint.signedErrorMW)}
              </span>
            </div>
          </div>
        )}
      </div>
    </Card>
  )
}
