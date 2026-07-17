const TOKEN_KEY = 'youngo-hub:session-token'
const ACCOUNT_KEY = 'youngo-hub:session-account'

export function getSessionToken() {
  try {
    return localStorage.getItem(TOKEN_KEY)
  } catch {
    return null
  }
}

export function getCachedAccount() {
  try {
    const raw = localStorage.getItem(ACCOUNT_KEY)
    return raw ? JSON.parse(raw) : null
  } catch {
    return null
  }
}

export function setSession({ token, account }) {
  localStorage.setItem(TOKEN_KEY, token)
  if (account) localStorage.setItem(ACCOUNT_KEY, JSON.stringify(account))
}

export function clearSession() {
  localStorage.removeItem(TOKEN_KEY)
  localStorage.removeItem(ACCOUNT_KEY)
}

export function isSignedIn() {
  return Boolean(getSessionToken())
}
