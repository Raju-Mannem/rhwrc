export interface ChartDimensions {
  width: number
  height: number
  margin: {
    top: number
    right: number
    bottom: number
    left: number
  }
  innerWidth: number
  innerHeight: number
}

export interface TimeSeriesPoint {
  timestamp: Date
  timestampIso: string
  forecastMW: number | null
  actualMW: number | null
  signedErrorMW: number | null
  absoluteErrorMW: number | null
  matchStatus: string
  isEligible?: boolean
}

export interface HeatmapCell {
  dateStr: string // YYYY-MM-DD
  intervalIdx: number // 0 to 47
  timeLabel: string // HH:mm
  timestampIso: string
  signedErrorMW: number | null
  absoluteErrorMW: number | null
  forecastMW: number | null
  actualMW: number | null
  matchStatus: string
}
