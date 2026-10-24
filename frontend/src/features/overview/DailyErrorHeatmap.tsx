import { useState, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import * as d3 from 'd3'
import { useChartDimensions } from '@/charts/hooks/useChartDimensions'
import { SvgContainer } from '@/charts/primitives/SvgContainer'
import { Card } from '@/components/ui/Card'
import { Tabs } from '@/components/ui/Tabs'
import { useUIStore, type HeatmapMode } from '@/stores/ui-store'
import { formatSignedMW, formatMW } from '@/lib/formatters'
import type { HeatmapCell } from '@/types/charts'

interface DailyErrorHeatmapProps {
  cells: HeatmapCell[]
  dates: string[] // List of 31 dates YYYY-MM-DD
}

export function DailyErrorHeatmap({ cells, dates }: DailyErrorHeatmapProps) {
  const { heatmapMode, setHeatmapMode, setSelectedDecisionDate } = useUIStore()
  const navigate = useNavigate()

  // Standard height for 31 days with reasonable row spacing
  const [containerRef, dimensions] = useChartDimensions(dates.length * 14 + 60, {
    top: 30,
    right: 25,
    bottom: 25,
    left: 80,
  })

  const [hoveredCell, setHoveredCell] = useState<{
    cell: HeatmapCell
    x: number
    y: number
  } | null>(null)

  // Color scales memoized
  const { colorScaleSigned, colorScaleAbs } = useMemo(() => {
    // Fixed domain policy for stability during interaction
    const colorScaleSigned = d3
      .scaleDiverging<string>()
      .domain([-1000, 0, 1000])
      .interpolator(d3.interpolatePuOr) // Purple/Indigo to Orange

    const colorScaleAbs = d3
      .scaleSequential<string>()
      .domain([0, 1200])
      .interpolator(d3.interpolateYlOrRd)

    return { colorScaleSigned, colorScaleAbs }
  }, [])

  // Cell dimensions
  const cellWidth = Math.max(8, dimensions.innerWidth / 48)
  const cellHeight = Math.max(10, (dimensions.innerHeight - 10) / Math.max(1, dates.length))

  // Group cells by date for fast lookup
  const cellMap = useMemo(() => {
    const map = new Map<string, HeatmapCell>()
    for (const c of cells) {
      map.set(`${c.dateStr}_${c.intervalIdx}`, c)
    }
    return map
  }, [cells])

  const handleCellClick = (cell: HeatmapCell) => {
    setSelectedDecisionDate(cell.dateStr)
    navigate(`/decision/${cell.dateStr}`)
  }

  // Generate x-axis labels (every 4 hours = every 8 intervals)
  const xLabels = [
    { idx: 0, label: '00:00' },
    { idx: 8, label: '04:00' },
    { idx: 16, label: '08:00' },
    { idx: 24, label: '12:00' },
    { idx: 32, label: '16:00' },
    { idx: 40, label: '20:00' },
    { idx: 47, label: '23:30' },
  ]

  return (
    <Card
      title="Settlement Interval Forecast Deviation Heatmap"
      subtitle="48 half-hour settlement periods (X) across each decision day (Y). Click any cell to inspect decision day."
      headerAction={
        <div className="flex items-center gap-3">
          <Tabs<HeatmapMode>
            tabs={[
              { id: 'signed', label: 'Signed Error (Bias)' },
              { id: 'absolute', label: 'Absolute Error (|Error|)' },
            ]}
            activeTab={heatmapMode}
            onChange={setHeatmapMode}
          />
        </div>
      }
    >
      <div ref={containerRef} className="w-full relative touch-none overflow-x-auto">
        <SvgContainer dimensions={dimensions}>
          {/* Top X-Axis Settlement Period Labels */}
          <g className="text-[10px] fill-zinc-400 select-none font-mono">
            {xLabels.map((xl) => (
              <text
                key={xl.idx}
                x={xl.idx * cellWidth + cellWidth / 2}
                y={-10}
                textAnchor="middle"
              >
                {xl.label}
              </text>
            ))}
          </g>

          {/* Matrix of cells */}
          {dates.map((dateStr, rowIdx) => {
            const y = rowIdx * cellHeight
            const dayLabel = dateStr.slice(5) // MM-DD

            return (
              <g key={dateStr} transform={`translate(0, ${y})`}>
                {/* Y-Axis Date Label */}
                <text
                  x={-10}
                  y={cellHeight / 2 + 3}
                  textAnchor="end"
                  className="text-[10px] font-mono fill-zinc-500 dark:fill-zinc-400 select-none hover:fill-blue-500 cursor-pointer"
                  onClick={() => {
                    setSelectedDecisionDate(dateStr)
                    navigate(`/decision/${dateStr}`)
                  }}
                >
                  {dayLabel}
                </text>

                {/* 48 interval blocks */}
                {Array.from({ length: 48 }, (_, colIdx) => {
                  const cell = cellMap.get(`${dateStr}_${colIdx}`)
                  const x = colIdx * cellWidth

                  let fill = 'rgba(150, 150, 150, 0.12)'
                  let isMissing = true

                  if (cell && cell.signedErrorMW !== null) {
                    isMissing = false
                    fill =
                      heatmapMode === 'signed'
                        ? colorScaleSigned(cell.signedErrorMW)
                        : colorScaleAbs(cell.absoluteErrorMW ?? Math.abs(cell.signedErrorMW))
                  }

                  const isHovered =
                    hoveredCell?.cell.dateStr === dateStr &&
                    hoveredCell?.cell.intervalIdx === colIdx

                  return (
                    <rect
                      key={colIdx}
                      x={x}
                      y={0}
                      width={Math.max(1, cellWidth - 1)}
                      height={Math.max(1, cellHeight - 1)}
                      rx={1}
                      fill={fill}
                      stroke={
                        isHovered
                          ? '#2563eb'
                          : isMissing
                          ? 'rgba(200, 200, 200, 0.3)'
                          : 'transparent'
                      }
                      strokeWidth={isHovered ? 1.5 : isMissing ? 0.5 : 0}
                      className="cursor-pointer transition-all duration-75 hover:opacity-90"
                      onClick={() => cell && handleCellClick(cell)}
                      onPointerEnter={() => {
                        if (cell) {
                          setHoveredCell({
                            cell,
                            x: x + cellWidth / 2,
                            y: y + cellHeight,
                          })
                        }
                      }}
                      onPointerLeave={() => setHoveredCell(null)}
                    />
                  )
                })}
              </g>
            )
          })}
        </SvgContainer>

        {/* Floating Tooltip */}
        {hoveredCell && (
          <div
            className="pointer-events-none absolute z-30 rounded-lg border border-black/10 dark:border-white/10 bg-white/95 dark:bg-[#181b26]/95 p-2.5 shadow-xl backdrop-blur-xs text-xs space-y-1 min-w-[200px]"
            style={{
              left: Math.min(
                dimensions.width - 220,
                Math.max(10, hoveredCell.x + dimensions.margin.left - 100)
              ),
              top: Math.max(10, hoveredCell.y + dimensions.margin.top + 8),
            }}
          >
            <div className="font-mono text-[11px] font-semibold text-zinc-900 dark:text-zinc-100 pb-1 border-b border-black/[0.05] dark:border-white/[0.05]">
              {hoveredCell.cell.dateStr} at {hoveredCell.cell.timeLabel} (SP {hoveredCell.cell.intervalIdx + 1})
            </div>
            <div className="flex justify-between items-center text-zinc-600 dark:text-zinc-400">
              <span>Forecast:</span>
              <span className="font-mono">{formatMW(hoveredCell.cell.forecastMW)}</span>
            </div>
            <div className="flex justify-between items-center text-zinc-600 dark:text-zinc-400">
              <span>Actual:</span>
              <span className="font-mono">{formatMW(hoveredCell.cell.actualMW)}</span>
            </div>
            <div className="flex justify-between items-center pt-1 border-t border-black/[0.05] dark:border-white/[0.05]">
              <span>Signed Error:</span>
              <span className="font-mono font-semibold">
                {formatSignedMW(hoveredCell.cell.signedErrorMW)}
              </span>
            </div>
            <div className="text-[10px] text-blue-600 dark:text-blue-400 text-center pt-0.5">
              Click to open decision review
            </div>
          </div>
        )}
      </div>

      {/* Heatmap Legend */}
      <div className="mt-4 pt-3 border-t border-black/[0.05] dark:border-white/[0.05] flex flex-wrap items-center justify-between text-[11px] text-zinc-500">
        <div className="flex items-center gap-2">
          <span>Scale:</span>
          {heatmapMode === 'signed' ? (
            <div className="flex items-center gap-1.5 font-mono">
              <span className="text-indigo-600 dark:text-indigo-400">-1,000 MW (Under)</span>
              <span className="inline-block h-2.5 w-24 rounded bg-gradient-to-r from-indigo-600 via-zinc-100 to-orange-600" />
              <span className="text-orange-600 dark:text-orange-400">+1,000 MW (Over)</span>
            </div>
          ) : (
            <div className="flex items-center gap-1.5 font-mono">
              <span>0 MW</span>
              <span className="inline-block h-2.5 w-24 rounded bg-gradient-to-r from-amber-100 via-orange-500 to-red-700" />
              <span>1,200+ MW</span>
            </div>
          )}
        </div>

        <div className="flex items-center gap-2">
          <span className="inline-block h-2.5 w-2.5 rounded bg-zinc-200 dark:bg-zinc-700 border border-zinc-400/30" />
          <span>Missing Observation</span>
        </div>
      </div>
    </Card>
  )
}
