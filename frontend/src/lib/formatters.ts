/**
 * Energy Domain Formatters
 * Formats power (MW), energy (MWh), errors, and accuracy metrics.
 */

export { formatUKTime, formatUKDateTime, formatUKDate, formatMonthYear, formatUTCTime } from './dates'

export function formatMW(value: number | null | undefined, decimals = 0): string {
  if (value === null || value === undefined || isNaN(value)) {
    return '—'
  }
  return `${new Intl.NumberFormat('en-GB', {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  }).format(value)} MW`
}

export function formatMWh(value: number | null | undefined, decimals = 1): string {
  if (value === null || value === undefined || isNaN(value)) {
    return '—'
  }
  return `${new Intl.NumberFormat('en-GB', {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  }).format(value)} MWh`
}

/**
 * Explicit signed error format:
 * positive -> +X MW (Overforecast)
 * negative -> -X MW (Underforecast)
 */
export function formatSignedMW(value: number | null | undefined, decimals = 0): string {
  if (value === null || value === undefined || isNaN(value)) {
    return '—'
  }
  if (Math.abs(value) < 1e-6) {
    return '0 MW'
  }
  const formatted = new Intl.NumberFormat('en-GB', {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
    signDisplay: 'always',
  }).format(value)
  return `${formatted} MW`
}

export function formatPercent(value: number | null | undefined, decimals = 1): string {
  if (value === null || value === undefined || isNaN(value)) {
    return '—'
  }
  return `${new Intl.NumberFormat('en-GB', {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  }).format(value)}%`
}

export function formatRatio(matched: number, expected: number): string {
  if (expected === 0) return '0 / 0 (0%)'
  const pct = ((matched / expected) * 100).toFixed(1)
  return `${matched} / ${expected} (${pct}%)`
}

export function getErrorDirection(errorMW: number | null | undefined): {
  label: string
  colorClass: string
  isOver: boolean
  isUnder: boolean
} {
  if (errorMW === null || errorMW === undefined || isNaN(errorMW)) {
    return { label: 'No Data', colorClass: 'text-zinc-400', isOver: false, isUnder: false }
  }
  if (Math.abs(errorMW) < 0.1) {
    return { label: 'Balanced (0 MW)', colorClass: 'text-zinc-500', isOver: false, isUnder: false }
  }
  if (errorMW > 0) {
    return { label: 'Overforecast (+)', colorClass: 'text-amber-600 dark:text-amber-400', isOver: true, isUnder: false }
  }
  return { label: 'Underforecast (-)', colorClass: 'text-indigo-600 dark:text-indigo-400', isOver: false, isUnder: true }
}
