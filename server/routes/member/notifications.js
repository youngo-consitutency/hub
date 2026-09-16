import { randomUUID } from 'node:crypto'
import { Router } from 'express'
import { recordAudit } from '../../lib/audit.js'
import { appOrigin } from '../../lib/config.js'
import {
  emailConfigured,
  sendTemplatedEmail,
} from '../../lib/notifications/transport.js'
import { renderEmailTemplate } from '../../lib/notifications/templates.js'
import { createEmailVerificationToken } from '../../lib/notifications/verification.js'
import {
  enqueueNotification,
  getNotificationPreferences,
  listEligibleNotificationAccountIds,
  listQueuedNotifications,
  updateNotificationPreferences,
} from '../../lib/notifications/store.js'
import { createRateLimiter } from '../../lib/rateLimit.js'
import { requireAccount, requireCapability } from './guards.js'

export const router = Router()

const verificationLimit = createRateLimiter({
  windowMs: 60 * 60 * 1000,
  max: 4,
  key: (req) => String(req.account?.id || req.ip || 'unknown'),
})
const broadcastLimit = createRateLimiter({
  windowMs: 60 * 60 * 1000,
  max: 4,
  key: (req) => String(req.account?.id || req.ip || 'unknown'),
})

function trustedActionUrl(value) {
  const text = String(value || '').trim()
  if (!text) return null
  const url = new URL(text, appOrigin())
  if (url.origin !== new URL(appOrigin()).origin)
    throw new Error('The action link must point to YOUNGO Hub.')
  return url.toString()
}

router.get('/notifications/preferences', async (req, res, next) => {
  try {
    const account = await requireAccount(req, res)
    if (!account) return
    res.json({
      ...(await getNotificationPreferences(account.id)),
      emailVerified: Boolean(account.emailVerifiedAt),
      deliveryConfigured: emailConfigured(),
    })
  } catch (error) {
    next(error)
  }
})

router.patch('/notifications/preferences', async (req, res, next) => {
  try {
    const account = await requireAccount(req, res)
    if (!account) return
    if (
      !account.emailVerifiedAt &&
      Object.values(req.body?.email || {}).some(Boolean)
    ) {
      return res.status(409).json({
        error: {
          code: 'email_unverified',
          message: 'Verify your email address before enabling email updates.',
        },
      })
    }
    const before = await getNotificationPreferences(account.id)
    const preferences = await updateNotificationPreferences(
      account.id,
      req.body || {},
    )
    await recordAudit({
      actorId: account.id,
      action: 'notification.preferences_updated',
      targetType: 'notification_preference',
      targetId: account.id,
      before,
      after: preferences,
      requestId: req.requestId,
    })
    res.json({ preferences })
  } catch (error) {
    if (
      error.message?.startsWith('Invalid') ||
      error.message?.includes('must')
    ) {
      return res.status(400).json({
        error: { code: 'validation', message: error.message },
      })
    }
    next(error)
  }
})

router.post('/notifications/verify-email/request', async (req, res, next) => {
  try {
    const account = await requireAccount(req, res)
    if (!account) return
    req.account = account
    verificationLimit(req, res, async () => {
      try {
        if (account.emailVerifiedAt)
          return res.json({ ok: true, verified: true })
        if (!emailConfigured()) {
          return res.status(503).json({
            error: {
              code: 'email_not_configured',
              message: 'Email delivery is not configured for this Hub yet.',
            },
          })
        }
        const created = await createEmailVerificationToken(account.id)
        const actionUrl = `${appOrigin()}/api/notifications/verify-email?token=${encodeURIComponent(created.rawToken)}`
        await sendTemplatedEmail({
          to: account.email,
          templateKey: 'verify-email',
          data: { actionUrl, actionLabel: 'Verify email address' },
        })
        console.log(
          JSON.stringify({
            event: 'email_verification_sent',
            accountId: account.id,
          }),
        )
        res.json({ ok: true, verified: false })
      } catch (error) {
        next(error)
      }
    })
  } catch (error) {
    next(error)
  }
})

function broadcastInput(body) {
  const title = String(body?.title || '')
    .trim()
    .slice(0, 160)
  const message = String(body?.message || '')
    .trim()
    .slice(0, 4000)
  const reason = String(body?.reason || '')
    .trim()
    .slice(0, 500)
  if (!title || !message) throw new Error('A title and message are required.')
  if (reason.length < 8)
    throw new Error('Give a reason of at least 8 characters for this send.')
  const type = String(body?.scope?.type || '')
  if (!['all_active', 'working_group', 'team', 'account_ids'].includes(type))
    throw new Error('Choose a valid recipient scope.')
  const values = Array.isArray(body?.scope?.ids)
    ? body.scope.ids.map(String).filter(Boolean).slice(0, 200)
    : []
  if (type !== 'all_active' && !values.length)
    throw new Error('The selected scope is empty.')
  return {
    title,
    message,
    actionUrl: trustedActionUrl(body?.actionUrl),
    reason,
    scope: { type, ids: values },
  }
}

router.post('/admin/notifications/preview', async (req, res, next) => {
  try {
    const account = await requireAccount(req, res)
    if (!account) return
    req.account = account
    if (!(await requireCapability(req, res, 'notifications.send'))) return
    let input
    try {
      input = broadcastInput(req.body)
    } catch (error) {
      return res.status(400).json({
        error: { code: 'validation', message: error.message },
      })
    }
    res.json(
      await renderEmailTemplate('announcement', {
        title: input.title,
        message: input.message,
        actionUrl: input.actionUrl,
        actionLabel: 'Open YOUNGO Hub',
      }),
    )
  } catch (error) {
    next(error)
  }
})

router.post(
  '/admin/notifications/send',
  async (req, res, next) => {
    try {
      const account = await requireAccount(req, res)
      if (!account) return
      req.account = account
      if (!(await requireCapability(req, res, 'notifications.send'))) return
      next()
    } catch (error) {
      next(error)
    }
  },
  broadcastLimit,
  async (req, res, next) => {
    try {
      const account = req.account
      if (!emailConfigured()) {
        return res.status(503).json({
          error: {
            code: 'email_not_configured',
            message: 'Email delivery is not configured for this Hub yet.',
          },
        })
      }
      let input
      try {
        input = broadcastInput(req.body)
      } catch (error) {
        return res.status(400).json({
          error: { code: 'validation', message: error.message },
        })
      }
      const eligible = await listEligibleNotificationAccountIds({
        category: 'announcement',
        scope: input.scope,
      })
      const campaignId =
        String(req.get('x-idempotency-key') || '')
          .trim()
          .slice(0, 120) || randomUUID()
      let queued = 0
      for (const recipientId of eligible) {
        const result = await enqueueNotification({
          accountId: recipientId,
          category: 'announcement',
          templateKey: 'announcement',
          sourceType: 'admin_broadcast',
          sourceId: campaignId,
          deduplicationKey: `announcement:${campaignId}:${recipientId}`,
          payload: {
            title: input.title,
            message: input.message,
            actionUrl: input.actionUrl,
            actionLabel: 'Open YOUNGO Hub',
          },
        })
        if (result.created) queued += 1
      }
      await recordAudit({
        actorId: account.id,
        action: 'email.broadcast_queued',
        targetType: 'email_campaign',
        targetId: campaignId,
        after: {
          category: 'announcement',
          scope: input.scope,
          eligibleRecipients: eligible.length,
          queuedRecipients: queued,
        },
        reason: input.reason,
        requestId: req.requestId,
      })
      res.status(202).json({
        ok: true,
        campaignId,
        eligible: eligible.length,
        queued,
      })
    } catch (error) {
      next(error)
    }
  },
)

router.get('/admin/notifications/outbox', async (req, res, next) => {
  try {
    const account = await requireAccount(req, res)
    if (!account) return
    req.account = account
    if (!(await requireCapability(req, res, 'notifications.send'))) return
    res.json({ items: await listQueuedNotifications() })
  } catch (error) {
    next(error)
  }
})
