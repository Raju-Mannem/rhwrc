import { render, screen, fireEvent, act } from '@testing-library/react'
import { describe, it, expect, vi } from 'vitest'
import { EmptyState } from '@/components/feedback/EmptyState'
import { DemoBadge } from '@/components/feedback/DemoBadge'
import { useUIStore } from '@/stores/ui-store'

describe('Feedback Components', () => {
  it('renders EmptyState with message and invokes action callback', () => {
    const handleAction = vi.fn()
    render(
      <EmptyState
        title="No Forecast Vintages"
        description="No publications were recorded for this delivery period."
        actionLabel="Refresh Data"
        onAction={handleAction}
      />
    )

    expect(screen.getByText('No Forecast Vintages')).toBeInTheDocument()
    expect(
      screen.getByText('No publications were recorded for this delivery period.')
    ).toBeInTheDocument()

    const btn = screen.getByText('Refresh Data')
    fireEvent.click(btn)
    expect(handleAction).toHaveBeenCalledTimes(1)
  })

  it('renders DemoBadge in live mode and demo mode', () => {
    act(() => {
      useUIStore.setState({ isDemoMode: false })
    })
    const { rerender } = render(<DemoBadge />)
    expect(screen.getByText('Live API')).toBeInTheDocument()

    act(() => {
      useUIStore.setState({ isDemoMode: true })
    })
    rerender(<DemoBadge />)
    expect(screen.getByText(/DEMO FIXTURE MODE/i)).toBeInTheDocument()
  })
})
