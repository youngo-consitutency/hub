import type { Endpoint, PayloadRequest } from 'payload'
import { ApiError, endpoint, fail, json } from '../lib/respond'
import { accountView, requireAccount } from '../lib/accounts'
import { getAccessProfile, hasCapability } from '../lib/access'
import { getPgPool } from '../lib/pg'
import * as store from '../lib/content'
import { rateLimit } from '../lib/rateLimit'
import { emailConfigured, sendEmail } from '../lib/email'
import {
  POINT_REASONS,
  RECOGNITION_TIERS,
  awardOrgPoints,
  canAwardPoints,
  listAwardSuggestions,
  listOrgPointBalances,
  listRecentPointAwards,
  reasonFromNgoRequestKind,
} from '../lib/points'
import {
  deleteSubscription,
  deliverPush,
  listAllSubscriptions,
  listSubscriberAccounts,
  listSubscriptionsForAccounts,
  pushConfigured,
  saveSubscription,
} from '../lib/push'
import {
  enqueueNotification,
  listEligibleNotificationAccountIds,
  listQueuedNotifications,
  markNotificationFailed,
  markNotificationSent,
  renderEmailTemplate,
  sendTemplatedEmail,
  unsubscribeUrl,
} from '../lib/notifications'
import { createHash, createHmac, randomBytes, randomUUID, timingSafeEqual } from 'node:crypto'

const isVerified = (account: any) =>
  account?.hubAccessStatus === 'active' &&
  (account?.memberStatus === 'verified' ||
    ['admin', 'focal_point'].includes(account?.role))

const verifiedAccount = (req: PayloadRequest) => {
  const account = requireAccount(req)
  if (!isVerified(account))
    throw new ApiError(
      403,
      'not_verified',
      'Complete the membership course to use this feature.',
    )
  return account
}

const sha256 = (v: string) => createHash('sha256').update(v).digest('hex')
const trimmed = (v: unknown, max: number) =>
  String(v ?? '')
    .replace(/<[^>]*>/g, '')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, max)

const CONTRIBUTION_KINDS = [
  { value: 'question', label: 'Question' },
  { value: 'concern', label: 'Concern' },
  { value: 'comment', label: 'Comment' },
  { value: 'feature', label: 'New feature' },
]
const CONTRIBUTION_SECTIONS = [
  { value: 'general', label: 'Whole consultation' },
  { value: 'open', label: 'Open' },
  { value: 'aims', label: 'Aims' },
  { value: 'need', label: 'Need' },
  { value: 'security', label: 'Security' },
  { value: 'concerns', label: 'Concerns' },
  { value: 'uses', label: 'Features' },
  { value: 'serve', label: 'Who it serves' },
  { value: 'safeguards', label: 'Safeguards' },
  { value: 'agree', label: 'Agree' },
  { value: 'next', label: 'Next steps' },
]

const consultationLimit = rateLimit({
  windowMs: 10 * 60 * 1000,
  max: 8,
  scope: 'consultation',
})
const verificationLimit = rateLimit({
  windowMs: 60 * 60 * 1000,
  max: 5,
  scope: 'verify-email',
})
const intelligenceLimit = rateLimit({
  windowMs: 60 * 1000,
  max: 30,
  scope: 'intelligence',
})

const EMAIL_CATEGORIES = ['digest', 'deadline', 'announcement']

function unsubscribeSecret() {
  return (
    String(process.env.EMAIL_UNSUBSCRIBE_SECRET || '').trim() ||
    process.env.PAYLOAD_SECRET ||
    'youngo-development-unsubscribe-secret'
  )
}

function unsubSignature(payload: string) {
  return createHmac('sha256', unsubscribeSecret())
    .update(payload)
    .digest('base64url')
}

function verifyUnsubscribeToken(token: string) {
  const [payload, supplied] = String(token || '').split('.')
  if (!payload || !supplied) return null
  const expected = unsubSignature(payload)
  const left = Buffer.from(supplied)
  const right = Buffer.from(expected)
  if (left.length !== right.length || !timingSafeEqual(left, right)) return null
  try {
    const parsed = JSON.parse(
      Buffer.from(payload, 'base64url').toString('utf8'),
    )
    if (
      parsed.v !== 1 ||
      !parsed.accountId ||
      !EMAIL_CATEGORIES.includes(parsed.category)
    )
      return null
    return { accountId: String(parsed.accountId), category: parsed.category }
  } catch {
    return null
  }
}

const resultPage = (title: string, message: string) =>
  `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${title}</title></head><body style="font-family:system-ui,sans-serif;max-width:42rem;margin:4rem auto;padding:0 1rem;color:#14251d"><h1>${title}</h1><p>${message}</p><p><a href="/profile">Return to YOUNGO Hub</a></p></body></html>`

const html = (body: string, status = 200) =>
  new Response(body, {
    status,
    headers: { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'no-store' },
  })

// ─── Intelligence query ─────────────────────────────────────────────

type Evidence = {
  evidenceId: string
  sourceType: string
  title: string
  snippet: string
  url: string
}

async function evidenceForQuery(
  req: PayloadRequest,
  query: string,
  access: any,
  limit: number,
): Promise<Evidence[]> {
  const needle = query.toLowerCase()
  const terms = needle.split(/[^a-z0-9]+/).filter((t) => t.length >= 3)
  const evidence: Evidence[] = []
  const push = (
    sourceType: string,
    title: string,
    snippet: string,
    url: string,
  ) => {
    const score = terms.reduce(
      (n, t) =>
        n +
        (title.toLowerCase().includes(t) ? 3 : 0) +
        (snippet.toLowerCase().includes(t) ? 1 : 0),
      0,
    )
    if (score > 0) {
      evidence.push({
        evidenceId: `${sourceType}:${evidence.length + 1}`,
        sourceType,
        title,
        snippet: snippet.slice(0, 280),
        url,
      })
      ;(evidence[evidence.length - 1] as any).score = score
    }
  }

  const [events, announcements, groups, submissions, decisions] =
    await Promise.all([
      store.listEvents(req),
      store.listAnnouncements(req),
      store.listGroups(req),
      store.listSubmissions(req, 'all'),
      store.listCouncil(req, 'all'),
    ])
  for (const e of events)
    push('event', e.title, e.description || '', `/events/${e.slug}`)
  for (const a of announcements)
    push('announcement', a.title, a.body || '', `/announcements/${a.slug}`)
  for (const g of groups)
    push('working_group', g.name, g.focusLine || g.description || '', `/groups/${g.slug}`)
  for (const s of submissions)
    push('submission', s.title, s.summary || '', `/submissions/${s.slug}`)
  for (const d of decisions)
    push('council_decision', d.title, d.summary || '', `/decisions/${d.slug}`)
  if (hasCapability(access, 'intelligence.contacts.read')) {
    for (const c of await store.listDirectory(req))
      push('contact', c.name, c.role || '', `/directory`)
  }
  // Members always see their own role/assignment context
  if (access.accountId) {
    for (const a of access.assignments || [])
      push(
        'assignment',
        `Your role: ${a.role}`,
        `Scope: ${a.scopeType} ${a.scopeId || ''}`,
        '/profile',
      )
  }
  evidence.sort((a, b) => (b as any).score - (a as any).score)
  return evidence.slice(0, Math.max(1, Math.min(25, limit)))
}

const writebackView = (row: any) => ({
  id: row.id,
  kind: row.kind,
  title: row.title,
  note: row.note,
  citations: row.citations,
  status: row.status,
  accountId:
    typeof row.account === 'object' ? row.account?.id : row.account,
  accountEmail:
    typeof row.account === 'object' ? row.account?.email : null,
  idempotencyKey: row.idempotencyKey || null,
  approvedBy:
    typeof row.approvedBy === 'object' ? row.approvedBy?.id : row.approvedBy,
  appliedBy:
    typeof row.appliedBy === 'object' ? row.appliedBy?.id : row.appliedBy,
  appliedAt: row.appliedAt || null,
  reviewedAt: row.reviewedAt || null,
  createdAt: row.createdAt,
})

// Keyed on the account rather than the caller IP — venue networks share IPs.
const pushTestLimit = rateLimit({
  windowMs: 60_000,
  max: 5,
  scope: 'push-test',
  key: (req) => String((req as any).user?.id || 'anon'),
})
const pushSendLimit = rateLimit({ windowMs: 60_000, max: 10, scope: 'push-send' })

const broadcastLimit = rateLimit({
  windowMs: 60 * 60 * 1000,
  max: 4,
  scope: 'notifications-broadcast',
  key: (req) => String((req as any).user?.id || 'anon'),
})

function trustedActionUrl(value: any) {
  const text = String(value || '').trim()
  if (!text) return null
  const url = new URL(
    text,
    String(process.env.APP_BASE_URL || 'http://localhost:3000'),
  )
  if (
    url.origin !==
    new URL(process.env.APP_BASE_URL || 'http://localhost:3000').origin
  )
    throw Object.assign(
      new Error('The action link must point to YOUNGO Hub.'),
      { code: 'validation' },
    )
  return url.toString()
}

function broadcastInput(body: any) {
  const title = String(body?.title || '').trim().slice(0, 160)
  const message = String(body?.message || '').trim().slice(0, 4000)
  const reason = String(body?.reason || '').trim().slice(0, 500)
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

const requireNotifyCapability = async (req: any) => {
  const account = requireAccount(req)
  const access = await getAccessProfile(req, account)
  if (!access.capabilities.includes('notifications.send'))
    throw fail.forbidden('Sending Hub email is not assigned to this account.')
  return account
}

export const miscEndpoints: Endpoint[] = [
  // ── Consultation floor ────────────────────────────────────────────
  {
    path: '/consultation/kinds',
    method: 'get',
    handler: endpoint(async () =>
      json(
        { kinds: CONTRIBUTION_KINDS, sections: CONTRIBUTION_SECTIONS },
        { headers: { 'Cache-Control': 'no-store' } },
      ),
    ),
  },
  {
    path: '/consultation/contributions',
    method: 'get',
    handler: endpoint(async (req) => {
      const where: any = {}
      if (req.query?.kind) where.kind = { equals: req.query.kind }
      if (req.query?.section) where.section = { equals: req.query.section }
      const { docs } = await req.payload.find({
        collection: 'consultation-contributions',
        where,
        sort: 'createdAt',
        limit: Math.min(300, Number(req.query?.limit || 100)),
        overrideAccess: true,
      })
      return json(
        {
          items: (docs as any[]).map((row) => ({
            id: row.id,
            kind: row.kind,
            body: row.body,
            name: row.displayName || null,
            section: row.section,
            createdAt: row.createdAt,
          })),
        },
        { headers: { 'Cache-Control': 'no-store' } },
      )
    }),
  },
  {
    path: '/consultation/contributions',
    method: 'post',
    handler: endpoint(async (req) => {
      consultationLimit(req)
      const b = ((await req.json?.()) || {}) as any
      if (b.website) return json({ ok: true, item: null }, { status: 201 })
      const kind = String(b.kind || '')
      if (!CONTRIBUTION_KINDS.some((k) => k.value === kind))
        throw fail.validation({ kind: 'Choose question, concern, comment, or new feature.' })
      const body = trimmed(b.body, 800)
      if (body.length < 8)
        throw fail.validation({
          body: 'Write at least a short sentence so the room can use it.',
        })
      const section = CONTRIBUTION_SECTIONS.some((s) => s.value === b.section)
        ? b.section
        : 'general'
      const item = await req.payload.create({
        collection: 'consultation-contributions',
        data: {
          kind,
          body,
          displayName: trimmed(b.name, 80) || null,
          section,
        } as any,
        overrideAccess: true,
        req,
      })
      return json(
        {
          ok: true,
          item: {
            id: item.id,
            kind,
            body,
            name: trimmed(b.name, 80) || null,
            section,
            createdAt: (item as any).createdAt,
          },
        },
        { status: 201 },
      )
    }),
  },

  // ── Push notifications ────────────────────────────────────────────
  {
    path: '/push/vapid-key',
    method: 'get',
    handler: endpoint(async () => {
      if (!pushConfigured)
        throw new ApiError(
          503,
          'push_not_configured',
          'Push notifications are not configured.',
        )
      return json({ publicKey: process.env.VAPID_PUBLIC_KEY })
    }),
  },
  {
    path: '/push/subscribe',
    method: 'post',
    handler: endpoint(async (req) => {
      const account = requireAccount(req)
      if (!pushConfigured)
        throw new ApiError(
          503,
          'push_not_configured',
          'Push notifications are not configured.',
        )
      const b = ((await req.json?.()) || {}) as any
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
        if (
          ['invalid_push_endpoint', 'push_subscription_limit'].includes(
            error.code,
          )
        )
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
      const b = ((await req.json?.()) || {}) as any
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
      pushTestLimit(req)
      if (!pushConfigured)
        throw new ApiError(
          503,
          'push_not_configured',
          'Push notifications are not configured.',
        )
      const rows = await listSubscriptionsForAccounts([account.id])
      if (!rows.length)
        throw new ApiError(404, 'no_subscriptions', 'Subscribe on this device first.')
      const b = ((await req.json?.()) || {}) as any
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
      const account = requireAccount(req)
      if (account.role !== 'admin')
        throw fail.forbidden('Admin access required.')
      pushSendLimit(req)
      if (!pushConfigured)
        throw new ApiError(
          503,
          'push_not_configured',
          'Push notifications are not configured.',
        )
      const b = ((await req.json?.()) || {}) as any
      const { userIds, title, body, icon, badge, tag, data, requireInteraction } = b
      const targetAll = userIds === 'all'
      if (!targetAll && (!Array.isArray(userIds) || !userIds.length))
        throw fail.validation({ userIds: 'Provide userIds as an array, or "all".' })
      if (!title || !body)
        throw fail.validation({ title: 'A title and body are required.' })
      const rows = targetAll
        ? await listAllSubscriptions()
        : await listSubscriptionsForAccounts(userIds)
      if (!rows.length)
        throw new ApiError(
          404,
          'no_subscriptions',
          'No active subscriptions for those members.',
        )
      const payload = JSON.stringify({
        title,
        body,
        icon: icon || '/icons/icon-192.png',
        badge: badge || '/icons/icon-72.png',
        tag: tag || 'youngo-notification',
        data: data || { url: '/' },
        requireInteraction: Boolean(requireInteraction),
      })
      const result = await deliverPush(rows, payload)
      await req.payload.create({
        collection: 'audit-log',
        data: {
          actor: account.id,
          action: 'push.broadcast',
          targetType: 'push',
          targetId: targetAll ? 'all' : userIds.join(','),
          after: { title, recipients: result.total, sent: result.sent },
        } as any,
        overrideAccess: true,
        req,
      })
      return json({ ok: true, ...result })
    }),
  },
  {
    path: '/push/admin/summary',
    method: 'get',
    handler: endpoint(async (req) => {
      const account = requireAccount(req)
      if (account.role !== 'admin')
        throw fail.forbidden('Admin access required.')
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
      const account = requireAccount(req)
      if (account.role !== 'admin')
        throw fail.forbidden('Admin access required.')
      return json({
        configured: pushConfigured,
        items: await listSubscriberAccounts(),
      })
    }),
  },

  {
    path: '/member/admin/notifications/preview',
    method: 'post',
    handler: endpoint(async (req) => {
      await requireNotifyCapability(req)
      const b = ((await req.json?.()) || {}) as any
      let input
      try {
        input = broadcastInput(b)
      } catch (error: any) {
        throw new ApiError(400, 'validation', error.message)
      }
      return json(
        renderEmailTemplate('announcement', {
          title: input.title,
          message: input.message,
          actionUrl: input.actionUrl,
          actionLabel: 'Open YOUNGO Hub',
        }),
      )
    }),
  },
  {
    path: '/member/admin/notifications/send',
    method: 'post',
    handler: endpoint(async (req) => {
      const account = await requireNotifyCapability(req)
      broadcastLimit(req)
      if (!emailConfigured())
        throw new ApiError(
          503,
          'email_not_configured',
          'Email delivery is not configured for this Hub yet.',
        )
      const b = ((await req.json?.()) || {}) as any
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
        String(req.headers.get('x-idempotency-key') || '').trim().slice(0, 120) ||
        randomUUID()
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
      await req.payload.create({
        collection: 'audit-log',
        data: {
          actor: account.id,
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
        } as any,
        overrideAccess: true,
        req,
      })
      // v2 has no background scheduler: drain the campaign inline so queued
      // rows actually deliver (dedup guards re-sends).
      const pool = getPgPool()
      if (pool) {
        const { rows } = await pool.query(
          `SELECT o.*, a.email AS recipient_email
           FROM notification_outbox o
           JOIN accounts a ON a.id = o.account_id
           WHERE o.source_id = $1 AND o.status = 'queued'`,
          [campaignId],
        )
        for (const row of rows) {
          try {
            await sendTemplatedEmail({
              to: row.recipient_email,
              templateKey: row.template_key,
              data: row.payload || {},
              unsubscribe: unsubscribeUrl(row.account_id, row.category),
            })
            await markNotificationSent(row.id)
          } catch (error: any) {
            await markNotificationFailed(row.id, error.code || 'send_failed')
          }
        }
      }
      return json(
        { ok: true, campaignId, eligible: eligible.length, queued },
        { status: 202 },
      )
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

  // ── Notifications misc ────────────────────────────────────────────
  {
    path: '/notifications/unsubscribe',
    method: 'get',
    handler: async (req) => {
      const verified = verifyUnsubscribeToken(
        String((req as any).query?.token || ''),
      )
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
          tokenHash: { equals: sha256(token) },
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
      const accountId =
        typeof row.account === 'object' ? row.account.id : row.account
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
      await req.payload.create({
        collection: 'audit-log',
        data: {
          actor: accountId,
          action: 'account.email_verified',
          targetType: 'account',
          targetId: String(accountId),
        } as any,
        overrideAccess: true,
        req,
      })
      return Response.redirect(
        `${process.env.APP_BASE_URL || 'http://localhost:3000'}/profile?emailVerified=1`,
        303,
      )
    },
  },
  {
    path: '/member/notifications/verify-email/request',
    method: 'post',
    handler: endpoint(async (req) => {
      verificationLimit(req)
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
          tokenHash: sha256(token),
          expiresAt: new Date(Date.now() + 24 * 3600 * 1000).toISOString(),
        } as any,
        overrideAccess: true,
        req,
      })
      const base = process.env.APP_BASE_URL || 'http://localhost:3000'
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
      if (left.length !== right.length || !timingSafeEqual(left, right))
        throw fail.unauthorized()
      const b = ((await req.json?.()) || {}) as any
      // Provider events are recorded for audit; suppression handled when email
      // delivery is wired to a real provider.
      await req.payload.create({
        collection: 'audit-log',
        data: {
          action: 'notification.provider_event',
          after: {
            type: trimmed(b.type, 80),
            received: true,
          },
        } as any,
        overrideAccess: true,
        req,
      })
      return json({ ok: true })
    }),
  },

  // ── Intelligence (citation-first search + writeback review) ───────
  {
    path: '/intelligence/query',
    method: 'post',
    handler: endpoint(async (req) => {
      intelligenceLimit(req)
      const account = verifiedAccount(req)
      const access = await getAccessProfile(req, account)
      const b = ((await req.json?.()) || {}) as any
      const query = String(b.query || '').trim()
      if (query.length < 3 || query.length > 500)
        throw fail.validation({ query: 'Ask a question of 3–500 characters.' })
      const limit = Number(b.limit || 10)
      const evidence = await evidenceForQuery(req, query, access, limit)
      const bullets = evidence.slice(0, 4).map((e, i) => ({
        text: `${e.title} — ${e.snippet || e.sourceType}`,
        citationIndexes: [i + 1],
      }))
      const answer = evidence.length
        ? `Found ${evidence.length} relevant record${evidence.length === 1 ? '' : 's'} across the Hub.`
        : 'No directly matching records were found. Try a more specific title, working group, deadline, or location.'
      await req.payload.create({
        collection: 'audit-log',
        data: {
          actor: account.id,
          actorEmail: account.email,
          action: 'intelligence.query',
          after: { queryLength: query.length, results: evidence.length },
        } as any,
        overrideAccess: true,
        req,
      })
      return json({
        query,
        audience: account.role === 'admin' ? 'admin' : 'member',
        evidence,
        citations: evidence.map((e, i) => ({ ...e, evidenceId: `E${i + 1}` })),
        synthesis: {
          answer,
          bullets: bullets.map((bl) => ({
            ...bl,
            citationIndexes: bl.citationIndexes,
          })),
          confidence: evidence.length >= 4 ? 'medium' : evidence.length ? 'low' : 'none',
          caveat:
            'This synthesis is derived only from records your account can access; verify the cited sources before acting on it.',
        },
      })
    }),
  },
  {
    path: '/intelligence/writebacks',
    method: 'get',
    handler: endpoint(async (req) => {
      const account = verifiedAccount(req)
      const isAdmin = account.role === 'admin'
      const where: any = isAdmin ? {} : { account: { equals: account.id } }
      const { docs } = await req.payload.find({
        collection: 'research-notes',
        where,
        sort: '-createdAt',
        limit: 100,
        overrideAccess: true,
        depth: 1,
      })
      return json({ items: docs.map(writebackView) })
    }),
  },
  {
    path: '/intelligence/writebacks',
    method: 'post',
    handler: endpoint(async (req) => {
      intelligenceLimit(req)
      const account = verifiedAccount(req)
      const b = ((await req.json?.()) || {}) as any
      if (b.action !== 'save_research_note')
        throw fail.validation({ action: 'Unsupported writeback action.' })
      const title = trimmed(b.title, 160)
      const note = trimmed(b.note || b.body, 4000)
      const citations = Array.isArray(b.citations) ? b.citations.slice(0, 50) : []
      if (!title || !note || !citations.length)
        throw fail.validation({
          note: 'A research note needs a title, body, and at least one citation.',
        })
      const idempotencyKey = String(
        req.headers.get('idempotency-key') || b.idempotencyKey || '',
      ).slice(0, 120)
      if (idempotencyKey) {
        const dup = await req.payload.find({
          collection: 'research-notes',
          where: {
            account: { equals: account.id },
            idempotencyKey: { equals: idempotencyKey },
          },
          limit: 1,
          overrideAccess: true,
        })
        if (dup.docs[0])
          return json({ item: writebackView(dup.docs[0]) }, { status: 200 })
      }
      const item = await req.payload.create({
        collection: 'research-notes',
        data: {
          account: account.id,
          title,
          note,
          citations,
          status: 'pending_review',
          idempotencyKey: idempotencyKey || null,
        } as any,
        overrideAccess: true,
        req,
      })
      await req.payload.create({
        collection: 'audit-log',
        data: {
          actor: account.id,
          actorEmail: account.email,
          action: 'intelligence.writeback_proposed',
          targetType: 'research_note',
          targetId: String(item.id),
        } as any,
        overrideAccess: true,
        req,
      })
      return json({ item: writebackView(item) }, { status: 201 })
    }),
  },
  {
    path: '/intelligence/writebacks/:id/approve',
    method: 'post',
    handler: endpoint(async (req) => {
      const account = verifiedAccount(req)
      if (account.role !== 'admin')
        throw fail.forbidden('Research notes are approved by administrators.')
      const id = String(req.routeParams?.id)
      const row = (await req.payload.findByID({
        collection: 'research-notes',
        id,
        overrideAccess: true,
        req,
      })) as any
      if (!row) throw fail.notFound()
      if (String(typeof row.account === 'object' ? row.account.id : row.account) === String(account.id))
        throw new ApiError(
          409,
          'separation_of_duties',
          'A research note must be approved by a different administrator than its author.',
        )
      if (!['pending_review', 'draft'].includes(row.status))
        throw new ApiError(409, 'conflict', 'This note was already reviewed.')
      const updated = await req.payload.update({
        collection: 'research-notes',
        id,
        data: {
          status: 'approved',
          approvedBy: account.id,
          reviewedAt: new Date().toISOString(),
        } as any,
        overrideAccess: true,
        req,
      })
      await req.payload.create({
        collection: 'audit-log',
        data: {
          actor: account.id,
          action: 'intelligence.writeback_approved',
          targetType: 'research_note',
          targetId: id,
        } as any,
        overrideAccess: true,
        req,
      })
      return json({ item: writebackView(updated) })
    }),
  },
  {
    path: '/intelligence/writebacks/:id/apply',
    method: 'post',
    handler: endpoint(async (req) => {
      const account = verifiedAccount(req)
      if (account.role !== 'admin')
        throw fail.forbidden('Research notes are applied by administrators.')
      const id = String(req.routeParams?.id)
      const row = (await req.payload.findByID({
        collection: 'research-notes',
        id,
        overrideAccess: true,
        req,
      })) as any
      if (!row) throw fail.notFound()
      if (row.status !== 'approved')
        throw new ApiError(409, 'conflict', 'Only approved notes can be applied.')
      const approverId =
        typeof row.approvedBy === 'object' ? row.approvedBy?.id : row.approvedBy
      if (String(approverId) === String(account.id))
        throw new ApiError(
          409,
          'separation_of_duties',
          'A research note must be applied by a different administrator than its approver.',
        )
      const updated = await req.payload.update({
        collection: 'research-notes',
        id,
        data: {
          status: 'applied',
          appliedBy: account.id,
          appliedAt: new Date().toISOString(),
        } as any,
        overrideAccess: true,
        req,
      })
      await req.payload.create({
        collection: 'audit-log',
        data: {
          actor: account.id,
          action: 'intelligence.writeback_applied',
          targetType: 'research_note',
          targetId: id,
        } as any,
        overrideAccess: true,
        req,
      })
      return json({ item: writebackView(updated) })
    }),
  },
  {
    path: '/intelligence/metrics',
    method: 'get',
    handler: endpoint(async (req) => {
      const account = verifiedAccount(req)
      const isAdmin = account.role === 'admin'
      const where: any = isAdmin ? {} : { account: { equals: account.id } }
      const notes = await req.payload.find({
        collection: 'research-notes',
        where,
        limit: 500,
        overrideAccess: true,
      })
      const byStatus = (notes.docs as any[]).reduce<Record<string, number>>(
        (acc, n) => {
          acc[n.status] = (acc[n.status] || 0) + 1
          return acc
        },
        {},
      )
      return json({
        notesTotal: notes.totalDocs,
        byStatus,
        semanticEnabled: false,
      })
    }),
  },

  // ── Misc member surfaces ──────────────────────────────────────────
  {
    path: '/member/staff/points',
    method: 'get',
    handler: endpoint(async (req) => {
      const account = verifiedAccount(req)
      if (!(await canAwardPoints(req, account)))
        throw fail.forbidden(
          'Only admins, Focal Points, or Membership Team can award NGO contribution points.',
        )
      const [orgs, recent, suggestions] = await Promise.all([
        listOrgPointBalances(),
        listRecentPointAwards({ limit: 40 }),
        listAwardSuggestions({ limit: 40 }),
      ])
      return json({
        orgs,
        recent,
        suggestions,
        reasons: Object.values(POINT_REASONS),
        tiers: RECOGNITION_TIERS,
        defaults: Object.fromEntries(
          Object.values(POINT_REASONS).map((r: any) => [r.code, r.defaultPoints]),
        ),
      })
    }),
  },
  {
    path: '/member/staff/points/award',
    method: 'post',
    handler: endpoint(async (req) => {
      const account = verifiedAccount(req)
      if (!(await canAwardPoints(req, account)))
        throw fail.forbidden(
          'Only admins, Focal Points, or Membership Team can award NGO contribution points.',
        )
      const b = ((await req.json?.()) || {}) as any
      try {
        const result = await awardOrgPoints({
          orgAccountId: b.orgAccountId,
          points: b.points,
          reasonCode: b.reasonCode,
          title: b.title,
          note: b.note,
          relatedType: b.relatedType || (b.requestId ? 'ngo_request' : null),
          relatedId: b.relatedId || b.requestId || null,
          awardedBy: account.id,
        })
        if (!result?.entry)
          throw new ApiError(500, 'award_failed', 'Award could not be recorded.')
        await req.payload.create({
          collection: 'audit-log',
          data: {
            actor: account.id,
            action: 'ngo.points_awarded',
            targetType: 'ngo_points',
            targetId: String(result.entry.id),
            after: result,
            reason: b.note || null,
          } as any,
          overrideAccess: true,
          req,
        })
        return json(result, { status: 201 })
      } catch (err: any) {
        throw new ApiError(
          err.code === 'not_found' ? 404 : 400,
          err.code || 'validation',
          err.message,
        )
      }
    }),
  },
  {
    path: '/member/staff/points/award-suggestion',
    method: 'post',
    handler: endpoint(async (req) => {
      const account = verifiedAccount(req)
      if (!(await canAwardPoints(req, account)))
        throw fail.forbidden(
          'Only admins, Focal Points, or Membership Team can award NGO contribution points.',
        )
      const b = ((await req.json?.()) || {}) as any
      if (!b.requestId || !b.orgAccountId)
        throw fail.validation({ requestId: 'requestId and orgAccountId required.' })
      try {
        const reasonCode =
          b.reasonCode || reasonFromNgoRequestKind(b.kind || 'other')
        const reason = POINT_REASONS[reasonCode] || POINT_REASONS.other
        const result = await awardOrgPoints({
          orgAccountId: b.orgAccountId,
          points: b.points ?? reason.defaultPoints,
          reasonCode,
          title: b.title || reason.label,
          note: b.note || 'Awarded from completed NGO request',
          relatedType: 'ngo_request',
          relatedId: String(b.requestId),
          awardedBy: account.id,
        })
        await req.payload.create({
          collection: 'audit-log',
          data: {
            actor: account.id,
            action: 'ngo.points_awarded_from_request',
            targetType: 'ngo_request',
            targetId: String(b.requestId),
            after: result,
          } as any,
          overrideAccess: true,
          req,
        })
        return json(result, { status: 201 })
      } catch (err: any) {
        throw new ApiError(
          err.code === 'not_found' ? 404 : 400,
          err.code || 'validation',
          err.message,
        )
      }
    }),
  },
  {
    path: '/member/staff/points/reasons',
    method: 'get',
    handler: endpoint(async (req) => {
      const account = verifiedAccount(req)
      if (!(await canAwardPoints(req, account)))
        throw fail.forbidden(
          'Only admins, Focal Points, or Membership Team can award NGO contribution points.',
        )
      return json({
        reasons: Object.values(POINT_REASONS),
        fromRequestKind: {
          endorse: reasonFromNgoRequestKind('endorse'),
          submit: reasonFromNgoRequestKind('submit'),
          represent: reasonFromNgoRequestKind('represent'),
        },
      })
    }),
  },
]
