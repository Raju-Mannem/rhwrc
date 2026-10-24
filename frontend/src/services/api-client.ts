import { useUIStore } from '@/stores/ui-store'

export const API_BASE_URL =
  import.meta.env.VITE_API_BASE_URL ||
  (typeof window !== 'undefined' && window.location.origin.includes(':5173')
    ? 'http://localhost:8000'
    : '')

export class ApiError extends Error {
  status: number
  title?: string
  detail?: string
  type?: string
  instance?: string
  invalidParams?: Record<string, unknown>

  constructor(status: number, message: string, data?: Record<string, unknown>) {
    super(message)
    this.name = 'ApiError'
    this.status = status
    if (data) {
      this.title = data.title as string | undefined
      this.detail = data.detail as string | undefined
      this.type = data.type as string | undefined
      this.instance = data.instance as string | undefined
      this.invalidParams = data.invalid_params as Record<string, unknown> | undefined
    }
  }
}

export async function fetchJson<T>(
  path: string,
  options?: RequestInit & { timeoutMs?: number; fixtureFallback?: () => T }
): Promise<T> {
  const { timeoutMs = 15000, fixtureFallback, ...fetchOptions } = options || {}
  const isDemo = useUIStore.getState().isDemoMode

  // If user explicitly enabled Demo Mode, directly return fixture
  if (isDemo && fixtureFallback) {
    return fixtureFallback()
  }

  const controller = new AbortController()
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs)

  const url = path.startsWith('http') ? path : `${API_BASE_URL}${path}`

  try {
    const response = await fetch(url, {
      ...fetchOptions,
      signal: fetchOptions.signal || controller.signal,
      headers: {
        Accept: 'application/json',
        ...fetchOptions.headers,
      },
    })

    clearTimeout(timeoutId)

    if (!response.ok) {
      let errorData: Record<string, unknown> = {}
      try {
        errorData = await response.json()
      } catch {
        // response body is not json
      }
      throw new ApiError(
        response.status,
        (errorData.detail as string) || (errorData.title as string) || `HTTP error ${response.status}: ${response.statusText}`,
        errorData
      )
    }

    return (await response.json()) as T
  } catch (err: unknown) {
    clearTimeout(timeoutId)

    // If backend is unreachable or connection refused, and fixtureFallback is available,
    // trigger demo mode notification and fallback gracefully so the app stays functional.
    const isNetworkError =
      err instanceof TypeError && (err.message.includes('fetch') || err.message.includes('NetworkError') || err.message.includes('Failed to fetch'))
    const isAbort = err instanceof DOMException && err.name === 'AbortError'

    if ((isNetworkError || isAbort) && fixtureFallback) {
      console.warn(`[Gridbricks API] Backend unreachable at ${url}. Operating with deterministic test fixtures.`);
      useUIStore.getState().setDemoMode(true)
      return fixtureFallback()
    }

    throw err
  }
}
