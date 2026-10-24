import { useMemo, useState } from 'react'
import * as d3 from 'd3'
import { useChartDimensions } from '@/charts/hooks/useChartDimensions'
import { SvgContainer } from '@/charts/primitives/SvgContainer'
import { AxisBottom } from '@/charts/primitives/AxisBottom'
import { AxisLeft } from '@/charts/primitives/AxisLeft'
import { ChartLegend } from '@/charts/primitives/ChartLegend'
import { Card } from '@/components/ui/Card'
import { formatMW, formatUKDateTime, formatSignedMW } from '@/lib/formatters'
import type { ForecastEvolutionItem } from '@/types/api'

interface EvolutionTimelineChartProps {
  revisions: ForecastEvolutionItem[]
  actualMW: number | null
  cutoffUtc: string | null
  startTimeUtc: string
}

export function EvolutionTimelineChart({
  revisions,
  actualMW,
  cutoffUtc,
  startTimeUtc,
}: EvolutionTimelineChartProps) {
  const [containerRef, dimensions] = useChartDimensions(320, {
    top: 25,
    right: 40,
    bottom: 35,
    left: 65,
  })

  const [hoveredRevision, setHoveredRevision] = useState<ForecastEvolutionItem | null>(null)

  const parsedRevisions = useMemo(() => {
    return revisions.map((r) => ({
      ...r,
      date: new Date(r.publish_time_utc),
    }))
  }, [revisions])

  const cutoffDate = useMemo(() => (cutoffUtc ? new Date(cutoffUtc) : null), [cutoffUtc])

  const { xScale, yScale, linePathEligible, linePathLater, cutoffX, actualY } = useMemo(() => {
    if (!parsedRevisions.length || dimensions.innerWidth <= 0 || dimensions.innerHeight <= 0) {
      return {
        xScale: d3.scaleTime().range([0, 100]),
        yScale: d3.scaleLinear().range([100, 0]),
        linePathEligible: '',
        linePathLater: '',
        cutoffX: null,
        actualY: null,
      }
    }

    const allDates = parsedRevisions.map((r) => r.date)
    if (cutoffDate) allDates.push(cutoffDate)

    const xExtent = d3.extent(allDates) as [Date, Date]
    // Add small buffer
    const x = d3.scaleTime().domain(xExtent).range([0, dimensions.innerWidth]).nice()

    const allVals = parsedRevisions.map((r) => r.generation_mw)
    if (actualMW !== null) allVals.push(actualMW)

    const minVal = Math.max(0, d3.min(allVals)! * 0.85)
    const maxVal = d3.max(allVals)! * 1.15
    const y = d3.scaleLinear().domain([minVal, maxVal]).range([dimensions.innerHeight, 0]).nice()

    const lineGen = d3
      .line<(typeof parsedRevisions)[0]>()
      .x((d) => x(d.date))
      .y((d) => y(d.generation_mw))
      .curve(d3.curveMonotoneX)

    // Divide into eligible (before or at cutoff) and later revisions
    const eligibleRevs = parsedRevisions.filter((r) => r.is_eligible_at_cutoff)
    const laterRevs = parsedRevisions.filter((r) => !r.is_eligible_at_cutoff)

    // For later line, include the last eligible point as bridge
    const laterWithBridge = eligibleRevs.length
      ? [eligibleRevs[eligibleRevs.length - 1], ...laterRevs]
      : laterRevs

    return {
      xScale: x,
      yScale: y,
      linePathEligible: lineGen(eligibleRevs) || '',
      linePathLater: lineGen(laterWithBridge) || '',
      cutoffX: cutoffDate ? x(cutoffDate) : null,
      actualY: actualMW !== null ? y(actualMW) : null,
    }
  }, [parsedRevisions, cutoffDate, actualMW, dimensions.innerWidth, dimensions.innerHeight])

  const legendItems = [
    { label: 'Eligible Day-Ahead Forecast', color: 'var(--color-forecast)', type: 'circle' as const },
    { label: 'Post-Cutoff Revisions (Excluded)', color: '#a1a1aa', type: 'circle' as const },
    { label: 'Eventual Actual Outturn', color: 'var(--color-actual)', type: 'line' as const },
  ]

  return (
    <Card
      title="Forecast Evolution Across Publication Vintages"
      subtitle={`Track how the forecast for delivery window ${formatUKDateTime(startTimeUtc)} changed as National Grid ESO published revisions`}
      headerAction={<ChartLegend items={legendItems} />}
    >
      <div ref={containerRef} className="w-full relative touch-none">
        <SvgContainer dimensions={dimensions}>
          <AxisLeft scale={yScale} innerWidth={dimensions.innerWidth} />
          <AxisBottom
            scale={xScale}
            innerHeight={dimensions.innerHeight}
            formatTick={(d) => {
              if (d instanceof Date) {
                return d.toLocaleDateString('en-GB', {
                  day: '2-digit',
                  month: 'short',
                  hour: '2-digit',
                  minute: '2-digit',
                  timeZone: 'Europe/London',
                })
              }
              return String(d)
            }}
          />

          {/* Actual Generation Outturn Horizontal Reference Line */}
          {actualY !== null && (
            <g>
              <line
                x1={0}
                x2={dimensions.innerWidth}
                y1={actualY}
                y2={actualY}
                stroke="var(--color-actual)"
                strokeWidth={1.8}
                strokeDasharray="5 3"
              />
              <text
                x={dimensions.innerWidth - 6}
                y={actualY - 6}
                textAnchor="end"
                className="fill-[var(--color-actual)] text-[10px] font-mono font-semibold"
              >
                Actual: {formatMW(actualMW)}
              </text>
            </g>
          )}

          {/* Decision Cutoff Vertical Marker */}
          {cutoffX !== null && cutoffX >= 0 && cutoffX <= dimensions.innerWidth && (
            <g>
              {/* Shading for post-cutoff excluded region */}
              <rect
                x={cutoffX}
                y={0}
                width={dimensions.innerWidth - cutoffX}
                height={dimensions.innerHeight}
                fill="rgba(0, 0, 0, 0.02)"
                className="dark:fill-white/[0.01]"
              />

              <line
                x1={cutoffX}
                x2={cutoffX}
                y1={0}
                y2={dimensions.innerHeight}
                stroke="#f59e0b"
                strokeWidth={2}
                strokeDasharray="4 3"
              />
              <text
                x={cutoffX + 6}
                y={14}
                textAnchor="start"
                className="fill-amber-600 dark:fill-amber-400 text-[10px] font-mono font-medium"
              >
                Decision Cutoff (Excluded Later) →
              </text>
            </g>
          )}

          {/* Eligible Path */}
          <path
            d={linePathEligible}
            fill="none"
            stroke="var(--color-forecast)"
            strokeWidth={2.4}
            strokeLinecap="round"
          />

          {/* Later Revisions Path (Dashed to signify excluded post-decision state) */}
          <path
            d={linePathLater}
            fill="none"
            stroke="#94a3b8"
            strokeWidth={1.8}
            strokeDasharray="4 3"
            strokeLinecap="round"
          />

          {/* Revision Data Points */}
          {parsedRevisions.map((rev, idx) => {
            const cx = xScale(rev.date)
            const cy = yScale(rev.generation_mw)
            const isSelected = rev.is_selected_in_snapshot
            const isEligible = rev.is_eligible_at_cutoff

            return (
              <g key={idx} className="cursor-pointer" onMouseEnter={() => setHoveredRevision(rev)}>
                <circle
                  cx={cx}
                  cy={cy}
                  r={isSelected ? 6 : isEligible ? 4.5 : 3.5}
                  fill={
                    isSelected
                      ? 'var(--color-forecast)'
                      : isEligible
                      ? '#38bdf8'
                      : '#94a3b8'
                  }
                  stroke="#ffffff"
                  strokeWidth={isSelected ? 2.5 : 1.5}
                  className="dark:stroke-zinc-900 shadow-sm transition-transform hover:scale-125"
                />

                {isSelected && (
                  <text
                    x={cx}
                    y={cy - 10}
                    textAnchor="middle"
                    className="fill-blue-600 dark:fill-blue-400 text-[10px] font-mono font-bold"
                  >
                    ★ Selected
                  </text>
                )}
              </g>
            )
          })}
        </SvgContainer>

        {/* Floating Tooltip */}
        {hoveredRevision && (
          <div
            className="pointer-events-none absolute z-20 rounded-lg border border-black/10 dark:border-white/10 bg-white/95 dark:bg-[#181b26]/95 p-3 shadow-xl backdrop-blur-xs text-xs space-y-1.5 min-w-[220px]"
            style={{
              left: Math.min(
                dimensions.width - 240,
                Math.max(10, xScale(new Date(hoveredRevision.publish_time_utc)) + dimensions.margin.left - 110)
              ),
              top: 10,
            }}
          >
            <div className="font-mono text-[11px] font-semibold text-zinc-900 dark:text-zinc-100 pb-1 border-b border-black/[0.05] dark:border-white/[0.05]">
              Published: {formatUKDateTime(hoveredRevision.publish_time_utc)}
            </div>
            <div className="flex justify-between items-center text-zinc-600 dark:text-zinc-400">
              <span>Predicted Power:</span>
              <span className="font-mono font-medium text-zinc-900 dark:text-zinc-100">
                {formatMW(hoveredRevision.generation_mw)}
              </span>
            </div>
            {actualMW !== null && (
              <div className="flex justify-between items-center text-zinc-600 dark:text-zinc-400">
                <span>Error vs Actual:</span>
                <span className="font-mono font-semibold">
                  {formatSignedMW(hoveredRevision.generation_mw - actualMW)}
                </span>
              </div>
            )}
            <div className="flex justify-between items-center pt-1 border-t border-black/[0.05] dark:border-white/[0.05] text-[11px]">
              <span>Decision Status:</span>
              <span
                className={`font-semibold ${
                  hoveredRevision.is_selected_in_snapshot
                    ? 'text-blue-600 dark:text-blue-400'
                    : hoveredRevision.is_eligible_at_cutoff
                    ? 'text-sky-600 dark:text-sky-400'
                    : 'text-zinc-400'
                }`}
              >
                {hoveredRevision.is_selected_in_snapshot
                  ? 'Selected in Snapshot'
                  : hoveredRevision.is_eligible_at_cutoff
                  ? 'Eligible (Superseded)'
                  : 'Excluded (Post-Cutoff)'}
              </span>
            </div>
          </div>
        )}
      </div>
    </Card>
  )
}
