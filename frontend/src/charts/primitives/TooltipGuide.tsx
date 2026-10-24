interface TooltipGuideProps {
  x: number
  innerHeight: number
  points?: Array<{
    y: number
    color: string
    radius?: number
  }>
}

export function TooltipGuide({ x, innerHeight, points = [] }: TooltipGuideProps) {
  return (
    <g className="pointer-events-none transition-opacity duration-150">
      {/* Vertical crosshair */}
      <line
        x1={x}
        x2={x}
        y1={0}
        y2={innerHeight}
        stroke="currentColor"
        strokeOpacity={0.35}
        strokeDasharray="2 2"
        strokeWidth={1}
        className="text-zinc-600 dark:text-zinc-300"
      />

      {/* Highlighting circles */}
      {points.map((pt, idx) => (
        <circle
          key={idx}
          cx={x}
          cy={pt.y}
          r={pt.radius ?? 4.5}
          fill={pt.color}
          stroke="#ffffff"
          strokeWidth={2}
          className="dark:stroke-zinc-900 shadow-sm"
        />
      ))}
    </g>
  )
}
