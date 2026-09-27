import { scrypt, timingSafeEqual } from 'node:crypto'
import { promisify } from 'node:util'

// Legacy password check: the pre-Payload system stored scrypt hex digests with
// a per-account hex salt. On first sign-in after migration we verify against
// these, then write a Payload-managed password and clear the legacy fields.
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
