import { createHash, randomBytes } from 'node:crypto'
import { existsSync, readFileSync, writeFileSync, mkdirSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { randomUUID } from 'node:crypto'
import { getPool } from './db.js'
import { findAccountByEmail } from './accounts.js'
import { hashPassword } from './password.js'

const here = path.dirname(fileURLToPath(import.meta.url))
const dataDir = path.join(here, '../../data')
const tokensPath = path.join(dataDir, 'password-reset-tokens.json')
const accountsPath = path.join(dataDir, 'hub-accounts.json')

const TTL_MS = 60 * 60 * 1000 // 1 hour

function readJson(file, fallback) {
  try {
    if (existsSync(file)) return JSON.parse(readFileSync(file, 'utf8'))
  } catch { /* empty */ }
  return fallback
}

function writeJson(file, data) {
  mkdirSync(path.dirname(file), { recursive: true })
  writeFileSync(file, JSON.stringify(data, null, 2))
}

export function hashToken(raw) {
  return createHash('sha256').update(raw).digest('hex')
}

export function newRawToken() {
  return randomBytes(32).toString('hex')
}

/**
 * Create a single-use reset token for an email.
 * Returns { rawToken, expiresAt, accountId } if user exists, else null.
 * Never throws for missing users (caller should always return generic message).
 */
export async function createPasswordResetToken(email) {
  const account = await findAccountByEmail(email)
  if (!account) return null

  const raw = newRawToken()
  const tokenHash = hashToken(raw)
  const expiresAt = new Date(Date.now() + TTL_MS)

  const pool = getPool()
  if (pool) {
    // Invalidate prior unused tokens
    await pool.query(
      `UPDATE password_reset_tokens SET used_at = now()
       WHERE account_id = $1 AND used_at IS NULL`,
      [account.id]
    )
    await pool.query(
      `INSERT INTO password_reset_tokens (account_id, token_hash, expires_at)
       VALUES ($1, $2, $3)`,
      [account.id, tokenHash, expiresAt.toISOString()]
    )
  } else {
    const list = readJson(tokensPath, []).map((t) => (
      t.account_id === account.id && !t.used_at ? { ...t, used_at: new Date().toISOString() } : t
    ))
    list.push({
      id: randomUUID(),
      account_id: account.id,
      token_hash: tokenHash,
      expires_at: expiresAt.toISOString(),
      used_at: null,
      created_at: new Date().toISOString(),
    })
    writeJson(tokensPath, list)
  }

  return {
    rawToken: raw,
    expiresAt: expiresAt.toISOString(),
    accountId: account.id,
    email: account.email,
  }
}

export async function consumePasswordResetToken(rawToken, newPassword) {
  if (!rawToken || String(newPassword || '').length < 10) {
    const err = new Error('Password must be at least 10 characters.')
    err.code = 'validation'
    throw err
  }
  if (String(newPassword).length > 200) {
    const err = new Error('Password is too long.')
    err.code = 'validation'
    throw err
  }

  const tokenHash = hashToken(rawToken)
  const pool = getPool()
  const { salt, hash } = hashPassword(newPassword)

  if (pool) {
    const client = await pool.connect()
    try {
      await client.query('BEGIN')
      const { rows } = await client.query(
        `SELECT * FROM password_reset_tokens
         WHERE token_hash = $1 AND used_at IS NULL AND expires_at > now()
         LIMIT 1
         FOR UPDATE`,
        [tokenHash]
      )
      if (!rows[0]) {
        const err = new Error('This reset link is invalid or has expired. Request a new one.')
        err.code = 'invalid_token'
        throw err
      }
      await client.query(
        `UPDATE hub_accounts SET password_hash = $1, password_salt = $2 WHERE id = $3`,
        [hash, salt, rows[0].account_id]
      )
      await client.query(
        `UPDATE password_reset_tokens SET used_at = now() WHERE id = $1`,
        [rows[0].id]
      )
      // Invalidate other open tokens
      await client.query(
        `UPDATE password_reset_tokens SET used_at = now()
         WHERE account_id = $1 AND used_at IS NULL`,
        [rows[0].account_id]
      )
      await client.query('COMMIT')
      return { accountId: rows[0].account_id }
    } catch (e) {
      await client.query('ROLLBACK')
      throw e
    } finally {
      client.release()
    }
  }

  const list = readJson(tokensPath, [])
  const row = list.find((t) => t.token_hash === tokenHash && !t.used_at && new Date(t.expires_at) > new Date())
  if (!row) {
    const err = new Error('This reset link is invalid or has expired. Request a new one.')
    err.code = 'invalid_token'
    throw err
  }
  row.used_at = new Date().toISOString()
  writeJson(tokensPath, list)

  const accounts = readJson(accountsPath, [])
  const idx = accounts.findIndex((a) => a.id === row.account_id)
  if (idx < 0) {
    const err = new Error('Account not found.')
    err.code = 'not_found'
    throw err
  }
  accounts[idx].password_hash = hash
  accounts[idx].password_salt = salt
  writeJson(accountsPath, accounts)
  return { accountId: row.account_id }
}

export function resetLink(origin, rawToken) {
  const base = (origin || '').replace(/\/$/, '')
  return `${base}/reset-password?token=${encodeURIComponent(rawToken)}`
}
