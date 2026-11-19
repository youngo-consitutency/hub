import { pbkdf2, randomBytes, scrypt, timingSafeEqual } from 'node:crypto'
import type { Payload } from 'payload'
import { promisify } from 'node:util'

// Legacy scrypt password check: verify on first sign-in after migration, then
// write a Payload-managed password and clear the legacy fields.
const KEYLEN = 64
const scryptAsync = promisify(scrypt)

export async function verifyLegacyPassword(
  password: string,
  salt: string | null | undefined,
  hash: string | null | undefined,
): Promise<boolean> {
  if (!password || !salt || !hash) return false
  try {
    const next = (await scryptAsync(password, salt, KEYLEN)) as Buffer
    const prev = Buffer.from(hash, 'hex')
    if (next.length !== prev.length) return false
    return timingSafeEqual(next, prev)
  } catch {
    return false
  }
}

const pbkdf2Async = promisify(pbkdf2)

/**
 * Spends the time of a real password check, since Payload skips hashing for unknown emails.
 * Accounts on the old 25 000-iteration hash differ slightly until their next sign-in.
 */
export async function burnPasswordHash(payload: Payload, password: string): Promise<void> {
  const iterations = payload.config.auth.passwordHashIterations
  await pbkdf2Async(password, randomBytes(32).toString('hex'), iterations, 32, 'sha256')
}
