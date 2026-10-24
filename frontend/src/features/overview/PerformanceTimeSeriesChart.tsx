import { useState, useMemo } from 'react'
import * as d3 from 'd3'
import { useChartDimensions } from '@/charts/hooks/useChartDimensions'
import { SvgContainer } from '@/charts/primitives/SvgContainer'
import { AxisBottom } from '@/charts/primitives/AxisBottom'
import { AxisLeft } from '@/charts/primitives/AxisLeft'
import { TooltipGuide } from '@/charts/primitives/TooltipGuide'
import { ChartLegend } from '@/charts/primitives/ChartLegend'
import { Card } from '@/components/ui/Card'
import { formatMW, formatUKDateTime, formatSignedMW } from '@/lib/formatters'
import type { TimeSeriesPoint } from '@/types/charts'

interface PerformanceTimeSeriesChartProps {
  data: TimeSeriesPoint[]
  title?: string
  subtitle?: string
  height?: number
  onSelectInterval?: (point: TimeSeriesPoint) => void
}

export function PerformanceTimeSeriesChart({
  data,
  title = 'Wind Generation: Selected Day-Ahead Forecast vs Eventual Actuals',
  subtitle = 'Continuous half-hourly comparison across the evaluation window (MW)',
  height = 320,
  onSelectInterval,
}: PerformanceTimeSeriesChartProps) {
  const [containerRef, dimensions] = useChartDimensions(height, {
    top: 20,
    right: 30,
    bottom: 35,
    left: 60,
  })

  const [hoveredPoint, setHoveredPoint] = useState<TimeSeriesPoint | null>(null)
  const [mouseX, setMouseX] = useState<number | null>(null)

  // Scales memoized against data and container size
  const { xScale, yScale, forecastPath, actualPath } = useMemo(() => {
    if (!data.length || dimensions.innerWidth <= 0 || dimensions.innerHeight <= 0) {
      return {
        xScale: d3.scaleTime().range([0, 100]),
        yScale: d3.scaleLinear().range([100, 0]),
        forecastPath: '',
        actualPath: '',
      }
    }

    const xExtent = d3.extent(data, (d) => d.timestamp) as [Date, Date]
    const maxVal = d3.max(data, (d) => Math.max(d.forecastMW ?? 0, d.actualMW ?? 0)) ?? 10000

    const x = d3.scaleTime().domain(xExtent).range([0, dimensions.innerWidth])
    const y = d3.scaleLinear().domain([0, maxVal * 1.1]).range([dimensions.innerHeight, 0]).nice()

    // Line generators; filter out missing points to avoid misleading bridges across data gaps
    const lineForecast = d3
      .line<TimeSeriesPoint>()
      .defined((d) => d.forecastMW !== null && !isNaN(d.forecastMW))
      .x((d) => x(d.timestamp))
      .y((d) => y(d.forecastMW!))
      .curve(d3.curveMonotoneX)

    const lineActual = d3
      .line<TimeSeriesPoint>()
      .defined((d) => d.actualMW !== null && !isNaN(d.actualMW))
      .x((d) => x(d.timestamp))
      .y((d) => y(d.actualMW!))
      .curve(d3.curveMonotoneX)

    return {
      xScale: x,
      yScale: y,
      forecastPath: lineForecast(data) || '',
      actualPath: lineActual(data) || '',
    }
  }, [data, dimensions.innerWidth, dimensions.innerHeight])

  // Mouse move handler with D3 bisector for precise hover snapping
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
    { label: 'Day-Ahead Wind Forecast (MW)', color: 'var(--color-forecast)', type: 'line' as const },
    { label: 'Actual Outturn Generation (MW)', color: 'var(--color-actual)', type: 'line' as const },
  ]

  return (
    <Card
      title={title}
      subtitle={subtitle}
      headerAction={<ChartLegend items={legendItems} />}
      className="relative"
    >
      <div ref={containerRef} className="w-full relative touch-none">
        <SvgContainer
          dimensions={dimensions}
          onPointerMove={handlePointerMove}
          onPointerLeave={handlePointerLeave}
        >
          {/* Axes */}
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

          {/* Forecast Path */}
          <path
            d={forecastPath}
            fill="none"
            stroke="var(--color-forecast)"
            strokeWidth={2}
            strokeLinecap="round"
            className="transition-opacity duration-200"
          />

          {/* Actual Path */}
          <path
            d={actualPath}
            fill="none"
            stroke="var(--color-actual)"
            strokeWidth={2}
            strokeLinecap="round"
            className="transition-opacity duration-200"
          />

          {/* Hover Crosshair & Highlights */}
          {hoveredPoint && mouseX !== null && (
            <TooltipGuide
              x={mouseX}
              innerHeight={dimensions.innerHeight}
              points={[
                ...(hoveredPoint.forecastMW !== null
                  ? [{ y: yScale(hoveredPoint.forecastMW), color: 'var(--color-forecast)' }]
                  : []),
                ...(hoveredPoint.actualMW !== null
                  ? [{ y: yScale(hoveredPoint.actualMW), color: 'var(--color-actual)' }]
                  : []),
              ]}
            />
          )}
        </SvgContainer>

        {/* Floating Tooltip Box */}
        {hoveredPoint && mouseX !== null && (
          <div
            className="pointer-events-none absolute z-20 rounded-lg border border-black/10 dark:border-white/10 bg-white/95 dark:bg-[#181b26]/95 p-3 shadow-lg backdrop-blur-xs text-xs space-y-1.5 transition-all duration-75 min-w-[210px]"
            style={{
              left: Math.min(
                dimensions.width - 230,
                Math.max(10, mouseX + dimensions.margin.left - 105)
              ),
              top: 15,
            }}
          >
            <div className="font-semibold text-zinc-900 dark:text-zinc-100 border-b border-black/[0.06] dark:border-white/[0.08] pb-1 font-mono text-[11px]">
              {formatUKDateTime(hoveredPoint.timestamp)}
            </div>

            <div className="flex justify-between items-center text-zinc-600 dark:text-zinc-400">
              <span className="flex items-center gap-1.5">
                <span className="h-2 w-2 rounded-full bg-[var(--color-forecast)]" />
                Forecast:
              </span>
              <span className="font-mono font-medium text-zinc-900 dark:text-zinc-100">
                {formatMW(hoveredPoint.forecastMW)}
              </span>
            </div>

            <div className="flex justify-between items-center text-zinc-600 dark:text-zinc-400">
              <span className="flex items-center gap-1.5">
                <span className="h-2 w-2 rounded-full bg-[var(--color-actual)]" />
                Actual:
              </span>
              <span className="font-mono font-medium text-zinc-900 dark:text-zinc-100">
                {formatMW(hoveredPoint.actualMW)}
              </span>
            </div>

            <div className="flex justify-between items-center pt-1 border-t border-black/[0.06] dark:border-white/[0.08]">
              <span className="text-[11px] text-zinc-500">Error (F - A):</span>
              <span
                className={`font-mono font-semibold text-[11px] ${
                  (hoveredPoint.signedErrorMW ?? 0) > 0
                    ? 'text-orange-600 dark:text-orange-400'
                    : (hoveredPoint.signedErrorMW ?? 0) < 0
                    ? 'text-indigo-600 dark:text-indigo-400'
                    : 'text-zinc-600'
                }`}
              >
                {formatSignedMW(hoveredPoint.signedErrorMW)}
              </span>
            </div>

            {onSelectInterval && (
              <div className="text-[10px] text-blue-600 dark:text-blue-400 text-center pt-1">
                Click to inspect settlement interval
              </div>
            )}
          </div>
        )}
      </div>
    </Card>
  )
}
