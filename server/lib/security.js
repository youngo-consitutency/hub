import { randomUUID } from 'node:crypto'

const buckets = new Map()

export function rateLimit({ windowMs = 60_000, max = 30, name = 'default' } = {}) {
  return (req, res, next) => {
    const key = `${name}:${req.ip || req.socket?.remoteAddress || 'unknown'}`
    const now = Date.now()
    if (buckets.size > 10_000) for (const [bucketKey, value] of buckets) if (value.resetAt <= now) buckets.delete(bucketKey)
    const current = buckets.get(key)
    if (!current || current.resetAt <= now) buckets.set(key, { count: 1, resetAt: now + windowMs })
    else {
      current.count += 1
      if (current.count > max) {
        res.set('Retry-After', String(Math.ceil((current.resetAt - now) / 1000)))
        return res.status(429).json({ error: { code: 'rate_limited', message: 'Too many requests. Please try again shortly.' } })
      }
    }
    next()
  }
}

export function requestSecurity(req, res, next) {
  req.requestId = req.get('x-request-id') || randomUUID()
  res.set('X-Request-Id', req.requestId)
  res.set('X-Content-Type-Options', 'nosniff')
  res.set('Referrer-Policy', 'strict-origin-when-cross-origin')
  res.set('Permissions-Policy', 'camera=(), microphone=(), geolocation=()')
  res.set('Cross-Origin-Opener-Policy', 'same-origin')
  res.set('Content-Security-Policy', "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; font-src 'self' data:; img-src 'self' data: https:; connect-src 'self'; frame-ancestors 'none'; base-uri 'self'; form-action 'self'")
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
export function setSessionCookie(res, token, expiresAt) {
  const secure = process.env.NODE_ENV === 'production' ? '; Secure' : ''
  res.append('Set-Cookie', `${SESSION_COOKIE}=${encodeURIComponent(token)}; Path=/; HttpOnly; SameSite=Lax; Expires=${new Date(expiresAt).toUTCString()}${secure}`)
}
export function clearSessionCookie(res) {
  const secure = process.env.NODE_ENV === 'production' ? '; Secure' : ''
  res.append('Set-Cookie', `${SESSION_COOKIE}=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0${secure}`)
}
