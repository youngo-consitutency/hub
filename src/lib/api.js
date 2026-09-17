import { useEffect, useState } from 'react'
import { clearSession } from './session.js'

// The browser sends the HttpOnly session cookie; no token is stored in JS.
async function request(path, { method = 'GET', ...options } = {}) {
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
    const error = new Error(
      data?.error?.message || `Request failed (${res.status})`,
    )
    error.status = res.status
    error.code = data?.error?.code
    error.fields = data?.error?.fields
    throw error
  }
  return data
}

export function apiGet(path) {
  return request(path)
}

export function apiPost(path, body, extraHeaders = {}) {
  return request(path, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...extraHeaders },
    body: JSON.stringify(body ?? {}),
  })
}

export function apiPatch(path, body) {
  return request(path, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body ?? {}),
  })
}

export function apiPut(path, body) {
  return request(path, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body ?? {}),
  })
}

export function apiPutFile(path, file) {
  return request(path, {
    method: 'PUT',
    body: file,
    headers: { 'Content-Type': file.type },
  })
}

export function apiPostFile(path, file, headers = {}) {
  return request(path, {
    method: 'POST',
    body: file,
    headers: { 'Content-Type': file.type, ...headers },
  })
}

export function apiDelete(path) {
  return request(path, { method: 'DELETE' })
}

// Fetch state for independently rendered sections, including retry support.
export function useApi(path, deps = []) {
  const [state, setState] = useState({ data: null, error: null, loading: true })
  const [nonce, setNonce] = useState(0)
  useEffect(() => {
    let alive = true
    setState((s) => ({ ...s, loading: true, error: null }))
    apiGet(path)
      .then((data) => alive && setState({ data, error: null, loading: false }))
      .catch(
        (error) =>
          alive &&
          setState({ data: null, error: error.message, loading: false }),
      )
    return () => {
      alive = false
    }
  }, [path, nonce, ...deps])
  return { ...state, retry: () => setNonce((n) => n + 1) }
}
