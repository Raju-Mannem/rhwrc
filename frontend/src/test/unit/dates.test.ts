import { describe, it, expect } from 'vitest'
import {
  formatUKTime,
  formatUKDateTime,
  formatUKDate,
  formatMonthYear,
  formatUTCTime,
} from '@/lib/dates'

describe('UK Timezone and Date Formatter', () => {
  it('formats timestamp in Europe/London time (HH:mm)', () => {
    // 14:30 UTC during winter GMT is 14:30 Europe/London
    expect(formatUKTime('2026-01-02T14:30:00Z')).toBe('14:30')
    expect(formatUKTime(null)).toBe('—')
  })

  it('formats timestamp in UK date and time', () => {
    const formatted = formatUKDateTime('2026-01-02T10:00:00Z')
    expect(formatted).toContain('02 Jan 2026')
    expect(formatted).toContain('10:00')
    expect(formatUKDateTime(null)).toBe('—')
  })

  it('formats date into standard UK date', () => {
    expect(formatUKDate('2026-01-15T00:00:00Z')).toBe('15 Jan 2026')
    expect(formatUKDate(null)).toBe('—')
  })

  it('formats month string into Month Year', () => {
    expect(formatMonthYear('2026-01')).toBe('January 2026')
  })

  it('formats UTC time explicitly', () => {
    expect(formatUTCTime('2026-01-02T09:45:00Z')).toBe('09:45 UTC')
    expect(formatUTCTime(null)).toBe('—')
  })
})
