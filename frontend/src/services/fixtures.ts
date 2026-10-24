import type {
  OverviewResponse,
  DecisionDayResponse,
  ForecastEvolutionResponse,
  DataHealthResponse,
  IngestionRunListResponse,
  IntervalObservationItem,
  DailyAccuracyItem,
} from '@/types/api'

/**
 * Deterministic Test Fixtures for UI Development and Offline Testing
 * Explicitly separated from production services.
 * Activated ONLY when isDemoMode is enabled or API is offline.
 */

// Generate 48 half-hour intervals for a delivery day
function generateDayIntervals(
  deliveryDateStr: string,
  cutoffUtcStr: string,
  scenario: 'COMPLETE' | 'MISSING_DATA' | 'LARGE_ERROR' = 'COMPLETE'
): IntervalObservationItem[] {
  const intervals: IntervalObservationItem[] = []
  const baseActuals = [
    5200, 5100, 4900, 4800, 4750, 4900, 5300, 5800,
    6400, 7100, 7800, 8300, 8600, 8900, 9100, 9050,
    8800, 8500, 8200, 8000, 7900, 8100, 8300, 8400,
    8600, 8750, 8900, 9100, 9250, 9400, 9500, 9600,
    9700, 9650, 9500, 9300, 9000, 8600, 8200, 7800,
    7400, 7000, 6600, 6200, 5900, 5600, 5400, 5300
  ]

  for (let i = 0; i < 48; i++) {
    const hour = Math.floor(i / 2)
    const minute = (i % 2) * 30
    const timeStr = `${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}:00`
    const intervalUtc = `${deliveryDateStr}T${timeStr}Z`

    let actual: number | null = baseActuals[i]
    let forecast: number | null = actual * (scenario === 'LARGE_ERROR' ? 1.25 : 1.05) - (i % 5) * 80

    let status = 'MATCHED'
    if (scenario === 'MISSING_DATA') {
      if (i >= 12 && i <= 14) {
        actual = null
        status = 'MISSING_ACTUAL'
      } else if (i === 28) {
        forecast = null
        status = 'MISSING_FORECAST'
      }
    }

    const signedError = (forecast !== null && actual !== null) ? Math.round(forecast - actual) : null
    const absError = signedError !== null ? Math.abs(signedError) : null
    const errorMwh = signedError !== null ? Math.round(signedError * 0.5 * 10) / 10 : null

    intervals.push({
      start_time_utc: intervalUtc,
      forecast_mw: forecast ? Math.round(forecast) : null,
      actual_mw: actual ? Math.round(actual) : null,
      signed_error_mw: signedError,
      absolute_error_mw: absError,
      error_mwh: errorMwh,
      forecast_publish_time_utc: cutoffUtcStr,
      match_status: status,
    })
  }

  return intervals
}

export const FIXTURE_OVERVIEW_JAN_2026: OverviewResponse = {
  decision_month: '2026-01',
  decision_window_from: '2026-01-01',
  decision_window_to: '2026-01-31',
  delivery_window_from: '2026-01-02',
  delivery_window_to: '2026-02-01',
  configuration: {
    decision_date_mode: 'DECISION_DATE',
    decision_timezone: 'Europe/London',
    decision_cutoff_local_time: '10:00',
    decision_lead_days: 1,
    decision_cutoff_inclusive: true,
    selection_policy: 'LATEST_STRICT',
    fallback_policy: 'NEAREST_PREVIOUS_12H',
    completeness_threshold: 0.95,
    interval_alignment: 'HH_START_00_30',
  },
  monthly_metrics: {
    mae_mw: 428.4,
    rmse_mw: 562.1,
    bias_mw: 142.6, // Positive = Overforecast
    wape_percent: 5.82,
    p90_abs_error_mw: 890.0,
    total_energy_error_mwh: 106094.4,
    matched_intervals: 1488,
    expected_intervals: 1488,
    missing_intervals: 0,
    coverage_ratio: 1.0,
    selection_policy: 'LATEST_STRICT',
    population_notes: 'Calculated strictly over valid matched intervals.',
  },
  daily_summaries: Array.from({ length: 31 }, (_, idx) => {
    const day = idx + 1
    const dayStr = String(day).padStart(2, '0')
    const decisionDate = `2026-01-${dayStr}`
    const deliveryDay = idx + 2
    const deliveryDayStr = deliveryDay > 31 ? `0${deliveryDay - 31}` : String(deliveryDay).padStart(2, '0')
    const deliveryMonth = deliveryDay > 31 ? '02' : '01'
    const deliveryDate = `2026-${deliveryMonth}-${deliveryDayStr}`

    const mae = 350 + (idx % 7) * 45 + (idx === 14 ? 400 : 0)
    const bias = (idx % 3 === 0 ? -1 : 1) * (100 + (idx % 5) * 40)

    const item: DailyAccuracyItem = {
      decision_date: decisionDate,
      delivery_date: deliveryDate,
      decision_cutoff_utc: `${decisionDate}T10:00:00Z`,
      completeness_status: idx === 4 ? 'MIXED_OR_PARTIAL' : 'COMPLETE',
      metrics: {
        mae_mw: Math.round(mae * 10) / 10,
        rmse_mw: Math.round(mae * 1.25 * 10) / 10,
        bias_mw: Math.round(bias * 10) / 10,
        wape_percent: Math.round((mae / 7500) * 1000) / 10,
        p90_abs_error_mw: Math.round(mae * 1.8),
        total_energy_error_mwh: Math.round(bias * 24),
        matched_intervals: idx === 4 ? 44 : 48,
        expected_intervals: 48,
        missing_intervals: idx === 4 ? 4 : 0,
        coverage_ratio: idx === 4 ? 44 / 48 : 1.0,
        selection_policy: 'LATEST_STRICT',
        population_notes: 'Calculated strictly over valid matched intervals.',
      },
    }
    return item
  }),
  ingestion_status: {
    last_successful_actual_utc: '2026-01-31T23:45:00Z',
    last_successful_forecast_utc: '2026-01-31T10:00:00Z',
  },
  data_quality_warnings: [
    '[WARNING] PARTIAL_SNAPSHOT: 2026-01-05 delivery had 4 missing intervals due to upstream BMRS telemetry gap.',
  ],
  llm_narrative_summary:
    'During January 2026, UK wind generation forecasts exhibited a net positive bias (+142.6 MW), indicating systematic overforecasting during North Sea frontal transitions. Mean Absolute Error stood at 428.4 MW (WAPE 5.82%), with the largest single-day deviation recorded on January 15.',
}

export function getFixtureDecisionDay(dateStr: string): DecisionDayResponse {
  const scenario = dateStr === '2026-01-05' ? 'MISSING_DATA' : dateStr === '2026-01-15' ? 'LARGE_ERROR' : 'COMPLETE'
  const cutoffUtc = `${dateStr}T10:00:00Z`
  const intervals = generateDayIntervals(dateStr, cutoffUtc, scenario)
  const matched = intervals.filter((i) => i.match_status === 'MATCHED')

  const mae = matched.length ? Math.round(matched.reduce((acc, i) => acc + (i.absolute_error_mw || 0), 0) / matched.length) : 0
  const bias = matched.length ? Math.round(matched.reduce((acc, i) => acc + (i.signed_error_mw || 0), 0) / matched.length) : 0

  return {
    decision_date: dateStr,
    delivery_date: dateStr, // In UK day-ahead, delivery is day+1
    decision_cutoff_utc: cutoffUtc,
    decision_cutoff_local: '10:00 Europe/London',
    decision_timezone: 'Europe/London',
    selection_policy: 'LATEST_STRICT',
    selected_publication_time_utc: `${dateStr}T09:45:00Z`,
    completeness_status: scenario === 'MISSING_DATA' ? 'MIXED_OR_PARTIAL' : 'COMPLETE',
    metrics: {
      mae_mw: mae,
      rmse_mw: Math.round(mae * 1.28),
      bias_mw: bias,
      wape_percent: Math.round((mae / 8000) * 1000) / 10,
      p90_abs_error_mw: Math.round(mae * 1.75),
      total_energy_error_mwh: Math.round(bias * 24),
      matched_intervals: matched.length,
      expected_intervals: 48,
      missing_intervals: 48 - matched.length,
      coverage_ratio: matched.length / 48,
      selection_policy: 'LATEST_STRICT',
      population_notes: 'Evaluated over 48 half-hour settlement periods.',
    },
    intervals,
    llm_narrative_summary:
      scenario === 'LARGE_ERROR'
        ? 'Decision Day 2026-01-15 saw substantial overforecasting (+580 MW average) between 14:00 and 18:00 UTC due to slower storm progression than indicated in the 09:45 publication.'
        : `Official day-ahead decision snapshot for ${dateStr}. Forecast tracked actual wind output with an MAE of ${mae} MW across ${matched.length} matched settlement periods.`,
  }
}

export const FIXTURE_EVOLUTION: ForecastEvolutionResponse = {
  start_time_utc: '2026-01-02T14:00:00Z',
  actual_generation_mw: 8900,
  decision_cutoff_utc: '2026-01-01T10:00:00Z',
  total_revisions: 6,
  revisions: [
    {
      publish_time_utc: '2025-12-31T18:00:00Z',
      generation_mw: 7800,
      is_eligible_at_cutoff: true,
      is_selected_in_snapshot: false,
      error_vs_actual_mw: -1100,
    },
    {
      publish_time_utc: '2026-01-01T06:00:00Z',
      generation_mw: 8250,
      is_eligible_at_cutoff: true,
      is_selected_in_snapshot: false,
      error_vs_actual_mw: -650,
    },
    {
      publish_time_utc: '2026-01-01T09:45:00Z',
      generation_mw: 9200,
      is_eligible_at_cutoff: true,
      is_selected_in_snapshot: true,
      error_vs_actual_mw: 300,
    },
    {
      publish_time_utc: '2026-01-01T16:00:00Z',
      generation_mw: 9050,
      is_eligible_at_cutoff: false,
      is_selected_in_snapshot: false,
      error_vs_actual_mw: 150,
    },
    {
      publish_time_utc: '2026-01-02T04:00:00Z',
      generation_mw: 8950,
      is_eligible_at_cutoff: false,
      is_selected_in_snapshot: false,
      error_vs_actual_mw: 50,
    },
    {
      publish_time_utc: '2026-01-02T11:00:00Z',
      generation_mw: 8910,
      is_eligible_at_cutoff: false,
      is_selected_in_snapshot: false,
      error_vs_actual_mw: 10,
    },
  ],
}

export const FIXTURE_DATA_HEALTH: DataHealthResponse = {
  status: 'HEALTHY',
  timestamp_utc: '2026-01-31T23:55:00Z',
  ingestion_freshness: {
    last_successful_actual_utc: '2026-01-31T23:30:00Z',
    last_successful_forecast_utc: '2026-01-31T10:00:00Z',
  },
  total_issues_count: 3,
  recent_failed_or_partial_runs: [
    {
      id: 'run-windfor-20260105-0900',
      dataset: 'WINDFOR',
      status: 'PARTIAL',
      started_at: '2026-01-05T09:00:00Z',
      completed_at: '2026-01-05T09:02:15Z',
      fetched_count: 48,
      inserted_count: 44,
      rejected_count: 4,
      error_summary: '4 settlement intervals rejected due to malformed XML stream in Elexon feed',
    },
  ],
  recent_issues: [
    {
      id: 'iss-01',
      dataset: 'FUELHH',
      issue_type: 'GAP_DETECTED',
      severity: 'WARNING',
      description: 'Interval 2026-01-05T06:00:00Z missing actual wind generation payload.',
      record_identifier: 'FUELHH-20260105-SP13',
      detected_at: '2026-01-05T06:45:00Z',
    },
    {
      id: 'iss-02',
      dataset: 'WINDFOR',
      issue_type: 'DUPLICATE_PAYLOAD',
      severity: 'INFO',
      description: 'Duplicate publication received for 2026-01-12 delivery window; idempotency key resolved safely.',
      record_identifier: 'WINDFOR-PUB-20260111-1000',
      detected_at: '2026-01-11T10:05:00Z',
    },
  ],
  completeness_metrics: {
    failed_or_partial_runs_count: 1,
    unresolved_critical_flags: 0,
    dataset_coverage_percent: 99.4,
  },
}

export const FIXTURE_INGESTION_RUNS: IngestionRunListResponse = {
  items: [
    {
      id: 'run-act-20260131-2330',
      dataset: 'FUELHH',
      status: 'SUCCESS',
      requested_from: '2026-01-31T00:00:00Z',
      requested_to: '2026-01-31T23:30:00Z',
      started_at: '2026-01-31T23:31:00Z',
      completed_at: '2026-01-31T23:31:18Z',
      fetched_count: 48,
      inserted_count: 48,
      updated_count: 0,
      duplicate_count: 0,
      rejected_count: 0,
      error_summary: null,
      metadata_json: { source: 'BMRS_STREAM', filter: 'WIND' },
    },
    {
      id: 'run-fc-20260131-1000',
      dataset: 'WINDFOR',
      status: 'SUCCESS',
      requested_from: '2026-02-01T00:00:00Z',
      requested_to: '2026-02-01T23:30:00Z',
      started_at: '2026-01-31T10:01:00Z',
      completed_at: '2026-01-31T10:02:05Z',
      fetched_count: 48,
      inserted_count: 48,
      updated_count: 0,
      duplicate_count: 0,
      rejected_count: 0,
      error_summary: null,
      metadata_json: { cutoff_enforced: '10:00 Europe/London' },
    },
    {
      id: 'run-fc-20260105-0900',
      dataset: 'WINDFOR',
      status: 'PARTIAL',
      requested_from: '2026-01-06T00:00:00Z',
      requested_to: '2026-01-06T23:30:00Z',
      started_at: '2026-01-05T09:00:00Z',
      completed_at: '2026-01-05T09:02:15Z',
      fetched_count: 48,
      inserted_count: 44,
      updated_count: 0,
      duplicate_count: 0,
      rejected_count: 4,
      error_summary: '4 settlement intervals rejected due to malformed XML stream',
      metadata_json: { partial_reason: 'STREAM_PARSE_ERROR' },
    },
  ],
  pagination: {
    total: 3,
    page: 1,
    page_size: 20,
    pages: 1,
  },
}
