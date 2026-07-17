import { randomBytes, scryptSync, timingSafeEqual } from 'node:crypto'

const KEYLEN = 64

export function hashPassword(password) {
  const salt = randomBytes(16).toString('hex')
  const hash = scryptSync(password, salt, KEYLEN).toString('hex')
  return { salt, hash }
}

export function verifyPassword(password, salt, hash) {
  if (!password || !salt || !hash) return false
  try {
    const next = scryptSync(password, salt, KEYLEN)
    const prev = Buffer.from(hash, 'hex')
    if (next.length !== prev.length) return false
    return timingSafeEqual(next, prev)
  } catch {
    return false
  }
}

export function newSessionToken() {
  return randomBytes(32).toString('hex')
}

export function sessionExpiry(days = 30) {
  return new Date(Date.now() + days * 24 * 60 * 60 * 1000)
}
