import { createCipheriv, createDecipheriv, createHash, randomBytes } from 'node:crypto'
import { requirePgPool } from './pg'
import { sha256Hex } from './crypto'

// A sign-up is confirmed by email before an account exists, so the form never reveals whether an
// address is registered. The payload includes the password: encrypted at rest (AES-GCM, key from
// PAYLOAD_SECRET), valid 24 hours, deleted once the account exists or by the daily purge.

const LIFETIME_MS = 24 * 60 * 60 * 1000

const key = () =>
  createHash('sha256').update(`pending-registration:${process.env.PAYLOAD_SECRET}`).digest()

function encrypt(value: unknown): string {
  const iv = randomBytes(12)
  const cipher = createCipheriv('aes-256-gcm', key(), iv)
  const body = Buffer.concat([cipher.update(JSON.stringify(value), 'utf8'), cipher.final()])
  return Buffer.concat([iv, cipher.getAuthTag(), body]).toString('base64url')
}

function decrypt<T>(encoded: string): T {
  const raw = Buffer.from(encoded, 'base64url')
  const decipher = createDecipheriv('aes-256-gcm', key(), raw.subarray(0, 12))
  decipher.setAuthTag(raw.subarray(12, 28))
  const body = Buffer.concat([decipher.update(raw.subarray(28)), decipher.final()])
  return JSON.parse(body.toString('utf8')) as T
}

/** Stores the sign-up (replacing any earlier one for the address) and returns the emailed token. */
export async function savePendingRegistration(email: string, data: unknown): Promise<string> {
  const token = randomBytes(32).toString('hex')
  await requirePgPool().query(
    `INSERT INTO pending_registrations (email, token_hash, payload_enc, expires_at)
     VALUES ($1, $2, $3, $4)
     ON CONFLICT (email) DO UPDATE SET
       token_hash = EXCLUDED.token_hash,
       payload_enc = EXCLUDED.payload_enc,
       expires_at = EXCLUDED.expires_at,
       created_at = now()`,
    [email, sha256Hex(token), encrypt(data), new Date(Date.now() + LIFETIME_MS)],
  )
  return token
}

/** Whether the token is still valid. Does not consume it, so opening the link is harmless. */
export async function isPendingRegistration(token: string): Promise<boolean> {
  const { rowCount } = await requirePgPool().query(
    'SELECT 1 FROM pending_registrations WHERE token_hash = $1 AND expires_at > now()',
    [sha256Hex(token)],
  )
  return (rowCount ?? 0) > 0
}

/** The stored sign-up for a valid token; leaves it in place. */
export async function readPendingRegistration<T>(token: string): Promise<T | null> {
  const { rows } = await requirePgPool().query<{ payload_enc: string }>(
    'SELECT payload_enc FROM pending_registrations WHERE token_hash = $1 AND expires_at > now()',
    [sha256Hex(token)],
  )
  return rows[0] ? decrypt<T>(rows[0].payload_enc) : null
}

/** Called once the account exists; until then the link stays retryable. */
export async function discardPendingRegistration(token: string): Promise<void> {
  await requirePgPool().query('DELETE FROM pending_registrations WHERE token_hash = $1', [
    sha256Hex(token),
  ])
}

/** Deletes expired sign-ups. */
export async function purgeExpiredRegistrations(): Promise<number> {
  const { rowCount } = await requirePgPool().query(
    'DELETE FROM pending_registrations WHERE expires_at < now()',
  )
  return rowCount ?? 0
}
