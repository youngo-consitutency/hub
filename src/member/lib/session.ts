import type { AnyValue } from './types'
import { apiPost } from './api'

// The session credential lives ONLY in the HttpOnly `youngo_session` cookie —
// unreadable from JS so XSS cannot exfiltrate it. Nothing here stores a token.
// What is cached is the account *profile* only, so first paint doesn't flash a
// signed-out shell while `/auth/me` is in flight.
const ACCOUNT_KEY = 'youngo-hub:session-account'

// Earlier builds stored the token in localStorage; remove leftover copies
// so upgrading clients stop carrying a stealable credential.
const LEGACY_TOKEN_KEY = 'youngo-hub:session-token'
try {
  localStorage.removeItem(LEGACY_TOKEN_KEY)
} catch {
  // Storage may be unavailable in privacy-restricted contexts.
}

export function getCachedAccount() {
  try {
    const raw = localStorage.getItem(ACCOUNT_KEY)
    return raw ? JSON.parse(raw) : null
  } catch {
    return null
  }
}

export function setSession({ account }: AnyValue = {}) {
  try {
    if (account) localStorage.setItem(ACCOUNT_KEY, JSON.stringify(account))
    else localStorage.removeItem(ACCOUNT_KEY)
  } catch {
    // Storage may be unavailable in privacy-restricted contexts.
  }
}

export function clearSession() {
  try {
    localStorage.removeItem(ACCOUNT_KEY)
    localStorage.removeItem(LEGACY_TOKEN_KEY)
  } catch {
    // Storage may be unavailable in privacy-restricted contexts.
  }
}

/**
 * Whether a previous session is likely still active. This is a rendering hint
 * only — it reflects cached profile data, never proof of authentication. The
 * server decides, via the cookie, on the next `/auth/me` call.
 */
export function hasCachedSession() {
  return Boolean(getCachedAccount())
}

export async function signOut() {
  try {
    await apiPost('/auth/logout', {})
  } catch {
    // A failed network request must not trap someone in the local session UI.
  }
  clearSession()
  window.location.reload()
}
