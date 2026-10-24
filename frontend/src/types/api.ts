/**
 * API Contract Types for Gridbricks Backend
 * Derived directly from FastAPI / OpenAPI backend models
 */

export interface MetricsSummary {
  mae_mw: number | null
  rmse_mw: number | null
  bias_mw: number | null
  wape_percent: number | null
  p90_abs_error_mw: number | null
  total_energy_error_mwh: number | null
  matched_intervals: number
  expected_intervals: number
  missing_intervals: number
  coverage_ratio: number
  selection_policy: string
  population_notes: string
}

export interface DecisionConfigSummary {
  decision_date_mode: string
  decision_timezone: string
  decision_cutoff_local_time: string
  decision_lead_days: number
  decision_cutoff_inclusive: boolean
  selection_policy: string
  fallback_policy: string
  completeness_threshold: number
  interval_alignment: string
}

export interface IngestionStatusSummary {
  last_successful_actual_utc: string | null
  last_successful_forecast_utc: string | null
}

export interface DailyAccuracyItem {
  decision_date: string // YYYY-MM-DD
  delivery_date: string // YYYY-MM-DD
  decision_cutoff_utc: string
  completeness_status: 'COMPLETE' | 'MIXED_OR_PARTIAL' | 'INCOMPLETE' | string
  metrics: MetricsSummary
}

export interface OverviewResponse {
  decision_month: string
  decision_window_from: string
  decision_window_to: string
  delivery_window_from: string
  delivery_window_to: string
  configuration: DecisionConfigSummary
  monthly_metrics: MetricsSummary
  daily_summaries: DailyAccuracyItem[]
  ingestion_status: IngestionStatusSummary
  data_quality_warnings: string[]
  llm_narrative_summary: string | null
}

export interface IntervalObservationItem {
  start_time_utc: string
  forecast_mw: number | null
  actual_mw: number | null
  signed_error_mw: number | null
  absolute_error_mw: number | null
  error_mwh: number | null
  forecast_publish_time_utc: string | null
  match_status: 'MATCHED' | 'MISSING_FORECAST' | 'MISSING_ACTUAL' | 'EXCLUDED' | string
}

export interface DecisionDayResponse {
  decision_date: string
  delivery_date: string
  decision_cutoff_utc: string
  decision_cutoff_local: string
  decision_timezone: string
  selection_policy: string
  selected_publication_time_utc: string | null
  completeness_status: string
  metrics: MetricsSummary
  intervals: IntervalObservationItem[]
  llm_narrative_summary: string | null
}

export interface ForecastEvolutionItem {
  publish_time_utc: string
  generation_mw: number
  is_eligible_at_cutoff: boolean
  is_selected_in_snapshot: boolean
  error_vs_actual_mw: number | null
}

export interface ForecastEvolutionResponse {
  start_time_utc: string
  actual_generation_mw: number | null
  decision_cutoff_utc: string | null
  revisions: ForecastEvolutionItem[]
  total_revisions: number
}

export interface RecentRunSummary {
  id: string
  dataset: string
  status: 'SUCCESS' | 'PARTIAL' | 'FAILED' | string
  started_at: string
  completed_at: string | null
  fetched_count: number
  inserted_count: number
  rejected_count: number
  error_summary: string | null
}

export interface DataQualityIssueItem {
  id: string
  dataset: string
  issue_type: string
  severity: 'INFO' | 'WARNING' | 'CRITICAL' | string
  description: string
  record_identifier: string | null
  detected_at: string
}

export interface DataHealthResponse {
  status: 'HEALTHY' | 'DEGRADED' | 'CRITICAL' | string
  timestamp_utc: string
  ingestion_freshness: IngestionStatusSummary
  total_issues_count: number
  recent_failed_or_partial_runs: RecentRunSummary[]
  recent_issues: DataQualityIssueItem[]
  completeness_metrics: Record<string, number>
}

export interface IngestionRunItem {
  id: string
  dataset: string
  status: string
  requested_from: string
  requested_to: string
  started_at: string
  completed_at: string | null
  fetched_count: number
  inserted_count: number
  updated_count: number
  duplicate_count: number
  rejected_count: number
  error_summary: string | null
  metadata_json: Record<string, unknown> | null
}

export interface IngestionRunListResponse {
  items: IngestionRunItem[]
  pagination: {
    total: number
    page: number
    page_size: number
    pages: number
  }
}
