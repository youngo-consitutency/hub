import { randomUUID } from 'node:crypto'

// Rate limiting lives in ./rateLimit.js — it enforces a hard bucket cap, so it
// cannot grow without bound when a caller rotates source addresses.

export function requestSecurity(req, res, next) {
  req.requestId = req.get('x-request-id') || randomUUID()
  res.set('X-Request-Id', req.requestId)
  res.set('X-Content-Type-Options', 'nosniff')
  res.set('Referrer-Policy', 'strict-origin-when-cross-origin')
  res.set('Permissions-Policy', 'camera=(), microphone=(), geolocation=()')
  res.set('Cross-Origin-Opener-Policy', 'same-origin')
  res.set(
    'Content-Security-Policy',
    "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; font-src 'self' data:; img-src 'self' data: https:; connect-src 'self'; frame-ancestors 'none'; base-uri 'self'; form-action 'self'",
  )
  next()
}

export function cookieValue(req, name) {
  const raw = String(req.headers.cookie || '')
  for (const part of raw.split(';')) {
    const [key, ...value] = part.trim().split('=')
    if (key === name) return decodeURIComponent(value.join('='))
  }
  return null
}

export const SESSION_COOKIE = 'youngo_session'

/**
 * Session token from Authorization, x-session-token, or the session cookie.
 * Shared home for the lookup that member and intelligence routes each define
 * locally; new routes should import this rather than add a fourth copy.
 */
export function bearerToken(req) {
  const header = req.headers.authorization || ''
  if (header.startsWith('Bearer ')) return header.slice(7).trim()
  return (
    String(req.headers['x-session-token'] || '').trim() ||
    cookieValue(req, SESSION_COOKIE) ||
    null
  )
}

export function setSessionCookie(res, token, expiresAt) {
  const secure = process.env.NODE_ENV === 'production' ? '; Secure' : ''
  res.append(
    'Set-Cookie',
    `${SESSION_COOKIE}=${encodeURIComponent(token)}; Path=/; HttpOnly; SameSite=Lax; Expires=${new Date(expiresAt).toUTCString()}${secure}`,
  )
}
export function clearSessionCookie(res) {
  const secure = process.env.NODE_ENV === 'production' ? '; Secure' : ''
  res.append(
    'Set-Cookie',
    `${SESSION_COOKIE}=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0${secure}`,
  )
}
