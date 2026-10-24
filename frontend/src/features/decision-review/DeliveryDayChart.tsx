import { useMemo } from 'react'
import * as d3 from 'd3'
import { useChartDimensions } from '@/charts/hooks/useChartDimensions'
import { SvgContainer } from '@/charts/primitives/SvgContainer'
import { AxisBottom } from '@/charts/primitives/AxisBottom'
import { AxisLeft } from '@/charts/primitives/AxisLeft'
import { TooltipGuide } from '@/charts/primitives/TooltipGuide'
import { ChartLegend } from '@/charts/primitives/ChartLegend'
import { Card } from '@/components/ui/Card'
import { formatMW, formatSignedMW, formatUKTime } from '@/lib/formatters'
import type { IntervalObservationItem } from '@/types/api'

interface DeliveryDayChartProps {
  intervals: IntervalObservationItem[]
  selectedInterval: IntervalObservationItem | null
  onSelectInterval: (interval: IntervalObservationItem) => void
  hoveredInterval: IntervalObservationItem | null
  onHoverInterval: (interval: IntervalObservationItem | null) => void
}

export function DeliveryDayChart({
  intervals,
  selectedInterval,
  onSelectInterval,
  hoveredInterval,
  onHoverInterval,
}: DeliveryDayChartProps) {
  const [containerRef, dimensions] = useChartDimensions(280, {
    top: 20,
    right: 25,
    bottom: 30,
    left: 60,
  })

  const { xScale, yScale, forecastPath, actualPath, parsedData } = useMemo(() => {
    const parsed = intervals.map((iv, idx) => ({
      ...iv,
      date: new Date(iv.start_time_utc),
      index: idx,
    }))

    if (!parsed.length || dimensions.innerWidth <= 0 || dimensions.innerHeight <= 0) {
      return {
        xScale: d3.scaleLinear().range([0, 100]),
        yScale: d3.scaleLinear().range([100, 0]),
        forecastPath: '',
        actualPath: '',
        parsedData: parsed,
      }
    }

    const maxVal =
      d3.max(parsed, (d) => Math.max(d.forecast_mw ?? 0, d.actual_mw ?? 0)) ?? 10000

    const x = d3.scaleLinear().domain([0, 47]).range([0, dimensions.innerWidth])
    const y = d3.scaleLinear().domain([0, maxVal * 1.15]).range([dimensions.innerHeight, 0]).nice()

    const lineForecast = d3
      .line<(typeof parsed)[0]>()
      .defined((d) => d.forecast_mw !== null && !isNaN(d.forecast_mw))
      .x((d) => x(d.index))
      .y((d) => y(d.forecast_mw!))
      .curve(d3.curveMonotoneX)

    const lineActual = d3
      .line<(typeof parsed)[0]>()
      .defined((d) => d.actual_mw !== null && !isNaN(d.actual_mw))
      .x((d) => x(d.index))
      .y((d) => y(d.actual_mw!))
      .curve(d3.curveMonotoneX)

    return {
      xScale: x,
      yScale: y,
      forecastPath: lineForecast(parsed) || '',
      actualPath: lineActual(parsed) || '',
      parsedData: parsed,
    }
  }, [intervals, dimensions.innerWidth, dimensions.innerHeight])

  const handlePointerMove = (e: React.PointerEvent<SVGSVGElement>) => {
    if (!parsedData.length || dimensions.innerWidth <= 0) return

    const rect = e.currentTarget.getBoundingClientRect()
    const relativeX = e.clientX - rect.left - dimensions.margin.left

    if (relativeX < 0 || relativeX > dimensions.innerWidth) {
      onHoverInterval(null)
      return
    }

    const idx = Math.min(47, Math.max(0, Math.round(xScale.invert(relativeX))))
    const item = intervals[idx]
    if (item) {
      onHoverInterval(item)
    }
  }

  const handlePointerLeave = () => {
    onHoverInterval(null)
  }

  const activeItem = hoveredInterval || selectedInterval
  const activeIdx = activeItem
    ? intervals.findIndex((i) => i.start_time_utc === activeItem.start_time_utc)
    : null

  const legendItems = [
    { label: 'Selected Eligible Forecast (MW)', color: 'var(--color-forecast)', type: 'line' as const },
    { label: 'Eventual Actual Generation (MW)', color: 'var(--color-actual)', type: 'line' as const },
  ]

  return (
    <Card
      title="Settlement Day Delivery Profile (48 Settlement Periods)"
      subtitle="Eligible day-ahead forecast vs actual outturn generation across UK half-hourly settlement windows"
      headerAction={<ChartLegend items={legendItems} />}
    >
      <div ref={containerRef} className="w-full relative touch-none">
        <SvgContainer
          dimensions={dimensions}
          onPointerMove={handlePointerMove}
          onPointerLeave={handlePointerLeave}
        >
          {/* Axis Left */}
          <AxisLeft scale={yScale} innerWidth={dimensions.innerWidth} />

          {/* Axis Bottom */}
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

          {/* Missing data shading */}
          {parsedData.map((d) => {
            if (d.match_status === 'MATCHED') return null
            const x = xScale(d.index) - dimensions.innerWidth / 96
            const w = dimensions.innerWidth / 48
            return (
              <rect
                key={d.index}
                x={Math.max(0, x)}
                y={0}
                width={w}
                height={dimensions.innerHeight}
                fill="rgba(244, 63, 94, 0.08)"
                stroke="rgba(244, 63, 94, 0.2)"
                strokeDasharray="2 2"
              />
            )
          })}

          {/* Paths */}
          <path
            d={forecastPath}
            fill="none"
            stroke="var(--color-forecast)"
            strokeWidth={2.2}
            strokeLinecap="round"
          />
          <path
            d={actualPath}
            fill="none"
            stroke="var(--color-actual)"
            strokeWidth={2.2}
            strokeLinecap="round"
          />

          {/* Clickable hit boxes for each interval */}
          {parsedData.map((d) => (
            <rect
              key={d.index}
              x={xScale(d.index) - dimensions.innerWidth / 96}
              y={0}
              width={dimensions.innerWidth / 48}
              height={dimensions.innerHeight}
              fill="transparent"
              className="cursor-pointer"
              onClick={() => onSelectInterval(d)}
            />
          ))}

          {/* Active selection vertical marker */}
          {activeIdx !== null && activeIdx >= 0 && (
            <TooltipGuide
              x={xScale(activeIdx)}
              innerHeight={dimensions.innerHeight}
              points={[
                ...(activeItem?.forecast_mw !== null && activeItem?.forecast_mw !== undefined
                  ? [{ y: yScale(activeItem.forecast_mw), color: 'var(--color-forecast)' }]
                  : []),
                ...(activeItem?.actual_mw !== null && activeItem?.actual_mw !== undefined
                  ? [{ y: yScale(activeItem.actual_mw), color: 'var(--color-actual)' }]
                  : []),
              ]}
            />
          )}
        </SvgContainer>

        {/* Floating tooltip preview */}
        {activeItem && activeIdx !== null && activeIdx >= 0 && (
          <div
            className="pointer-events-none absolute z-20 rounded-lg border border-black/10 dark:border-white/10 bg-white/95 dark:bg-[#181b26]/95 p-2.5 shadow-md backdrop-blur-xs text-xs space-y-1 min-w-[200px]"
            style={{
              left: Math.min(
                dimensions.width - 220,
                Math.max(10, xScale(activeIdx) + dimensions.margin.left - 100)
              ),
              top: 10,
            }}
          >
            <div className="font-mono text-[11px] font-semibold text-zinc-900 dark:text-zinc-100 pb-1 border-b border-black/[0.05] dark:border-white/[0.05]">
              Settlement Period {activeIdx + 1} ({formatUKTime(activeItem.start_time_utc)})
            </div>
            <div className="flex justify-between items-center text-zinc-600 dark:text-zinc-400">
              <span>Forecast:</span>
              <span className="font-mono">{formatMW(activeItem.forecast_mw)}</span>
            </div>
            <div className="flex justify-between items-center text-zinc-600 dark:text-zinc-400">
              <span>Actual:</span>
              <span className="font-mono">{formatMW(activeItem.actual_mw)}</span>
            </div>
            <div className="flex justify-between items-center pt-1 border-t border-black/[0.05] dark:border-white/[0.05]">
              <span>Error (F - A):</span>
              <span className="font-mono font-semibold">
                {formatSignedMW(activeItem.signed_error_mw)}
              </span>
            </div>
          </div>
        )}
      </div>
    </Card>
  )
}
