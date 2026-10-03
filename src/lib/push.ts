import webPush from 'web-push'
import { getPgPool } from './pg'
import { toCamelCase } from './case'
import { defaultEmailFrom } from './env'

// Port of server/lib/pushStore.js + the delivery path of server/routes/push.js.
// Rows live in the Payload `push-subscriptions` table; endpoints are validated
// against known browser push services before they're ever written.

const vapidPublicKey = process.env.VAPID_PUBLIC_KEY
const vapidPrivateKey = process.env.VAPID_PRIVATE_KEY
const vapidSubject = process.env.VAPID_SUBJECT || `mailto:${defaultEmailFrom()}`

if (vapidPublicKey && vapidPrivateKey) {
  webPush.setVapidDetails(vapidSubject, vapidPublicKey, vapidPrivateKey)
}

export const pushConfigured =
  process.env.HUB_DEMO_MODE !== 'true' && Boolean(vapidPublicKey && vapidPrivateKey)

/** Normalise a push-subscription row into its public API shape. */
const publicRow = (row: any) => {
  const r = toCamelCase<Record<string, any>>(row)
  return {
    id: r.id,
    accountId: r.accountId,
    endpoint: r.endpoint,
    keys: r.keys || {},
    createdAt: r.createdAt,
  }
}

// Push endpoints are browser-issued capabilities, never arbitrary webhook URLs.
export function validatedPushEndpoint(value: any) {
  const invalid = () =>
    Object.assign(new Error('Use a supported browser push endpoint.'), {
      code: 'invalid_push_endpoint',
    })
  if (
    typeof value !== 'string' ||
    value.length > 4096 ||
    // eslint-disable-next-line no-control-regex
    /[\\\s\x00-\x1f\x7f]/u.test(value)
  )
    throw invalid()
  let url: URL
  try {
    url = new URL(value)
  } catch {
    throw invalid()
  }
  const allowed =
    ['fcm.googleapis.com', 'updates.push.services.mozilla.com', 'web.push.apple.com'].includes(
      url.hostname,
    ) || url.hostname.endsWith('.notify.windows.com')
  if (!allowed || url.protocol !== 'https:' || url.port || url.username || url.password || url.hash)
    throw invalid()
  return url.href
}

export function toWebPushSubscription(row: any) {
  return {
    endpoint: validatedPushEndpoint(row.endpoint),
    keys: row.keys || {},
  }
}

const subscriptionLimitError = () =>
  Object.assign(new Error('Remove an old device before adding another (maximum 20).'), {
    code: 'push_subscription_limit',
  })

export async function saveSubscription({
  accountId,
  subscription,
  userAgent = null,
}: {
  accountId: number | string
  subscription: any
  userAgent?: string | null
}) {
  const endpoint = validatedPushEndpoint(subscription?.endpoint)
  const keys = subscription?.keys && typeof subscription.keys === 'object' ? subscription.keys : {}
  const pool = getPgPool()!
  const client = await pool.connect()
  try {
    await client.query('BEGIN')
    await client.query('SELECT id FROM accounts WHERE id=$1 FOR UPDATE', [accountId])
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
                     user_agent = EXCLUDED.user_agent, disabled_at = NULL,
                     updated_at = now()
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

export async function listSubscriptionsForAccounts(accountIds: any) {
  const ids = (Array.isArray(accountIds) ? accountIds : [accountIds])
    .filter(Boolean)
    .map(Number)
    .filter((n) => Number.isFinite(n))
  if (!ids.length) return []
  const pool = getPgPool()!
  const { rows } = await pool.query(
    'SELECT * FROM push_subscriptions WHERE account_id = ANY($1::int[])',
    [ids],
  )
  return rows.map(publicRow)
}

export async function listAllSubscriptions() {
  const pool = getPgPool()!
  const { rows } = await pool.query('SELECT * FROM push_subscriptions')
  return rows.map(publicRow)
}

export async function listSubscriberAccounts() {
  const pool = getPgPool()!
  const { rows } = await pool.query(
    `SELECT a.id, a.email, a.name, a.first_name, a.last_name,
            count(*)::int AS devices
     FROM push_subscriptions s
     JOIN accounts a ON a.id = s.account_id
     GROUP BY a.id, a.email, a.name, a.first_name, a.last_name
     ORDER BY max(s.created_at) DESC`,
  )
  return rows.map((row: any) => ({
    id: row.id,
    email: row.email,
    name: row.name || [row.first_name, row.last_name].filter(Boolean).join(' ') || row.email,
    devices: row.devices,
  }))
}

export async function deleteSubscription({
  accountId,
  endpoint = null,
}: {
  accountId: number | string
  endpoint?: string | null
}) {
  const pool = getPgPool()!
  const { rowCount } = endpoint
    ? await pool.query('DELETE FROM push_subscriptions WHERE account_id=$1 AND endpoint=$2', [
        accountId,
        endpoint,
      ])
    : await pool.query('DELETE FROM push_subscriptions WHERE account_id=$1', [accountId])
  return rowCount || 0
}

export async function pruneEndpoints(endpoints: string[]) {
  const list = (endpoints || []).filter(Boolean)
  if (!list.length) return 0
  const pool = getPgPool()!
  const { rowCount } = await pool.query(
    'DELETE FROM push_subscriptions WHERE endpoint = ANY($1::text[])',
    [list],
  )
  return rowCount || 0
}

/** Send a notification and prune endpoints the push service reports expired. */
export async function deliverPush(rows: any[], payload: string) {
  if (process.env.HUB_DEMO_MODE === 'true')
    return { sent: 0, failed: 0, pruned: 0, total: rows.length }

  const results: PromiseSettledResult<any>[] = []
  for (let offset = 0; offset < rows.length; offset += 10) {
    results.push(
      ...(await Promise.allSettled(
        rows.slice(offset, offset + 10).map((row) =>
          webPush.sendNotification(toWebPushSubscription(row), payload, {
            timeout: 10_000,
          }),
        ),
      )),
    )
  }
  const expired: string[] = []
  results.forEach((result, index) => {
    const status = result.status === 'rejected' ? (result.reason as any)?.statusCode : null
    if (status === 404 || status === 410) expired.push(rows[index].endpoint)
  })
  if (expired.length) await pruneEndpoints(expired)
  return {
    sent: results.filter((r) => r.status === 'fulfilled').length,
    failed: results.filter((r) => r.status === 'rejected').length,
    pruned: expired.length,
    total: rows.length,
  }
}
