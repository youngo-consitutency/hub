import { Router } from 'express'
import webPush from 'web-push'
import { getSessionAccount } from '../lib/accounts.js'
import { ensureAdminRole } from '../lib/lifecycle.js'
import { bearerToken } from '../lib/security.js'
import { createRateLimiter } from '../lib/rateLimit.js'
import { recordAudit } from '../lib/audit.js'
import {
  saveSubscription,
  deleteSubscription,
  listSubscriptionsForAccounts,
  listAllSubscriptions,
  listSubscriberAccounts,
  pruneEndpoints,
  toWebPushSubscription,
} from '../lib/pushStore.js'

export const pushRouter = Router()
pushRouter.use((req, res, next) => {
  res.set('Cache-Control', 'no-store')
  next()
})

const vapidPublicKey = process.env.VAPID_PUBLIC_KEY
const vapidPrivateKey = process.env.VAPID_PRIVATE_KEY
const vapidSubject = process.env.VAPID_SUBJECT || 'mailto:admin@youngo-hub.org'

if (vapidPublicKey && vapidPrivateKey) {
  webPush.setVapidDetails(vapidSubject, vapidPublicKey, vapidPrivateKey)
  console.log('[Push] VAPID keys configured')
} else {
  console.warn('[Push] VAPID keys not configured - push notifications disabled')
}

const sendLimit = createRateLimiter({ max: 10, windowMs: 60_000 })

// Keyed on the account rather than the caller IP. At a COP the whole YOUNGO
// delegation shares one venue network, so an IP-keyed budget would let the
// first ten people to set notifications up lock out everyone else.
const testLimit = createRateLimiter({
  max: 5,
  windowMs: 60_000,
  key: (req) => req.account.id,
})

/**
 * Resolve the current account or return 401. Do not use `authenticate` here;
 * that function checks an email and password and is not Express middleware.
 */
async function requireAccount(req, res) {
  const account = await getSessionAccount(bearerToken(req))
  if (!account) {
    res.status(401).json({
      error: {
        code: 'unauthorized',
        message: 'Sign in to manage notifications.',
      },
    })
    return null
  }
  req.account = await ensureAdminRole(account)
  return req.account
}

function requireAdmin(account, res) {
  if (account.role !== 'admin') {
    res
      .status(403)
      .json({ error: { code: 'forbidden', message: 'Admin access required.' } })
    return false
  }
  return true
}

function requireConfigured(res) {
  if (!vapidPublicKey || !vapidPrivateKey) {
    res.status(503).json({
      error: {
        code: 'push_not_configured',
        message: 'Push notifications are not configured.',
      },
    })
    return false
  }
  return true
}

/**
 * Send a notification and remove endpoints that the push service reports as
 * expired.
 */
async function deliver(rows, payload) {
  const results = []
  // Bound parallel network connections and validate persisted legacy rows too.
  for (let offset = 0; offset < rows.length; offset += 10) {
    results.push(
      ...(await Promise.allSettled(
        rows.slice(offset, offset + 10).map(async (row) =>
          webPush.sendNotification(toWebPushSubscription(row), payload, {
            timeout: 10_000,
          }),
        ),
      )),
    )
  }
  const expired = []
  results.forEach((result, index) => {
    const status =
      result.status === 'rejected' ? result.reason?.statusCode : null
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

pushRouter.get('/vapid-key', (req, res) => {
  if (!requireConfigured(res)) return
  res.json({ publicKey: vapidPublicKey })
})

pushRouter.post('/subscribe', async (req, res, next) => {
  try {
    const account = await requireAccount(req, res)
    if (!account) return
    if (!requireConfigured(res)) return
    // Accept the current { subscription } body and the older bare subscription.
    const body = req.body || {}
    const subscription = body.subscription?.endpoint ? body.subscription : body
    if (!subscription?.endpoint) {
      return res.status(400).json({
        error: {
          code: 'validation',
          message: 'A subscription endpoint is required.',
        },
      })
    }
    const saved = await saveSubscription({
      accountId: account.id,
      subscription,
      userAgent: req.get('user-agent') || null,
    })
    res.json({
      ok: true,
      subscription: { id: saved.id, endpoint: saved.endpoint },
    })
  } catch (error) {
    if (
      ['invalid_push_endpoint', 'push_subscription_limit'].includes(error.code)
    ) {
      return res
        .status(400)
        .json({ error: { code: error.code, message: error.message } })
    }
    next(error)
  }
})

pushRouter.post('/unsubscribe', async (req, res, next) => {
  try {
    const account = await requireAccount(req, res)
    if (!account) return
    const removed = await deleteSubscription({
      accountId: account.id,
      endpoint: req.body?.endpoint || null,
    })
    res.json({ ok: true, removed })
  } catch (error) {
    next(error)
  }
})

pushRouter.get('/admin/summary', async (req, res, next) => {
  try {
    const account = await requireAccount(req, res)
    if (!account) return
    if (!requireAdmin(account, res)) return
    const subscribers = await listSubscriberAccounts()
    res.json({
      configured: Boolean(vapidPublicKey && vapidPrivateKey),
      accounts: subscribers.length,
      devices: subscribers.reduce((total, row) => total + row.devices, 0),
    })
  } catch (error) {
    next(error)
  }
})

pushRouter.get('/admin/subscribers', async (req, res, next) => {
  try {
    const account = await requireAccount(req, res)
    if (!account) return
    if (!requireAdmin(account, res)) return
    const subscribers = await listSubscriberAccounts()
    res.json({
      configured: Boolean(vapidPublicKey && vapidPrivateKey),
      items: subscribers,
    })
  } catch (error) {
    next(error)
  }
})

pushRouter.get('/status', async (req, res, next) => {
  try {
    const account = await requireAccount(req, res)
    if (!account) return
    const rows = await listSubscriptionsForAccounts([account.id])
    res.json({
      configured: Boolean(vapidPublicKey && vapidPrivateKey),
      subscribed: rows.length > 0,
      subscriptions: rows.map((row) => ({
        id: row.id,
        endpoint: row.endpoint,
        createdAt: row.createdAt,
      })),
    })
  } catch (error) {
    next(error)
  }
})

/**
 * Send a test to the caller's own devices. Any signed-in account may do this —
 * it only ever reaches their own subscriptions, and confirming that alerts
 * actually arrive is the whole point of the setting. The rate limiter caps it.
 */
pushRouter.post(
  '/test',
  async (req, res, next) => {
    try {
      if (await requireAccount(req, res)) next()
    } catch (error) {
      next(error)
    }
  },
  testLimit,
  async (req, res, next) => {
    try {
      const account = req.account
      if (!requireConfigured(res)) return
      const rows = await listSubscriptionsForAccounts([account.id])
      if (!rows.length) {
        return res.status(404).json({
          error: {
            code: 'no_subscriptions',
            message: 'Subscribe on this device first.',
          },
        })
      }
      const payload = JSON.stringify({
        title: req.body?.title || 'YOUNGO Hub',
        body: req.body?.body || 'Test notification.',
        icon: '/icons/icon-192.png',
        badge: '/icons/icon-72.png',
        tag: 'test-notification',
        data: { url: '/' },
      })
      res.json({ ok: true, ...(await deliver(rows, payload)) })
    } catch (error) {
      next(error)
    }
  },
)

/**
 * Send an audited admin notification to selected members or all members.
 */
pushRouter.post('/send', sendLimit, async (req, res, next) => {
  try {
    const account = await requireAccount(req, res)
    if (!account) return
    if (!requireAdmin(account, res)) return
    if (!requireConfigured(res)) return

    const { userIds, title, body, icon, badge, tag, data, requireInteraction } =
      req.body || {}
    const targetAll = userIds === 'all'
    if (!targetAll && (!Array.isArray(userIds) || !userIds.length)) {
      return res.status(400).json({
        error: {
          code: 'validation',
          message: 'Provide userIds as an array, or "all".',
        },
      })
    }
    if (!title || !body) {
      return res.status(400).json({
        error: {
          code: 'validation',
          message: 'A title and body are required.',
        },
      })
    }

    const rows = targetAll
      ? await listAllSubscriptions()
      : await listSubscriptionsForAccounts(userIds)
    if (!rows.length) {
      return res.status(404).json({
        error: {
          code: 'no_subscriptions',
          message: 'No active subscriptions for those members.',
        },
      })
    }

    const payload = JSON.stringify({
      title,
      body,
      icon: icon || '/icons/icon-192.png',
      badge: badge || '/icons/icon-72.png',
      tag: tag || 'youngo-notification',
      data: data || { url: '/' },
      requireInteraction: Boolean(requireInteraction),
    })
    const result = await deliver(rows, payload)

    await recordAudit({
      actorId: account.id,
      action: 'push.broadcast',
      targetType: 'push',
      targetId: targetAll ? 'all' : userIds.join(','),
      after: { title, recipients: result.total, sent: result.sent },
      requestId: req.requestId,
    })

    res.json({ ok: true, ...result })
  } catch (error) {
    next(error)
  }
})
