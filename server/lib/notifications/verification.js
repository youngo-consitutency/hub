import { createHash, randomBytes, randomUUID } from 'node:crypto'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { getPool } from '../db.js'
import { readJson, writeJson } from '../jsonFile.js'

const here = path.dirname(fileURLToPath(import.meta.url))
const dataDir = path.join(here, '../../../data')
const tokensPath = path.join(dataDir, 'email-verification-tokens.json')
const accountsPath = path.join(dataDir, 'hub-accounts.json')
const TTL_MS = 24 * 60 * 60 * 1000

function tokenHash(token) {
  return createHash('sha256')
    .update(String(token || ''))
    .digest('hex')
}

export async function createEmailVerificationToken(accountId) {
  const rawToken = randomBytes(32).toString('hex')
  const hash = tokenHash(rawToken)
  const expiresAt = new Date(Date.now() + TTL_MS).toISOString()
  const pool = getPool()
  if (pool) {
    const client = await pool.connect()
    try {
      await client.query('BEGIN')
      await client.query(
        `UPDATE email_verification_tokens SET used_at=now()
         WHERE account_id=$1 AND used_at IS NULL`,
        [accountId],
      )
      await client.query(
        `INSERT INTO email_verification_tokens(account_id,token_hash,expires_at)
         VALUES($1,$2,$3)`,
        [accountId, hash, expiresAt],
      )
      await client.query('COMMIT')
    } catch (error) {
      await client.query('ROLLBACK')
      throw error
    } finally {
      client.release()
    }
  } else {
    const tokens = readJson(tokensPath, []).map((item) =>
      item.accountId === accountId && !item.usedAt
        ? { ...item, usedAt: new Date().toISOString() }
        : item,
    )
    tokens.push({
      id: randomUUID(),
      accountId,
      tokenHash: hash,
      expiresAt,
      usedAt: null,
      createdAt: new Date().toISOString(),
    })
    writeJson(tokensPath, tokens)
  }
  return { rawToken, expiresAt }
}

export async function consumeEmailVerificationToken(rawToken) {
  const hash = tokenHash(rawToken)
  const pool = getPool()
  if (pool) {
    const client = await pool.connect()
    try {
      await client.query('BEGIN')
      const { rows } = await client.query(
        `SELECT * FROM email_verification_tokens
         WHERE token_hash=$1 AND used_at IS NULL AND expires_at > now()
         LIMIT 1 FOR UPDATE`,
        [hash],
      )
      if (!rows[0]) {
        await client.query('ROLLBACK')
        return null
      }
      await client.query(
        'UPDATE hub_accounts SET email_verified_at=now() WHERE id=$1',
        [rows[0].account_id],
      )
      await client.query(
        `UPDATE email_verification_tokens SET used_at=now()
         WHERE account_id=$1 AND used_at IS NULL`,
        [rows[0].account_id],
      )
      await client.query('COMMIT')
      return { accountId: rows[0].account_id }
    } catch (error) {
      await client.query('ROLLBACK')
      throw error
    } finally {
      client.release()
    }
  }

  const tokens = readJson(tokensPath, [])
  const row = tokens.find(
    (item) =>
      item.tokenHash === hash &&
      !item.usedAt &&
      new Date(item.expiresAt) > new Date(),
  )
  if (!row) return null
  const now = new Date().toISOString()
  for (const item of tokens) {
    if (item.accountId === row.accountId && !item.usedAt) item.usedAt = now
  }
  writeJson(tokensPath, tokens)
  const accounts = readJson(accountsPath, [])
  const account = accounts.find((item) => item.id === row.accountId)
  if (!account) return null
  account.email_verified_at = now
  writeJson(accountsPath, accounts)
  return { accountId: row.accountId }
}
