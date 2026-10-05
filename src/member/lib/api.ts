import type { AnyValue } from './types'
import useSWR from 'swr'
import { clearSession } from './session'

// The browser sends the HttpOnly session cookie; no token is stored in JS.
async function request(path: AnyValue, { method = 'GET', ...options }: AnyValue = {}) {
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
    const thrown: AnyValue = new Error(data?.error?.message || `Request failed (${res.status})`)
    thrown.status = res.status
    thrown.code = data?.error?.code
    thrown.fields = data?.error?.fields
    throw thrown
  }
  return data
}

export function apiGet(path: AnyValue) {
  return request(path)
}

export function apiPost(path: AnyValue, body?: AnyValue, extraHeaders = {}) {
  return request(path, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...extraHeaders },
    body: JSON.stringify(body ?? {}),
  })
}

export function apiPatch(path: AnyValue, body?: AnyValue) {
  return request(path, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body ?? {}),
  })
}

export function apiPut(path: AnyValue, body?: AnyValue) {
  return request(path, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body ?? {}),
  })
}

export function apiPutFile(path: AnyValue, file: AnyValue) {
  return request(path, {
    method: 'PUT',
    body: file,
    headers: { 'Content-Type': file.type },
  })
}

export function apiPostFile(path: AnyValue, file: AnyValue, headers = {}) {
  return request(path, {
    method: 'POST',
    body: file,
    headers: { 'Content-Type': file.type, ...headers },
  })
}

export function apiDelete(path: AnyValue) {
  return request(path, { method: 'DELETE' })
}

// Fetch state for independently rendered sections, backed by SWR (request
// dedup, revalidation, retry). Keyed by [path, ...deps] so dep changes refetch.
export function useApi(path: AnyValue, deps: AnyValue[] = []) {
  // keepPreviousData: when the key changes (filter, search, pagination) the
  // previous result stays rendered instead of flashing skeletons.
  const { data, error, isLoading, mutate } = useSWR(
    path ? [path, ...deps] : null,
    ([p]) => apiGet(p),
    { keepPreviousData: true },
  )
  return {
    data: data ?? null,
    error: error ? error.message : null,
    loading: isLoading,
    retry: () => mutate(),
  }
}
