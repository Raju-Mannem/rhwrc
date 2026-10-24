import { useQuery } from '@tanstack/react-query'
import {
  fetchOverview,
  fetchDecisionDay,
  fetchForecastEvolution,
  fetchDataHealth,
  fetchIngestionRuns,
  queryKeys,
} from '@/services/endpoints'

const HISTORICAL_STALE_TIME = 5 * 60 * 1000 // 5 minutes

export function useOverviewQuery(decisionMonth: string) {
  return useQuery({
    queryKey: queryKeys.overview(decisionMonth),
    queryFn: () => fetchOverview(decisionMonth),
    staleTime: HISTORICAL_STALE_TIME,
  })
}

export function useDecisionDayQuery(decisionDate: string) {
  return useQuery({
    queryKey: queryKeys.decisionDay(decisionDate),
    queryFn: () => fetchDecisionDay(decisionDate),
    staleTime: HISTORICAL_STALE_TIME,
    enabled: Boolean(decisionDate),
  })
}

export function useForecastEvolutionQuery(startTimeUtc: string) {
  return useQuery({
    queryKey: queryKeys.evolution(startTimeUtc),
    queryFn: () => fetchForecastEvolution(startTimeUtc),
    staleTime: HISTORICAL_STALE_TIME,
    enabled: Boolean(startTimeUtc),
  })
}

export function useDataHealthQuery() {
  return useQuery({
    queryKey: queryKeys.dataHealth,
    queryFn: () => fetchDataHealth(),
    staleTime: 60 * 1000, // 1 minute for operational health
  })
}

export function useIngestionRunsQuery(page = 1, pageSize = 20, dataset?: string, status?: string) {
  return useQuery({
    queryKey: queryKeys.ingestionRuns(page, pageSize, dataset, status),
    queryFn: () => fetchIngestionRuns(page, pageSize, dataset, status),
    staleTime: 60 * 1000,
  })
}
