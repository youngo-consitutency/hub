import path from 'node:path'
import { fileURLToPath } from 'node:url'
import {
  emailConfigured,
  deliveryFailure,
  sendTemplatedEmail,
} from './lib/emailTransport.js'
import {
  claimDueNotifications,
  countSentNotificationsSince,
  deliveryDecision,
  markNotificationFailed,
  markNotificationSent,
  markNotificationSuppressed,
  requeueExpiredLeases,
} from './lib/notificationStore.js'
import { scheduleDueNotifications } from './lib/notificationScheduler.js'
import { unsubscribeUrl } from './lib/unsubscribe.js'
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
  if (!decision.allowed) {
    await markNotificationSuppressed(item, decision.reason)
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
    await markNotificationSent(item, result.messageId)
    return { status: 'sent' }
  } catch (error) {
    const failure = deliveryFailure(error)
    await markNotificationFailed(item, failure)
    return {
      status: failure.permanent ? 'failed' : 'retry',
      code: failure.code,
    }
  }
}

export async function runNotificationBatch(env = process.env) {
  const maxPerDay = positiveNumber(env.EMAIL_MAX_PER_DAY, 500, {
    integer: true,
  })
  const startOfDay = new Date()
  startOfDay.setUTCHours(0, 0, 0, 0)
  const sentToday = await countSentNotificationsSince(startOfDay)
  const remaining = Math.max(maxPerDay - sentToday, 0)
  if (!remaining) return { processed: 0, capped: true }
  const items = await claimDueNotifications({ limit: Math.min(remaining, 25) })
  const maxPerSecond = positiveNumber(env.EMAIL_MAX_PER_SECOND, 1)
  const interval = Math.ceil(1000 / maxPerSecond)
  const results = []
  for (const item of items) {
    results.push(await processNotification(item, env))
    if (items.length > 1) await sleep(interval)
  }
  return { processed: results.length, results, capped: false }
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
