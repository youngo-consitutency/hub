/**
 * Shared helpers for the API contract specs: a BASE-scoped JSON fetch and a
 * `session()` that provisions an account and signs it in. Specs compose the
 * permissions they need; no identities or credentials are hardcoded.
 */
import { expect } from 'vitest'

import { provisionAccount, type TestSpec } from './provision'

export const BASE = process.env.TEST_BASE_URL || 'http://localhost:3000'

async function login(email: string, password: string) {
  const res = await fetch(`${BASE}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password }),
  })
  expect(res.status).toBe(200)
  const setCookie = res.headers.get('set-cookie') || ''
  const token = setCookie.match(/payload-token=([^;]+)/)?.[1]
  return { cookie: `payload-token=${token}`, json: await res.json() }
}

export async function session(spec: TestSpec) {
  const { account, email, password } = await provisionAccount(spec)
  return { ...(await login(email, password)), account }
}

export const api = (path: string, { cookie, ...init }: { cookie?: string } & RequestInit = {}) => {
  const headers = new Headers(init.headers)
  if (!headers.has('Content-Type')) headers.set('Content-Type', 'application/json')
  if (!headers.has('Origin')) headers.set('Origin', BASE)
  if (cookie && !headers.has('Cookie')) headers.set('Cookie', cookie)
  return fetch(`${BASE}/api${path}`, { ...init, headers })
}
