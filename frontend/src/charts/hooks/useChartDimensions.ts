import { useEffect, useRef, useState } from 'react'
import type { ChartDimensions } from '@/types/charts'

interface Margins {
  top?: number
  right?: number
  bottom?: number
  left?: number
}

export function useChartDimensions(
  defaultHeight = 320,
  customMargins?: Margins
): [React.RefObject<HTMLDivElement | null>, ChartDimensions] {
  const containerRef = useRef<HTMLDivElement | null>(null)

  const margin = {
    top: customMargins?.top ?? 20,
    right: customMargins?.right ?? 24,
    bottom: customMargins?.bottom ?? 36,
    left: customMargins?.left ?? 56,
  }

  const [dimensions, setDimensions] = useState<ChartDimensions>({
    width: 600,
    height: defaultHeight,
    margin,
    innerWidth: 600 - margin.left - margin.right,
    innerHeight: defaultHeight - margin.top - margin.bottom,
  })

  useEffect(() => {
    const el = containerRef.current
    if (!el) return

    const updateDimensions = () => {
      const rect = el.getBoundingClientRect()
      const width = Math.max(280, Math.floor(rect.width))
      const height = defaultHeight

      setDimensions({
        width,
        height,
        margin,
        innerWidth: Math.max(0, width - margin.left - margin.right),
        innerHeight: Math.max(0, height - margin.top - margin.bottom),
      })
    }

    updateDimensions()

    const observer = new ResizeObserver(() => {
      window.requestAnimationFrame(updateDimensions)
    })
    observer.observe(el)

    return () => observer.disconnect()
  }, [defaultHeight, margin.top, margin.right, margin.bottom, margin.left])

  return [containerRef, dimensions]
}
