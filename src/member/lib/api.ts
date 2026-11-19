import type { Doc } from './types'
import useSWR from 'swr'
import { clearSession } from './session'

/** A failed API call: the HTTP status plus the server's error code and per-field messages. */
export class ApiRequestError extends Error {
  constructor(
    message: string,
    readonly status: number,
    readonly code?: string,
    readonly fields?: Record<string, string>,
  ) {
    super(message)
    this.name = 'ApiRequestError'
  }
}

/** The text to show for anything thrown by a request, without casting `unknown`. */
export function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : 'Something went wrong. Please try again.'
}

/** Per-field validation messages from a rejected request, or an empty object. */
export const fieldErrors = (error: unknown): Record<string, string> =>
  (error instanceof ApiRequestError && error.fields) || {}

export const hasFieldErrors = (error: unknown): boolean =>
  error instanceof ApiRequestError && Boolean(error.fields)

export const errorCode = (error: unknown): string | undefined =>
  error instanceof ApiRequestError ? error.code : undefined

export const errorStatus = (error: unknown): number | undefined =>
  error instanceof ApiRequestError ? error.status : undefined

// The browser sends the HttpOnly session cookie; no token is stored in JS.
async function request<T>(
  path: string,
  { method = 'GET', ...options }: RequestInit = {},
): Promise<T> {
  const res = await fetch(`/api${path}`, {
    ...options,
    method,
    credentials: 'same-origin',
  })
  const data = await res.json().catch((error) => {
    // Reads require JSON. Mutations may return an empty success response.
    if (res.ok && method === 'GET') throw error
    return {}
  })
  if (!res.ok) {
    if (res.status === 401 && method === 'GET' && path === '/auth/me') {
      clearSession()
    }
    throw new ApiRequestError(
      data?.error?.message || `Request failed (${res.status})`,
      res.status,
      data?.error?.code,
      data?.error?.fields,
    )
  }
  return data as T
}

// the response type is the caller's claim about the endpoint: declare it where the shape is known
export function apiGet<T = Doc>(path: string) {
  return request<T>(path)
}

export function apiPost<T = Doc>(
  path: string,
  body?: unknown,
  extraHeaders: Record<string, string> = {},
) {
  return request<T>(path, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...extraHeaders },
    body: JSON.stringify(body ?? {}),
  })
}

export function apiPatch<T = Doc>(path: string, body?: unknown) {
  return request<T>(path, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body ?? {}),
  })
}

export function apiPut<T = Doc>(path: string, body?: unknown) {
  return request<T>(path, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body ?? {}),
  })
}

export function apiPostFile<T = Doc>(
  path: string,
  file: File | Blob,
  headers: Record<string, string> = {},
) {
  return request<T>(path, {
    method: 'POST',
    body: file,
    headers: { 'Content-Type': file.type, ...headers },
  })
}

export function apiDelete<T = Doc>(path: string) {
  return request<T>(path, { method: 'DELETE' })
}

// Fetch state for independently rendered sections, backed by SWR (request dedup, revalidation,
// retry). The path is the cache key. Record screens must not show the previous record under a new
// URL, so keepPrevious is opt-in: lists, filters and search keep their rows while the next page loads.
export interface ApiQuery<T> {
  data: T | null
  error: string | null
  loading: boolean
  retry: () => void
}

export function useApi<T = Doc>(path: string | null, { keepPrevious = false } = {}): ApiQuery<T> {
  const { data, error, isLoading, mutate } = useSWR<T, ApiRequestError>(path, apiGet, {
    keepPreviousData: keepPrevious,
    // a 401/403/404 will not change on retry
    onErrorRetry: (err, _key, config, revalidate, { retryCount }) => {
      if (err?.status >= 400 && err?.status < 500) return
      if (retryCount >= (config.errorRetryCount ?? 3)) return
      setTimeout(() => revalidate({ retryCount }), config.errorRetryInterval)
    },
  })
  return {
    data: data ?? null,
    error: error ? error.message : null,
    loading: isLoading,
    retry: () => mutate(),
  }
}
