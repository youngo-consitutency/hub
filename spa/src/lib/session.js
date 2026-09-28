import { apiPost } from './api.js'

// The session credential lives ONLY in the HttpOnly `youngo_session` cookie the
// server sets at login. It is deliberately unreadable from JavaScript, so a
// cross-site-scripting bug cannot exfiltrate it. Nothing here may store a token.
//
// What is cached below is the account *profile* — display data the UI already
// renders — so the first paint after a reload does not flash a signed-out shell
// while `/auth/me` is in flight. The cookie remains the only proof of identity.
const ACCOUNT_KEY = 'youngo-hub:session-account'

// Earlier builds mirrored the session token into localStorage. Remove any
// leftover copy on load so upgrading clients stop carrying a stealable
// credential; the cookie they already hold keeps them signed in.
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

export function setSession({ account } = {}) {
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

export function isSignedIn() {
  return hasCachedSession()
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
