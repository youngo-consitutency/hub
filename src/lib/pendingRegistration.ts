import { createCipheriv, createDecipheriv, createHash, randomBytes } from 'node:crypto'
import { requirePgPool } from './pg'
import { sha256Hex } from './crypto'

// A registration is confirmed by email before an account exists. That keeps "is this address
// already registered?" from being answerable through the sign-up form: every request gets the
// same reply, and only the address's owner learns the difference, by email.
//
// The payload holds the whole sign-up including the password, so it is encrypted at rest (AES-GCM,
// key derived from PAYLOAD_SECRET), kept for 24 hours and deleted the moment it is used.

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
  const pool = requirePgPool()
  await pool.query('DELETE FROM pending_registrations WHERE expires_at < now()')
  await pool.query(
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

/** Consumes the token: one conditional DELETE, so two requests cannot both use it. */
export async function takePendingRegistration<T>(token: string): Promise<T | null> {
  const { rows } = await requirePgPool().query<{ payload_enc: string }>(
    'DELETE FROM pending_registrations WHERE token_hash = $1 AND expires_at > now() RETURNING payload_enc',
    [sha256Hex(token)],
  )
  return rows[0] ? decrypt<T>(rows[0].payload_enc) : null
}
