import type { Endpoint } from 'payload'
import { after } from 'next/server'
import { randomUUID } from 'node:crypto'
import { ApiError, endpoint, fail, json, readBody } from '../lib/respond'
import { requireAccount, memberContext } from '../lib/accounts'
import { hasCapability } from '../lib/access'
import { rateLimit } from '../lib/rateLimit'
import {
  deleteSubscription,
  deliverPush,
  listAllSubscriptions,
  listSubscriberAccounts,
  listSubscriptionsForAccounts,
  pushConfigured,
  saveSubscription,
} from '../lib/push'
import { drainNotificationOutbox, enqueueNotification } from '../lib/notifications'
import { audit } from '../lib/audit'

// Keyed on the account rather than the caller IP — venue networks share IPs.
const pushTestLimit = rateLimit({
  windowMs: 60_000,
  max: 5,
  scope: 'push-test',
  key: (req) => String((req as any).user?.id || 'anon'),
})
const pushSendLimit = rateLimit({ windowMs: 60_000, max: 10, scope: 'push-send' })

const pushUnavailable = () =>
  new ApiError(503, 'push_not_configured', 'Push notifications are not configured.')

export const pushEndpoints: Endpoint[] = [
  {
    path: '/push/vapid-key',
    method: 'get',
    handler: endpoint(async () => {
      if (!pushConfigured) throw pushUnavailable()
      return json({ publicKey: process.env.VAPID_PUBLIC_KEY })
    }),
  },
  {
    path: '/push/subscribe',
    method: 'post',
    handler: endpoint(async (req) => {
      const account = requireAccount(req)
      if (!pushConfigured) throw pushUnavailable()
      const b = await readBody(req)
      const subscription = b.subscription?.endpoint ? b.subscription : b
      if (!subscription?.endpoint)
        throw fail.validation({ endpoint: 'A subscription endpoint is required.' })
      try {
        const saved = await saveSubscription({
          accountId: account.id,
          subscription,
          userAgent: req.headers.get('user-agent') || null,
        })
        return json({
          ok: true,
          subscription: { id: saved.id, endpoint: saved.endpoint },
        })
      } catch (error: any) {
        if (['invalid_push_endpoint', 'push_subscription_limit'].includes(error.code))
          throw new ApiError(400, error.code, error.message)
        throw error
      }
    }),
  },
  {
    path: '/push/unsubscribe',
    method: 'post',
    handler: endpoint(async (req) => {
      const account = requireAccount(req)
      const b = await readBody(req)
      const removed = await deleteSubscription({
        accountId: account.id,
        endpoint: b.endpoint || null,
      })
      return json({ ok: true, removed })
    }),
  },
  {
    path: '/push/status',
    method: 'get',
    handler: endpoint(async (req) => {
      const account = requireAccount(req)
      const rows = await listSubscriptionsForAccounts([account.id])
      return json({
        configured: pushConfigured,
        subscribed: rows.length > 0,
        subscriptions: rows.map((row: any) => ({
          id: row.id,
          endpoint: row.endpoint,
          createdAt: row.createdAt,
        })),
      })
    }),
  },
  {
    // Test notification to the caller's own devices — account-keyed limit.
    path: '/push/test',
    method: 'post',
    handler: endpoint(async (req) => {
      const account = requireAccount(req)
      await pushTestLimit(req)
      if (!pushConfigured) throw pushUnavailable()
      const rows = await listSubscriptionsForAccounts([account.id])
      if (!rows.length)
        throw new ApiError(404, 'no_subscriptions', 'Subscribe on this device first.')
      const b = await readBody(req)
      const payload = JSON.stringify({
        title: b.title || 'YOUNGO Hub',
        body: b.body || 'Test notification.',
        icon: '/icons/icon-192.png',
        badge: '/icons/icon-72.png',
        tag: 'test-notification',
        data: { url: '/' },
      })
      return json({ ok: true, ...(await deliverPush(rows, payload)) })
    }),
  },
  {
    path: '/push/send',
    method: 'post',
    handler: endpoint(async (req) => {
      const { account, access } = await memberContext(req)
      if (!hasCapability(access, 'notifications.send'))
        throw fail.forbidden('Sending notifications requires a mandate.')
      await pushSendLimit(req)
      if (!pushConfigured) throw pushUnavailable()
      const b = await readBody(req)
      const { userIds, title, body, icon, badge, tag, data, requireInteraction } = b
      const targetAll = userIds === 'all'
      if (!targetAll && (!Array.isArray(userIds) || !userIds.length))
        throw fail.validation({ userIds: 'Provide userIds as an array, or "all".' })
      if (!title || !body) throw fail.validation({ title: 'A title and body are required.' })
      const rows = targetAll
        ? await listAllSubscriptions()
        : await listSubscriptionsForAccounts(userIds)
      if (!rows.length)
        throw new ApiError(404, 'no_subscriptions', 'No active subscriptions for those members.')
      const payload = JSON.stringify({
        title,
        body,
        icon: icon || '/icons/icon-192.png',
        badge: badge || '/icons/icon-72.png',
        tag: tag || 'youngo-notification',
        data: data || { url: '/' },
        requireInteraction: Boolean(requireInteraction),
      })
      // One outbox job per member — delivery, endpoint pruning and retries
      // happen in the post-response drain (after() and the cron backstop),
      // never inside this request.
      const accountIds = [...new Set(rows.map((row: any) => row.accountId))]
      const campaignId =
        String(req.headers.get('x-idempotency-key') || '')
          .trim()
          .slice(0, 120) || randomUUID()
      let queued = 0
      for (const accountId of accountIds) {
        const { created } = await enqueueNotification({
          accountId,
          channel: 'push',
          templateKey: 'push',
          sourceType: 'push_broadcast',
          sourceId: campaignId,
          deduplicationKey: `push:${campaignId}:${accountId}`,
          payload,
        })
        if (created) queued += 1
      }
      await audit(req, account, {
        action: 'push.broadcast',
        targetType: 'push',
        targetId: campaignId,
        after: { title, recipients: accountIds.length, queued },
      })
      after(() =>
        drainNotificationOutbox(req).catch((error) =>
          req.payload.logger.error({ err: error }, 'notification drain failed'),
        ),
      )
      return json({ ok: true, campaignId, targeted: accountIds.length, queued }, { status: 202 })
    }),
  },
  {
    path: '/push/admin/summary',
    method: 'get',
    handler: endpoint(async (req) => {
      const { access } = await memberContext(req)
      if (!hasCapability(access, 'accounts.manage'))
        throw fail.forbidden('Platform operator access required.')
      const subscribers = await listSubscriberAccounts()
      return json({
        configured: pushConfigured,
        accounts: subscribers.length,
        devices: subscribers.reduce((total: number, row: any) => total + row.devices, 0),
      })
    }),
  },
  {
    path: '/push/admin/subscribers',
    method: 'get',
    handler: endpoint(async (req) => {
      const { access } = await memberContext(req)
      if (!hasCapability(access, 'accounts.manage'))
        throw fail.forbidden('Platform operator access required.')
      return json({
        configured: pushConfigured,
        items: await listSubscriberAccounts(),
      })
    }),
  },
]
