/**
 * Date and Timezone Utilities for Gridbricks
 * Formats timestamps in Europe/London timezone strictly using Intl.DateTimeFormat
 */

const LONDON_TZ = 'Europe/London'

const timeFormatter = new Intl.DateTimeFormat('en-GB', {
  timeZone: LONDON_TZ,
  hour: '2-digit',
  minute: '2-digit',
  hour12: false,
})

const dateTimeFormatter = new Intl.DateTimeFormat('en-GB', {
  timeZone: LONDON_TZ,
  day: '2-digit',
  month: 'short',
  year: 'numeric',
  hour: '2-digit',
  minute: '2-digit',
  hour12: false,
})

const dateFormatter = new Intl.DateTimeFormat('en-GB', {
  timeZone: LONDON_TZ,
  day: '2-digit',
  month: 'short',
  year: 'numeric',
})

const monthYearFormatter = new Intl.DateTimeFormat('en-GB', {
  timeZone: LONDON_TZ,
  month: 'long',
  year: 'numeric',
})

/**
 * Safely parse a date or ISO string to a Date object.
 */
export function toDate(val: string | Date | null | undefined): Date | null {
  if (!val) return null
  if (val instanceof Date) return isNaN(val.getTime()) ? null : val
  const d = new Date(val)
  return isNaN(d.getTime()) ? null : d
}

/**
 * Format timestamp into UK local time "HH:mm" (e.g. "14:30")
 */
export function formatUKTime(val: string | Date | null | undefined): string {
  const d = toDate(val)
  if (!d) return '—'
  return timeFormatter.format(d)
}

/**
 * Format timestamp into UK local date and time "02 Jan 2026, 14:30"
 */
export function formatUKDateTime(val: string | Date | null | undefined): string {
  const d = toDate(val)
  if (!d) return '—'
  return dateTimeFormatter.format(d)
}

/**
 * Format date into "02 Jan 2026"
 */
export function formatUKDate(val: string | Date | null | undefined): string {
  const d = toDate(val)
  if (!d) return '—'
  return dateFormatter.format(d)
}

/**
 * Format month string "2026-01" to "January 2026"
 */
export function formatMonthYear(monthStr: string): string {
  if (!monthStr || !monthStr.includes('-')) return monthStr
  const [year, month] = monthStr.split('-').map(Number)
  const d = new Date(Date.UTC(year, month - 1, 1))
  return monthYearFormatter.format(d)
}

/**
 * Format an ISO string or Date to UTC "HH:mm UTC"
 */
export function formatUTCTime(val: string | Date | null | undefined): string {
  const d = toDate(val)
  if (!d) return '—'
  const hours = String(d.getUTCHours()).padStart(2, '0')
  const mins = String(d.getUTCMinutes()).padStart(2, '0')
  return `${hours}:${mins} UTC`
}
