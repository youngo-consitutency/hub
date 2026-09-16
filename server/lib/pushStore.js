/**
 * Stores Web Push subscriptions in PostgreSQL or local JSON. Persistent storage
 * keeps browser and server subscription state aligned across restarts.
 */
import { randomUUID } from 'node:crypto'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { getPool } from './db.js'
import { readJson, writeJson } from './jsonFile.js'

const dataDir = path.join(
  path.dirname(fileURLToPath(import.meta.url)),
  '../../data',
)
const subscriptionsPath = path.join(dataDir, 'push-subscriptions.json')
const accountsPath = path.join(dataDir, 'hub-accounts.json')

function publicRow(row) {
  return {
    id: row.id,
    accountId: row.account_id ?? row.accountId,
    endpoint: row.endpoint,
    keys: row.keys || {},
    createdAt: row.created_at ?? row.createdAt,
  }
}

// Push endpoints are browser-issued capabilities, never arbitrary webhook URLs.
export function validatedPushEndpoint(value) {
  const invalid = () =>
    Object.assign(new Error('Use a supported browser push endpoint.'), {
      code: 'invalid_push_endpoint',
    })
  if (
    typeof value !== 'string' ||
    value.length > 4096 ||
    // Reject controls before URL parsing can silently strip them.
    // eslint-disable-next-line no-control-regex
    /[\\\s\u0000-\u001f\u007f]/u.test(value)
  )
    throw invalid()
  let url
  try {
    url = new URL(value)
  } catch {
    throw invalid()
  }
  const allowed =
    [
      'fcm.googleapis.com',
      'updates.push.services.mozilla.com',
      'web.push.apple.com',
    ].includes(url.hostname) || url.hostname.endsWith('.notify.windows.com')
  if (
    !allowed ||
    url.protocol !== 'https:' ||
    url.port ||
    url.username ||
    url.password ||
    url.hash
  )
    throw invalid()
  return url.href
}

/** Shape a stored row back into the object web-push expects. */
export function toWebPushSubscription(row) {
  return { endpoint: validatedPushEndpoint(row.endpoint), keys: row.keys || {} }
}

function subscriptionLimitError() {
  return Object.assign(
    new Error('Remove an old device before adding another (maximum 20).'),
    { code: 'push_subscription_limit' },
  )
}

export async function saveSubscription({
  accountId,
  subscription,
  userAgent = null,
}) {
  const endpoint = validatedPushEndpoint(subscription?.endpoint)
  const keys =
    subscription?.keys && typeof subscription.keys === 'object'
      ? subscription.keys
      : {}

  const pool = getPool()
  if (pool) {
    const client = await pool.connect()
    try {
      await client.query('BEGIN')
      await client.query('SELECT id FROM hub_accounts WHERE id=$1 FOR UPDATE', [
        accountId,
      ])
      const count = await client.query(
        'SELECT count(*)::int AS count FROM push_subscriptions WHERE account_id=$1 AND endpoint<>$2',
        [accountId, endpoint],
      )
      if (count.rows[0].count >= 20) throw subscriptionLimitError()
      const { rows } = await client.query(
        `INSERT INTO push_subscriptions (account_id, endpoint, keys, user_agent)
       VALUES ($1,$2,$3,$4)
       ON CONFLICT (endpoint)
       DO UPDATE SET account_id = EXCLUDED.account_id, keys = EXCLUDED.keys,
                     user_agent = EXCLUDED.user_agent, last_used_at = now()
       RETURNING *`,
        [accountId, endpoint, keys, userAgent],
      )
      await client.query('COMMIT')
      return publicRow(rows[0])
    } catch (error) {
      await client.query('ROLLBACK')
      throw error
    } finally {
      client.release()
    }
  }

  const list = readJson(subscriptionsPath, [])
  if (
    list.filter(
      (row) =>
        (row.account_id ?? row.accountId) === accountId &&
        row.endpoint !== endpoint,
    ).length >= 20
  )
    throw subscriptionLimitError()
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
  const ids = (Array.isArray(accountIds) ? accountIds : [accountIds])
    .filter(Boolean)
    .map(String)
  if (!ids.length) return []
  const pool = getPool()
  if (pool) {
    const { rows } = await pool.query(
      'SELECT * FROM push_subscriptions WHERE account_id = ANY($1::uuid[])',
      [ids],
    )
    return rows.map(publicRow)
  }
  return readJson(subscriptionsPath, [])
    .filter((s) => ids.includes(String(s.accountId)))
    .map(publicRow)
}

export async function listAllSubscriptions() {
  const pool = getPool()
  if (pool) {
    const { rows } = await pool.query('SELECT * FROM push_subscriptions')
    return rows.map(publicRow)
  }
  return readJson(subscriptionsPath, []).map(publicRow)
}

function accountLabel(row) {
  return (
    row.name ||
    [row.first_name ?? row.firstName, row.last_name ?? row.lastName]
      .filter(Boolean)
      .join(' ') ||
    row.email
  )
}

/**
 * Accounts that currently have at least one device endpoint. Never returns
 * endpoints or keys — those stay server-side for delivery.
 */
export async function listSubscriberAccounts() {
  const pool = getPool()
  if (pool) {
    const { rows } = await pool.query(
      `SELECT a.id, a.email, a.name, a.first_name, a.last_name,
              count(*)::int AS devices
       FROM push_subscriptions s
       JOIN hub_accounts a ON a.id = s.account_id
       GROUP BY a.id, a.email, a.name, a.first_name, a.last_name
       ORDER BY max(COALESCE(s.last_used_at, s.created_at)) DESC`,
    )
    return rows.map((row) => ({
      id: row.id,
      email: row.email,
      name: accountLabel(row),
      devices: row.devices,
    }))
  }

  const counts = new Map()
  for (const row of readJson(subscriptionsPath, [])) {
    const id = String(row.accountId)
    counts.set(id, (counts.get(id) || 0) + 1)
  }
  const accounts = readJson(accountsPath, [])
  return [...counts.entries()].map(([id, devices]) => {
    const account = accounts.find((row) => String(row.id) === id)
    return {
      id,
      email: account?.email || null,
      name: account ? accountLabel(account) : 'Unknown account',
      devices,
    }
  })
}

export async function deleteSubscription({ accountId, endpoint = null }) {
  const pool = getPool()
  if (pool) {
    const { rowCount } = endpoint
      ? await pool.query(
          'DELETE FROM push_subscriptions WHERE account_id=$1 AND endpoint=$2',
          [accountId, endpoint],
        )
      : await pool.query('DELETE FROM push_subscriptions WHERE account_id=$1', [
          accountId,
        ])
    return rowCount
  }
  const list = readJson(subscriptionsPath, [])
  const keep = list.filter(
    (s) =>
      String(s.accountId) !== String(accountId) ||
      (endpoint ? s.endpoint !== endpoint : false),
  )
  writeJson(subscriptionsPath, keep)
  return list.length - keep.length
}

/**
 * Remove endpoints rejected with 404 or 410 so later sends do not retry them.
 */
export async function pruneEndpoints(endpoints) {
  const list = (endpoints || []).filter(Boolean)
  if (!list.length) return 0
  const pool = getPool()
  if (pool) {
    const { rowCount } = await pool.query(
      'DELETE FROM push_subscriptions WHERE endpoint = ANY($1::text[])',
      [list],
    )
    return rowCount
  }
  const stored = readJson(subscriptionsPath, [])
  const keep = stored.filter((s) => !list.includes(s.endpoint))
  writeJson(subscriptionsPath, keep)
  return stored.length - keep.length
}
