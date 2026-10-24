import type { ReactNode } from 'react'
import type { ChartDimensions } from '@/types/charts'

interface SvgContainerProps {
  dimensions: ChartDimensions
  children: ReactNode
  className?: string
  onPointerMove?: (e: React.PointerEvent<SVGSVGElement>) => void
  onPointerLeave?: () => void
}

export function SvgContainer({
  dimensions,
  children,
  className = '',
  onPointerMove,
  onPointerLeave,
}: SvgContainerProps) {
  const { width, height, margin } = dimensions

  return (
    <svg
      width={width}
      height={height}
      viewBox={`0 0 ${width} ${height}`}
      className={`select-none overflow-visible ${className}`}
      onPointerMove={onPointerMove}
      onPointerLeave={onPointerLeave}
    >
      <g transform={`translate(${margin.left}, ${margin.top})`}>{children}</g>
    </svg>
  )
}
