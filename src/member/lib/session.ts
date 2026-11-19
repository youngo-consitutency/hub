import type { Account } from './types'
import { apiPost } from './api'

// The session credential lives only in the HttpOnly cookie (XSS cannot read it).
// Only the account profile is cached, to avoid a signed-out flash while /auth/me loads.
const ACCOUNT_KEY = 'youngo-hub:session-account'

// Earlier builds stored the token in localStorage; remove leftover copies
// so upgrading clients stop carrying a stealable credential.
const LEGACY_TOKEN_KEY = 'youngo-hub:session-token'
try {
  localStorage.removeItem(LEGACY_TOKEN_KEY)
} catch {
  // Storage may be unavailable in privacy-restricted contexts.
}

export function getCachedAccount(): Account | null {
  try {
    const raw = localStorage.getItem(ACCOUNT_KEY)
    return raw ? (JSON.parse(raw) as Account) : null
  } catch {
    return null
  }
}

export function setSession({ account }: { account?: Account | null } = {}) {
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

export async function signOut() {
  try {
    await apiPost('/auth/logout', {})
  } catch {
    // A failed network request must not trap someone in the local session UI.
  }
  clearSession()
  window.location.reload()
}
