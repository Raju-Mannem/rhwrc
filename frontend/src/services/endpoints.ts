import { fetchJson, API_BASE_URL } from './api-client'
import {
  FIXTURE_OVERVIEW_JAN_2026,
  getFixtureDecisionDay,
  FIXTURE_EVOLUTION,
  FIXTURE_DATA_HEALTH,
  FIXTURE_INGESTION_RUNS,
} from './fixtures'
import type {
  OverviewResponse,
  DecisionDayResponse,
  ForecastEvolutionResponse,
  DataHealthResponse,
  IngestionRunListResponse,
} from '@/types/api'

export const queryKeys = {
  overview: (month: string) => ['overview', month] as const,
  decisionDay: (date: string) => ['decisionDay', date] as const,
  evolution: (startTimeUtc: string) => ['forecastEvolution', startTimeUtc] as const,
  dataHealth: ['dataHealth'] as const,
  ingestionRuns: (page: number, pageSize: number, dataset?: string, status?: string) =>
    ['ingestionRuns', page, pageSize, dataset, status] as const,
}

export async function fetchOverview(decisionMonth = '2026-01'): Promise<OverviewResponse> {
  return fetchJson<OverviewResponse>(`/api/v1/overview?decision_month=${encodeURIComponent(decisionMonth)}`, {
    fixtureFallback: () => FIXTURE_OVERVIEW_JAN_2026,
  })
}

export async function fetchDecisionDay(decisionDate: string): Promise<DecisionDayResponse> {
  return fetchJson<DecisionDayResponse>(`/api/v1/decisions/${encodeURIComponent(decisionDate)}`, {
    fixtureFallback: () => getFixtureDecisionDay(decisionDate),
  })
}

export async function fetchForecastEvolution(startTimeUtc: string): Promise<ForecastEvolutionResponse> {
  return fetchJson<ForecastEvolutionResponse>(
    `/api/v1/forecast-evolution?start_time_utc=${encodeURIComponent(startTimeUtc)}`,
    {
      fixtureFallback: () => FIXTURE_EVOLUTION,
    }
  )
}

export async function fetchDataHealth(): Promise<DataHealthResponse> {
  return fetchJson<DataHealthResponse>('/api/v1/data-health', {
    fixtureFallback: () => FIXTURE_DATA_HEALTH,
  })
}

export async function fetchIngestionRuns(
  page = 1,
  pageSize = 20,
  dataset?: string,
  status?: string
): Promise<IngestionRunListResponse> {
  const params = new URLSearchParams({
    page: String(page),
    page_size: String(pageSize),
  })
  if (dataset) params.append('dataset', dataset)
  if (status) params.append('status', status)

  return fetchJson<IngestionRunListResponse>(`/api/v1/ingestion/runs?${params.toString()}`, {
    fixtureFallback: () => FIXTURE_INGESTION_RUNS,
  })
}

export async function downloadIntervalsCsv(decisionDate: string): Promise<void> {
  const url = `${API_BASE_URL}/api/v1/exports/intervals.csv?decision_date=${encodeURIComponent(decisionDate)}`
  try {
    const res = await fetch(url)
    if (!res.ok) {
      throw new Error(`Export failed with HTTP status ${res.status}`)
    }
    const blob = await res.blob()
    const downloadUrl = window.URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = downloadUrl
    a.download = `gridbricks_intervals_${decisionDate}.csv`
    document.body.appendChild(a)
    a.click()
    a.remove()
    window.URL.revokeObjectURL(downloadUrl)
  } catch (err) {
    console.error('Failed to download CSV from backend', err)
    throw err
  }
}
