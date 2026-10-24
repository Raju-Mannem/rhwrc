import { render, screen } from '@testing-library/react'
import { describe, it, expect } from 'vitest'
import { MetricCard } from '@/components/shared/MetricCard'

describe('MetricCard Component', () => {
  it('renders label, numeric value, unit, and explanation', () => {
    render(
      <MetricCard
        label="Mean Absolute Error (MAE)"
        value="428.4"
        unit="MW"
        explanation="Typical magnitude of forecast deviation"
      />
    )

    expect(screen.getByText('Mean Absolute Error (MAE)')).toBeInTheDocument()
    expect(screen.getByText('428.4')).toBeInTheDocument()
    expect(screen.getByText('MW')).toBeInTheDocument()
    expect(screen.getByText('Typical magnitude of forecast deviation')).toBeInTheDocument()
  })

  it('renders badge indicator when supplied', () => {
    render(
      <MetricCard
        label="Forecast Bias"
        value="+142.6"
        unit="MW"
        explanation="Directional deviation"
        badge={{ text: 'Overforecast (+)', variant: 'overforecast' }}
      />
    )

    expect(screen.getByText('Overforecast (+)')).toBeInTheDocument()
  })

  it('renders dash fallback when value is null or empty', () => {
    render(
      <MetricCard
        label="Empty Metric"
        value={null}
        explanation="Missing data test"
      />
    )

    expect(screen.getByText('—')).toBeInTheDocument()
  })
})
