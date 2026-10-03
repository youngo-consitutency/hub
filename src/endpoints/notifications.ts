import type { Endpoint } from 'payload'
import { after } from 'next/server'
import { ApiError, endpoint, fail, json, readBody } from '../lib/respond'
import { requireAccount, memberContext } from '../lib/accounts'
import { rateLimit } from '../lib/rateLimit'
import { getDocument } from '../lib/documents'
import { emailConfigured, sendEmail } from '../lib/email'
import { hasCapability } from '../lib/access'
import {
  drainNotificationOutbox,
  enqueueNotification,
  listEligibleNotificationAccountIds,
  listQueuedNotifications,
  renderEmailTemplate,
  verifyUnsubscribeToken,
} from '../lib/notifications'
import { randomBytes, randomUUID, timingSafeEqual } from 'node:crypto'
import { audit } from '../lib/audit'
import { appBaseUrl } from '../lib/env'
import { cleanText } from '../lib/text'
import { sha256Hex } from '../lib/crypto'

const verificationLimit = rateLimit({
  windowMs: 60 * 60 * 1000,
  max: 5,
  scope: 'verify-email',
})
const broadcastLimit = rateLimit({
  windowMs: 60 * 60 * 1000,
  max: 4,
  scope: 'notifications-broadcast',
  key: (req) => String((req as any).user?.id || 'anon'),
})

const resultPage = (title: string, message: string) =>
  `<!doctype html><html lang="en-GB"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${title}</title></head><body style="font-family:system-ui,sans-serif;max-width:42rem;margin:4rem auto;padding:0 1rem;color:#14251d"><h1>${title}</h1><p>${message}</p><p><a href="/profile">Return to YOUNGO Hub</a></p></body></html>`

const html = (body: string, status = 200) =>
  new Response(body, {
    status,
    headers: { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'no-store' },
  })

function trustedActionUrl(value: any) {
  const text = String(value || '').trim()
  if (!text) return null
  const url = new URL(text, appBaseUrl())
  if (url.origin !== new URL(appBaseUrl()).origin)
    throw Object.assign(new Error('The action link must point to YOUNGO Hub.'), {
      code: 'validation',
    })
  return url.toString()
}

function broadcastInput(body: any) {
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
  if (reason.length < 8) throw new Error('Give a reason of at least 8 characters for this send.')
  const type = String(body?.scope?.type || '')
  if (!['all_active', 'working_group', 'team', 'account_ids'].includes(type))
    throw new Error('Choose a valid recipient scope.')
  const values = Array.isArray(body?.scope?.ids)
    ? body.scope.ids.map(String).filter(Boolean).slice(0, 200)
    : []
  if (type !== 'all_active' && !values.length) throw new Error('The selected scope is empty.')
  return {
    title,
    message,
    actionUrl: trustedActionUrl(body?.actionUrl),
    reason,
    scope: { type, ids: values },
  }
}

const requireNotifyCapability = async (req: any) => {
  const { account, access } = await memberContext(req)
  if (!hasCapability(access, 'notifications.send'))
    throw fail.forbidden('Sending Hub email is not assigned to this account.')
  return account
}

export const notificationEndpoints: Endpoint[] = [
  {
    path: '/member/admin/notifications/preview',
    method: 'post',
    handler: endpoint(async (req) => {
      await requireNotifyCapability(req)
      const b = await readBody(req)
      let input
      try {
        input = broadcastInput(b)
      } catch (error: any) {
        throw new ApiError(400, 'validation', error.message)
      }
      const connect = (await getDocument(req, 'connect'))?.body
      return json(
        renderEmailTemplate('announcement', {
          title: input.title,
          message: input.message,
          actionUrl: input.actionUrl,
          actionLabel: 'Open YOUNGO Hub',
          socialLinks: connect?.SOCIAL_LINKS || [],
        }),
      )
    }),
  },
  {
    path: '/member/admin/notifications/send',
    method: 'post',
    handler: endpoint(async (req) => {
      const account = await requireNotifyCapability(req)
      await broadcastLimit(req)
      if (!emailConfigured())
        throw new ApiError(
          503,
          'email_not_configured',
          'Email delivery is not configured for this Hub yet.',
        )
      const b = await readBody(req)
      let input
      try {
        input = broadcastInput(b)
      } catch (error: any) {
        throw new ApiError(400, 'validation', error.message)
      }
      const eligible = await listEligibleNotificationAccountIds({
        category: 'announcement',
        scope: input.scope,
      })
      const campaignId =
        String(req.headers.get('x-idempotency-key') || '')
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
      await audit(req, account, {
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
      })
      // Delivery runs after the response: the worker claims the queued rows,
      // retries with backoff, and the cron drain picks up anything left.
      after(() =>
        drainNotificationOutbox(req).catch((error) =>
          req.payload.logger.error({ err: error }, 'notification drain failed'),
        ),
      )
      return json({ ok: true, campaignId, eligible: eligible.length, queued }, { status: 202 })
    }),
  },
  {
    path: '/member/admin/notifications/outbox',
    method: 'get',
    handler: endpoint(async (req) => {
      await requireNotifyCapability(req)
      return json({ items: await listQueuedNotifications() })
    }),
  },
  {
    // Scheduled backstop (vercel.json crons → CRON_SECRET bearer): picks up
    // retried rows and anything an after() drain couldn't finish in time.
    path: '/cron/notifications-drain',
    method: 'get',
    handler: endpoint(async (req) => {
      const secret = String(process.env.CRON_SECRET || '')
      const supplied = String(req.headers.get('authorization') || '')
      const expected = `Bearer ${secret}`
      if (
        !secret ||
        supplied.length !== expected.length ||
        !timingSafeEqual(Buffer.from(supplied), Buffer.from(expected))
      )
        throw fail.unauthorized()
      return json(await drainNotificationOutbox(req, { limit: 200 }))
    }),
  },

  {
    path: '/notifications/unsubscribe',
    method: 'get',
    handler: async (req) => {
      const verified = verifyUnsubscribeToken(String((req as any).query?.token || ''))
      if (!verified)
        return html(
          resultPage(
            'Link not valid',
            'This unsubscribe link is invalid. You can still change email settings from your Profile.',
          ),
          400,
        )
      // disable that category
      const { docs } = await req.payload.find({
        collection: 'notification-prefs',
        where: { account: { equals: verified.accountId } },
        limit: 1,
        overrideAccess: true,
      })
      const row = docs[0] as any
      const email = {
        digest: Boolean(row?.email?.digest),
        deadline: Boolean(row?.email?.deadline),
        announcement: Boolean(row?.email?.announcement),
        [verified.category]: false,
      }
      if (row) {
        await req.payload.update({
          collection: 'notification-prefs',
          id: row.id,
          data: { email } as any,
          overrideAccess: true,
          req,
        })
      } else {
        await req.payload.create({
          collection: 'notification-prefs',
          data: { account: verified.accountId, email } as any,
          overrideAccess: true,
          req,
        })
      }
      return html(
        resultPage(
          'Email preference updated',
          `You will no longer receive ${verified.category} email. Other categories were not changed.`,
        ),
      )
    },
  },
  {
    path: '/notifications/verify-email',
    method: 'get',
    handler: async (req) => {
      const token = String((req as any).query?.token || '')
      const { docs } = await req.payload.find({
        collection: 'email-verification-tokens',
        where: {
          tokenHash: { equals: sha256Hex(token) },
          usedAt: { exists: false },
          expiresAt: { greater_than: new Date().toISOString() },
        },
        limit: 1,
        overrideAccess: true,
      })
      const row = docs[0] as any
      if (!row)
        return html(
          resultPage(
            'Verification link not valid',
            'This verification link is invalid or expired. Request another from your Profile.',
          ),
          400,
        )
      const accountId = typeof row.account === 'object' ? row.account.id : row.account
      await req.payload.update({
        collection: 'email-verification-tokens',
        id: row.id,
        data: { usedAt: new Date().toISOString() } as any,
        overrideAccess: true,
        req,
      })
      await req.payload.update({
        collection: 'accounts',
        id: accountId,
        data: { emailVerifiedAt: new Date().toISOString() } as any,
        overrideAccess: true,
        req,
      })
      await audit(
        req,
        { id: accountId },
        {
          action: 'account.email_verified',
          targetType: 'account',
          targetId: String(accountId),
        },
      )
      return Response.redirect(`${appBaseUrl()}/profile?emailVerified=1`, 303)
    },
  },
  {
    path: '/member/notifications/verify-email/request',
    method: 'post',
    handler: endpoint(async (req) => {
      await verificationLimit(req)
      const account = requireAccount(req)
      if (account.emailVerifiedAt) return json({ ok: true, verified: true })
      if (!emailConfigured())
        throw new ApiError(
          503,
          'email_not_configured',
          'Email delivery is not configured for this Hub yet.',
        )
      const token = randomBytes(24).toString('hex')
      await req.payload.create({
        collection: 'email-verification-tokens',
        data: {
          account: account.id,
          tokenHash: sha256Hex(token),
          expiresAt: new Date(Date.now() + 24 * 3600 * 1000).toISOString(),
        } as any,
        overrideAccess: true,
        req,
      })
      const base = appBaseUrl()
      const actionUrl = `${base}/api/notifications/verify-email?token=${encodeURIComponent(token)}`
      const { delivered } = await sendEmail({
        to: account.email,
        subject: 'Verify your YOUNGO Hub email address',
        text: `Verify your email address: ${actionUrl}\n\nThis link expires in 24 hours.`,
      })
      if (!delivered)
        throw new ApiError(
          502,
          'email_delivery_failed',
          'The email provider did not accept the verification email.',
        )
      return json({ ok: true, verified: false })
    }),
  },
  {
    path: '/notifications/provider-events',
    method: 'post',
    handler: endpoint(async (req) => {
      const expected = String(process.env.EMAIL_WEBHOOK_SECRET || '')
      const supplied = String(req.headers.get('x-email-webhook-secret') || '')
      if (!expected || !supplied) throw fail.unauthorized()
      const left = Buffer.from(expected)
      const right = Buffer.from(supplied)
      if (left.length !== right.length || !timingSafeEqual(left, right)) throw fail.unauthorized()
      const b = await readBody(req)
      // Provider events are recorded for audit; suppression handled when email
      // delivery is wired to a real provider.
      await audit(req, null, {
        action: 'notification.provider_event',
        after: {
          type: cleanText(b.type, 80),
          received: true,
        },
      })
      return json({ ok: true })
    }),
  },

  // ── Notification preferences ──────────────────────────────────────
  {
    path: '/member/notifications/preferences',
    method: 'get',
    handler: endpoint(async (req) => {
      const account = requireAccount(req)
      const { docs } = await req.payload.find({
        collection: 'notification-prefs',
        where: { account: { equals: account.id } },
        limit: 1,
        overrideAccess: true,
      })
      const row = docs[0] as any
      return json({
        accountId: account.id,
        timezone: row?.timezone || 'UTC',
        digestDay: row?.digestDay ?? 1,
        digestHourUtc: row?.digestHourUtc ?? 6,
        email: {
          digest: Boolean(row?.email?.digest),
          deadline: Boolean(row?.email?.deadline),
          announcement: Boolean(row?.email?.announcement),
        },
        emailVerified: Boolean(account.emailVerifiedAt),
        deliveryConfigured: Boolean(process.env.SMTP_URL || process.env.SMTP_HOST),
      })
    }),
  },
  {
    path: '/member/notifications/preferences',
    method: 'patch',
    handler: endpoint(async (req) => {
      const account = requireAccount(req)
      const b = await readBody(req)
      if (!account.emailVerifiedAt && Object.values(b?.email || {}).some(Boolean)) {
        return json(
          {
            error: {
              code: 'email_unverified',
              message: 'Verify your email address before enabling email updates.',
            },
          },
          { status: 409 },
        )
      }
      const timezone = String(b.timezone || 'UTC').trim()
      const digestDay = Number(b.digestDay ?? 1)
      const digestHourUtc = Number(b.digestHourUtc ?? 6)
      try {
        new Intl.DateTimeFormat('en', { timeZone: timezone }).format()
      } catch {
        throw fail.validation({ timezone: 'Invalid timezone.' })
      }
      if (!Number.isInteger(digestDay) || digestDay < 0 || digestDay > 6)
        throw fail.validation({ digestDay: 'Digest day must be between 0 and 6.' })
      if (!Number.isInteger(digestHourUtc) || digestHourUtc < 0 || digestHourUtc > 23)
        throw fail.validation({ digestHourUtc: 'Digest hour must be between 0 and 23.' })
      const email = {
        digest: Boolean(b.email?.digest),
        deadline: Boolean(b.email?.deadline),
        announcement: Boolean(b.email?.announcement),
      }
      const { docs } = await req.payload.find({
        collection: 'notification-prefs',
        where: { account: { equals: account.id } },
        limit: 1,
        overrideAccess: true,
      })
      const data = { account: account.id, timezone, digestDay, digestHourUtc, email }
      const row = docs[0] as any
      const saved = row
        ? await req.payload.update({
            collection: 'notification-prefs',
            id: row.id,
            data: data as any,
            overrideAccess: true,
            req,
          })
        : await req.payload.create({
            collection: 'notification-prefs',
            data: data as any,
            overrideAccess: true,
            req,
          })
      return json({ preferences: saved })
    }),
  },
]
