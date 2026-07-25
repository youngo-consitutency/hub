import { randomBytes, scrypt, timingSafeEqual } from 'node:crypto'
import { promisify } from 'node:util'

const KEYLEN = 64
const scryptAsync = promisify(scrypt)

export async function hashPassword(password) {
  const salt = randomBytes(16).toString('hex')
  const derived = await scryptAsync(password, salt, KEYLEN)
  const hash = derived.toString('hex')
  return { salt, hash }
}

export async function verifyPassword(password, salt, hash) {
  if (!password || !salt || !hash) return false
  try {
    const next = await scryptAsync(password, salt, KEYLEN)
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
