import { describe, it, expect } from 'vitest'
import {
  formatMW,
  formatMWh,
  formatSignedMW,
  formatPercent,
  formatRatio,
  getErrorDirection,
} from '@/lib/formatters'

describe('Energy Domain Formatters', () => {
  it('formats power in MW cleanly', () => {
    expect(formatMW(12500)).toBe('12,500 MW')
    expect(formatMW(0)).toBe('0 MW')
    expect(formatMW(null)).toBe('—')
    expect(formatMW(undefined)).toBe('—')
    expect(formatMW(NaN)).toBe('—')
  })

  it('formats energy volume in MWh', () => {
    expect(formatMWh(6250.5)).toBe('6,250.5 MWh')
    expect(formatMWh(null)).toBe('—')
  })

  it('formats signed error with explicit sign (+ or -)', () => {
    expect(formatSignedMW(420)).toBe('+420 MW')
    expect(formatSignedMW(-310)).toBe('-310 MW')
    expect(formatSignedMW(0)).toBe('0 MW')
    expect(formatSignedMW(null)).toBe('—')
  })

  it('formats percentage cleanly', () => {
    expect(formatPercent(5.82)).toBe('5.8%')
    expect(formatPercent(null)).toBe('—')
  })

  it('formats interval match ratio and percentage', () => {
    expect(formatRatio(48, 48)).toBe('48 / 48 (100.0%)')
    expect(formatRatio(44, 48)).toBe('44 / 48 (91.7%)')
    expect(formatRatio(0, 0)).toBe('0 / 0 (0%)')
  })

  it('classifies forecast error direction consistently', () => {
    const over = getErrorDirection(250)
    expect(over.isOver).toBe(true)
    expect(over.isUnder).toBe(false)
    expect(over.label).toContain('Overforecast (+)')

    const under = getErrorDirection(-180)
    expect(under.isUnder).toBe(true)
    expect(under.isOver).toBe(false)
    expect(under.label).toContain('Underforecast (-)')

    const balanced = getErrorDirection(0)
    expect(balanced.isOver).toBe(false)
    expect(balanced.isUnder).toBe(false)
    expect(balanced.label).toContain('Balanced')

    const nullDir = getErrorDirection(null)
    expect(nullDir.label).toBe('No Data')
  })
})
