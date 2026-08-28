import { useEffect, useState } from 'react'
import { clearSession } from './session.js'

// Requests carry no Authorization header: the session travels in the HttpOnly
// `youngo_session` cookie, which `credentials: 'same-origin'` attaches. Keeping
// the credential out of JavaScript is what makes an XSS bug non-fatal.
function authHeaders(extra = {}) {
  return { ...extra }
}

export async function apiGet(path) {
  const res = await fetch(`/api${path}`, {
    headers: authHeaders(),
    credentials: 'same-origin',
  })
  if (!res.ok) {
    const body = await res.json().catch(() => ({}))
    // Clear local state only when the session endpoint rejects the token.
    if (res.status === 401 && path === '/auth/me') clearSession()
    const err = new Error(
      body?.error?.message || `Request failed (${res.status})`,
    )
    err.status = res.status
    err.code = body?.error?.code
    err.fields = body?.error?.fields
    throw err
  }
  return res.json()
}

export async function apiPost(path, body, extraHeaders = {}) {
  const res = await fetch(`/api${path}`, {
    method: 'POST',
    credentials: 'same-origin',
    headers: authHeaders({
      'Content-Type': 'application/json',
      ...extraHeaders,
    }),
    body: JSON.stringify(body ?? {}),
  })
  const data = await res.json().catch(() => ({}))
  if (!res.ok) {
    const err = new Error(
      data?.error?.message || `Request failed (${res.status})`,
    )
    err.status = res.status
    err.code = data?.error?.code
    err.fields = data?.error?.fields
    throw err
  }
  return data
}

export async function apiPatch(path, body) {
  const res = await fetch(`/api${path}`, {
    method: 'PATCH',
    credentials: 'same-origin',
    headers: authHeaders({ 'Content-Type': 'application/json' }),
    body: JSON.stringify(body ?? {}),
  })
  const data = await res.json().catch(() => ({}))
  if (!res.ok) {
    const err = new Error(
      data?.error?.message || `Request failed (${res.status})`,
    )
    err.status = res.status
    err.code = data?.error?.code
    err.fields = data?.error?.fields
    throw err
  }
  return data
}

async function apiMutation(path, { method, body, headers = {} }) {
  const res = await fetch(`/api${path}`, {
    method,
    credentials: 'same-origin',
    headers: authHeaders(headers),
    body,
  })
  const data = await res.json().catch(() => ({}))
  if (!res.ok) {
    const err = new Error(
      data?.error?.message || `Request failed (${res.status})`,
    )
    err.status = res.status
    err.code = data?.error?.code
    err.fields = data?.error?.fields
    throw err
  }
  return data
}

export function apiPutFile(path, file) {
  return apiMutation(path, {
    method: 'PUT',
    body: file,
    headers: { 'Content-Type': file.type },
  })
}

export function apiDelete(path) {
  return apiMutation(path, { method: 'DELETE' })
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
