import path from 'node:path'
import { fileURLToPath } from 'node:url'
import {
  emailConfigured,
  deliveryFailure,
  sendTemplatedEmail,
} from './lib/notifications/transport.js'
import {
  claimDueNotifications,
  notificationClaimIsCurrent,
  deferNotification,
  countSentNotificationsSince,
  deliveryDecision,
  markNotificationFailed,
  markNotificationSent,
  markNotificationSuppressed,
  requeueExpiredLeases,
} from './lib/notifications/store.js'
import { scheduleDueNotifications } from './lib/notifications/scheduler.js'
import { unsubscribeUrl } from './lib/notifications/unsubscribe.js'
import { getPool } from './lib/db.js'
import { validateRuntimeConfig } from './lib/config.js'

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

function positiveNumber(value, fallback, { integer = false } = {}) {
  const parsed = Number(value ?? fallback)
  if (
    !Number.isFinite(parsed) ||
    parsed <= 0 ||
    (integer && !Number.isInteger(parsed))
  ) {
    return fallback
  }
  return parsed
}

function messageId(item, env) {
  const domain =
    String(env.EMAIL_MESSAGE_DOMAIN || '').trim() ||
    new URL(env.APP_ORIGIN || 'http://localhost:5173').hostname
  return `<notification-${item.id}@${domain}>`
}

export async function processNotification(item, env = process.env) {
  const decision = await deliveryDecision(item)
  if (!(await notificationClaimIsCurrent(item)))
    return { status: 'stale_claim' }
  if (!decision.allowed) {
    if (decision.retryAt) {
      if (!(await deferNotification(item, decision.retryAt, decision.reason)))
        return { status: 'stale_claim' }
      return { status: 'retry', reason: decision.reason }
    }
    if (!(await markNotificationSuppressed(item, decision.reason)))
      return { status: 'stale_claim' }
    return { status: 'suppressed', reason: decision.reason }
  }
  try {
    const result = await sendTemplatedEmail({
      to: decision.account.email,
      templateKey: item.templateKey,
      data: item.payload,
      unsubscribeUrl: unsubscribeUrl(item.accountId, item.category, env),
      messageId: messageId(item, env),
      env,
    })
    if (!(await markNotificationSent(item, result.messageId)))
      return { status: 'stale_claim' }
    return { status: 'sent' }
  } catch (error) {
    const failure = deliveryFailure(error)
    if (!(await markNotificationFailed(item, failure)))
      return { status: 'stale_claim' }
    return {
      status: failure.permanent ? 'failed' : 'retry',
      code: failure.code,
    }
  }
}

async function deliverBatch(env) {
  const maxPerDay = positiveNumber(env.EMAIL_MAX_PER_DAY, 500, {
    integer: true,
  })
  const startOfDay = new Date()
  startOfDay.setUTCHours(0, 0, 0, 0)
  const sentToday = await countSentNotificationsSince(startOfDay)
  const remaining = Math.max(maxPerDay - sentToday, 0)
  if (!remaining) return { processed: 0, capped: true }
  const maxPerSecond = positiveNumber(env.EMAIL_MAX_PER_SECOND, 1)
  const interval = Math.ceil(1000 / maxPerSecond)
  const results = []
  for (let index = 0; index < Math.min(remaining, 25); index += 1) {
    if (index) await sleep(interval)
    // Claim only when ready to send; pacing must not consume queued leases.
    const [item] = await claimDueNotifications({ limit: 1 })
    if (!item) break
    results.push(await processNotification(item, env))
  }
  return { processed: results.length, results, capped: false }
}

export async function runNotificationBatch(env = process.env) {
  const pool = getPool()
  if (!pool) return deliverBatch(env)
  const client = await pool.connect()
  let locked = false
  try {
    locked = (
      await client.query(
        "SELECT pg_try_advisory_lock(hashtext('youngo-email-delivery')) AS locked",
      )
    ).rows[0].locked
    if (!locked) return { processed: 0, skipped: 'lock_busy' }
    return await deliverBatch(env)
  } finally {
    if (locked)
      await client.query(
        "SELECT pg_advisory_unlock(hashtext('youngo-email-delivery'))",
      )
    client.release()
  }
}

export async function startNotificationWorker(env = process.env) {
  validateRuntimeConfig(env)
  if (!emailConfigured(env)) {
    throw new Error(
      'The notification worker requires SMTP_HOST and EMAIL_FROM.',
    )
  }
  await requeueExpiredLeases()
  await scheduleDueNotifications({ env })
  let lastScheduleHour = new Date().toISOString().slice(0, 13)
  let lastLeaseSweep = Date.now()
  const pollMs = Math.max(
    positiveNumber(env.EMAIL_WORKER_POLL_MS, 15_000, { integer: true }),
    1_000,
  )
  console.log(JSON.stringify({ event: 'email_worker_started', pollMs }))
  while (true) {
    const hour = new Date().toISOString().slice(0, 13)
    if (hour !== lastScheduleHour) {
      await scheduleDueNotifications({ env })
      lastScheduleHour = hour
    }
    if (Date.now() - lastLeaseSweep >= 60_000) {
      await requeueExpiredLeases()
      lastLeaseSweep = Date.now()
    }
    const result = await runNotificationBatch(env)
    if (result.processed) {
      console.log(
        JSON.stringify({
          event: 'email_worker_batch',
          count: result.processed,
        }),
      )
    }
    await sleep(pollMs)
  }
}

const invokedPath = process.argv[1] ? path.resolve(process.argv[1]) : null
if (invokedPath === fileURLToPath(import.meta.url)) {
  startNotificationWorker().catch((error) => {
    console.error(
      JSON.stringify({
        event: 'email_worker_failed',
        code: error.code || 'error',
      }),
    )
    process.exitCode = 1
  })
}
