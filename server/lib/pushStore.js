/**
 * Web push subscription storage.
 *
 * Postgres when DATABASE_URL is set, JSON on disk otherwise, matching the rest
 * of the hub. Subscriptions used to live in a module-level Map, so every deploy
 * dropped them silently — a member stayed "subscribed" in their browser while
 * the server had no record to send to.
 */
import { randomUUID } from 'node:crypto'
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { getPool } from './db.js'

const dataDir = path.join(path.dirname(fileURLToPath(import.meta.url)), '../../data')
const subscriptionsPath = path.join(dataDir, 'push-subscriptions.json')

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

function publicRow(row) {
  return {
    id: row.id,
    accountId: row.account_id ?? row.accountId,
    endpoint: row.endpoint,
    keys: row.keys || {},
    createdAt: row.created_at ?? row.createdAt,
  }
}

/** Shape a stored row back into the object web-push expects. */
export function toWebPushSubscription(row) {
  return { endpoint: row.endpoint, keys: row.keys || {} }
}

export async function saveSubscription({ accountId, subscription, userAgent = null }) {
  const endpoint = String(subscription?.endpoint || '').trim()
  if (!endpoint) throw new Error('subscription.endpoint is required')
  const keys = subscription?.keys && typeof subscription.keys === 'object' ? subscription.keys : {}

  const pool = getPool()
  if (pool) {
    const { rows } = await pool.query(
      `INSERT INTO push_subscriptions (account_id, endpoint, keys, user_agent)
       VALUES ($1,$2,$3,$4)
       ON CONFLICT (endpoint)
       DO UPDATE SET account_id = EXCLUDED.account_id, keys = EXCLUDED.keys,
                     user_agent = EXCLUDED.user_agent, last_used_at = now()
       RETURNING *`,
      [accountId, endpoint, keys, userAgent]
    )
    return publicRow(rows[0])
  }

  const list = readJson(subscriptionsPath, [])
  const existing = list.find((s) => s.endpoint === endpoint)
  if (existing) {
    existing.accountId = accountId
    existing.keys = keys
    existing.userAgent = userAgent
    existing.lastUsedAt = new Date().toISOString()
    writeJson(subscriptionsPath, list)
    return publicRow(existing)
  }
  const row = {
    id: randomUUID(),
    accountId,
    endpoint,
    keys,
    userAgent,
    createdAt: new Date().toISOString(),
  }
  list.push(row)
  writeJson(subscriptionsPath, list)
  return publicRow(row)
}

export async function listSubscriptionsForAccounts(accountIds) {
  const ids = (Array.isArray(accountIds) ? accountIds : [accountIds]).filter(Boolean).map(String)
  if (!ids.length) return []
  const pool = getPool()
  if (pool) {
    const { rows } = await pool.query(
      'SELECT * FROM push_subscriptions WHERE account_id = ANY($1::uuid[])',
      [ids]
    )
    return rows.map(publicRow)
  }
  return readJson(subscriptionsPath, []).filter((s) => ids.includes(String(s.accountId))).map(publicRow)
}

export async function listAllSubscriptions() {
  const pool = getPool()
  if (pool) {
    const { rows } = await pool.query('SELECT * FROM push_subscriptions')
    return rows.map(publicRow)
  }
  return readJson(subscriptionsPath, []).map(publicRow)
}

export async function deleteSubscription({ accountId, endpoint = null }) {
  const pool = getPool()
  if (pool) {
    const { rowCount } = endpoint
      ? await pool.query('DELETE FROM push_subscriptions WHERE account_id=$1 AND endpoint=$2', [accountId, endpoint])
      : await pool.query('DELETE FROM push_subscriptions WHERE account_id=$1', [accountId])
    return rowCount
  }
  const list = readJson(subscriptionsPath, [])
  const keep = list.filter((s) => (
    String(s.accountId) !== String(accountId) || (endpoint ? s.endpoint !== endpoint : false)
  ))
  writeJson(subscriptionsPath, keep)
  return list.length - keep.length
}

/**
 * Drop endpoints the push service has rejected as gone (404/410). Browsers
 * rotate endpoints, so without this the table fills with dead rows that fail
 * on every send.
 */
export async function pruneEndpoints(endpoints) {
  const list = (endpoints || []).filter(Boolean)
  if (!list.length) return 0
  const pool = getPool()
  if (pool) {
    const { rowCount } = await pool.query('DELETE FROM push_subscriptions WHERE endpoint = ANY($1::text[])', [list])
    return rowCount
  }
  const stored = readJson(subscriptionsPath, [])
  const keep = stored.filter((s) => !list.includes(s.endpoint))
  writeJson(subscriptionsPath, keep)
  return stored.length - keep.length
}
