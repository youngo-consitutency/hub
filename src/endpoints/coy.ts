import type { AnyValue, Doc } from '../lib/domain'
import type { Endpoint, PayloadRequest } from 'payload'
import { after } from 'next/server'
import { randomUUID } from 'node:crypto'
import { ApiError, endpoint, fail, json, readBody, param } from '../lib/respond'
import { requireAccount, verifiedContext } from '../lib/accounts'
import { canManageWg, getAccessProfile } from '../lib/access'
import { audit } from '../lib/audit'
import { rateLimit } from '../lib/rateLimit'
import { cleanParagraphs, cleanText } from '../lib/text'
import { appBaseUrl } from '../lib/env'
import { emailConfigured } from '../lib/email'
import { listSubscriptionsForAccounts, pushConfigured } from '../lib/push'
import { isUniqueViolation } from '../lib/pg'
import {
  drainNotificationOutbox,
  enqueueNotification,
  listEligibleNotificationAccountIds,
} from '../lib/notifications'

const CHANNELS = ['hub', 'push', 'email']
const MAX_EMAILS = 500
const INACTIVE_MEMBERSHIP = ['expired', 'terminated', 'rejected']

const allowlistLimit = rateLimit({ windowMs: 60 * 60 * 1000, max: 30, scope: 'coy-allowlist' })
const announceLimit = rateLimit({ windowMs: 60 * 60 * 1000, max: 12, scope: 'coy-announce' })

// COY organisers are whoever manages the coy working group (its contact
// points, or focal points through wg.manage_all).
const isOrganiser = (access: AnyValue) => canManageWg(access, 'coy')

async function liveCoy(req: PayloadRequest) {
  const { docs } = await req.payload.find({
    collection: 'content-coys',
    where: { slug: { equals: param(req, 'slug') }, liveOps: { equals: true } },
    limit: 1,
    overrideAccess: true,
  })
  if (!docs[0]) throw fail.notFound('This conference has no live operations.')
  return docs[0] as Doc
}

async function organiserContext(req: PayloadRequest) {
  const { account, access } = await verifiedContext(req)
  if (!isOrganiser(access)) throw fail.forbidden('Only COY organisers can manage participants.')
  return { account, access, coy: await liveCoy(req) }
}

async function participantRows(req: PayloadRequest, coyId: AnyValue) {
  const { docs } = await req.payload.find({
    collection: 'coy-participants',
    where: { coy: { equals: coyId } },
    depth: 1,
    limit: 5000,
    pagination: false,
    overrideAccess: true,
  })
  return docs as Doc[]
}

const accountId = (row: Doc) =>
  String(typeof row.account === 'object' ? row.account?.id : row.account)

async function audienceSummary(rows: Doc[]) {
  const ids = rows.map(accountId)
  const [emailEligible, devices] = ids.length
    ? await Promise.all([
        listEligibleNotificationAccountIds({
          category: 'group_mail',
          scope: { type: 'account_ids', ids },
        }),
        listSubscriptionsForAccounts(ids),
      ])
    : [[], []]
  return {
    participants: ids.length,
    emailEligible: emailEligible.length,
    pushDevices: devices.length,
    emailIds: emailEligible,
  }
}

const noticeView = (n: Doc) => ({
  id: n.id,
  title: n.title,
  body: n.body,
  channels: n.channels || [],
  createdAt: n.createdAt,
})

export function parseEmails(value: AnyValue): string[] {
  const raw = Array.isArray(value) ? value.join(' ') : String(value || '')
  return [
    ...new Set(
      raw
        .split(/[\s,;]+/)
        .map((email) => email.trim().toLowerCase())
        .filter((email) => email.includes('@')),
    ),
  ].slice(0, MAX_EMAILS)
}

export const coyEndpoints: Endpoint[] = [
  {
    // Notices are for organisers and allowlisted participants; anyone else
    // gets an empty list, not an error, so the panel can explain itself.
    path: '/member/coy/:slug/notices',
    method: 'get',
    handler: endpoint(async (req) => {
      const account = requireAccount(req)
      const coy = await liveCoy(req)
      const access = await getAccessProfile(req, account)
      const organiser = isOrganiser(access)
      const { totalDocs } = await req.payload.count({
        collection: 'coy-participants',
        where: { coy: { equals: coy.id }, account: { equals: account.id } },
        overrideAccess: true,
      })
      const allowlisted = organiser || totalDocs > 0
      if (!allowlisted) return json({ items: [], allowlisted: false, organiser: false })
      const { docs } = await req.payload.find({
        collection: 'coy-notices',
        where: { coy: { equals: coy.id } },
        sort: '-createdAt',
        limit: 20,
        overrideAccess: true,
      })
      return json({ items: docs.map(noticeView), allowlisted: true, organiser })
    }),
  },
  {
    path: '/member/coy/:slug/participants',
    method: 'get',
    handler: endpoint(async (req) => {
      const { coy } = await organiserContext(req)
      const rows = await participantRows(req, coy.id)
      const { emailIds: _emailIds, ...summary } = await audienceSummary(rows)
      return json({
        items: rows.map((row) => ({
          accountId: accountId(row),
          name: row.account?.name || null,
          email: row.email,
          note: row.note || null,
          createdAt: row.createdAt,
        })),
        summary,
      })
    }),
  },
  {
    // Adds existing Hub accounts by email. Never creates accounts; addresses
    // without an account, or with inactive membership, are reported back.
    path: '/member/coy/:slug/participants',
    method: 'post',
    handler: endpoint(async (req) => {
      const { account, coy } = await organiserContext(req)
      await allowlistLimit(req)
      const b = await readBody(req)
      const emails = parseEmails(b.emails ?? b.email)
      if (!emails.length) throw fail.validation({ emails: 'Paste at least one email address.' })
      const note = cleanText(b.note, 240) || null
      const result = { added: 0, already: 0, missing: [] as string[], inactive: [] as string[] }
      for (const email of emails) {
        const { docs } = await req.payload.find({
          collection: 'accounts',
          where: { email: { equals: email } },
          limit: 1,
          overrideAccess: true,
        })
        const member = docs[0] as Doc | undefined
        if (!member) {
          result.missing.push(email)
          continue
        }
        if (
          member.hubAccessStatus !== 'active' ||
          INACTIVE_MEMBERSHIP.includes(member.membershipStatus)
        ) {
          result.inactive.push(email)
          continue
        }
        try {
          await req.payload.create({
            collection: 'coy-participants',
            data: { coy: coy.id, account: member.id, email, note, addedBy: account.id },
            overrideAccess: true,
            req,
          })
          result.added += 1
        } catch (error) {
          if (!isUniqueViolation(error, 'coy-participants', 'coy_participants')) throw error
          result.already += 1
        }
      }
      await audit(req, account, {
        action: 'coy.participants_added',
        targetType: 'coy',
        targetId: coy.slug,
        after: {
          requested: emails.length,
          added: result.added,
          already: result.already,
          missing: result.missing.length,
          inactive: result.inactive.length,
        },
      })
      return json({ ...result, requested: emails.length }, { status: 201 })
    }),
  },
  {
    path: '/member/coy/:slug/participants/:accountId',
    method: 'delete',
    handler: endpoint(async (req) => {
      const { account, coy } = await organiserContext(req)
      const target = Number(param(req, 'accountId'))
      if (!Number.isInteger(target)) throw fail.notFound()
      const { docs } = await req.payload.delete({
        collection: 'coy-participants',
        where: { coy: { equals: coy.id }, account: { equals: target } },
        overrideAccess: true,
        req,
      })
      if (!docs.length) throw fail.notFound('That account is not on the allowlist.')
      await audit(req, account, {
        action: 'coy.participant_removed',
        targetType: 'coy',
        targetId: coy.slug,
        after: { accountId: target },
      })
      return json({ ok: true })
    }),
  },
  {
    // One announcement fans out to the chosen channels. Every channel is
    // checked before anything is written, so a missing email or push setup
    // never leaves a half-sent announcement behind.
    path: '/member/coy/:slug/announce',
    method: 'post',
    handler: endpoint(async (req) => {
      const { account, coy } = await organiserContext(req)
      await announceLimit(req)
      const b = await readBody(req)
      const title = cleanText(b.title, 160)
      const message = cleanParagraphs(b.message, 4000)
      const reason = cleanText(b.reason, 500)
      const channels: string[] = Array.isArray(b.channels)
        ? [...new Set<string>(b.channels.filter((c: AnyValue) => CHANNELS.includes(c)))]
        : CHANNELS
      const fields: Record<string, string> = {}
      if (!title || title.length < 4) fields.title = 'Give the announcement a title.'
      if (!message || message.length < 8) fields.message = 'Write the announcement.'
      if (!reason || reason.length < 8)
        fields.reason = 'Say why this goes out (kept in the audit log).'
      if (!channels.length) fields.channels = 'Pick at least one channel.'
      if (Object.keys(fields).length) throw fail.validation(fields)
      if (channels.includes('email') && !emailConfigured())
        throw new ApiError(503, 'email_not_configured', 'Email delivery is not configured.')
      if (channels.includes('push') && !pushConfigured)
        throw new ApiError(503, 'push_not_configured', 'Push delivery is not configured.')

      const rows = await participantRows(req, coy.id)
      if (!rows.length)
        throw new ApiError(400, 'empty_allowlist', 'Add participants before announcing.')
      const campaignId = cleanText(req.headers.get('x-idempotency-key'), 120) || randomUUID()
      const replay = await req.payload.find({
        collection: 'coy-notices',
        where: { campaignId: { equals: campaignId } },
        limit: 1,
        overrideAccess: true,
      })
      if (replay.docs[0]) return json({ ok: true, campaignId, replay: true }, { status: 202 })

      const subject = /^coy\b/i.test(title) ? title : `COY · ${title}`
      const actionUrl = `${appBaseUrl()}/coys/${coy.slug}`
      const audience = await audienceSummary(rows)
      const notice = channels.includes('hub')
        ? await req.payload.create({
            collection: 'coy-notices',
            data: { coy: coy.id, title, body: message, channels, campaignId, author: account.id },
            overrideAccess: true,
            req,
          })
        : null

      let emailQueued = 0
      if (channels.includes('email')) {
        for (const id of audience.emailIds) {
          const { created } = await enqueueNotification({
            accountId: id,
            category: 'group_mail',
            templateKey: 'group-mail',
            sourceType: 'coy_announce',
            sourceId: campaignId,
            deduplicationKey: `coy-announce:${campaignId}:${id}`,
            payload: { title: subject, message, actionUrl, actionLabel: 'Open the COY page' },
          })
          if (created) emailQueued += 1
        }
      }

      let pushQueued = 0
      if (channels.includes('push')) {
        const devices = await listSubscriptionsForAccounts(rows.map(accountId))
        const payload = JSON.stringify({
          title: subject,
          body: message.slice(0, 180),
          icon: '/icons/icon-192.png',
          badge: '/icons/icon-72.png',
          tag: 'coy-announce',
          data: { url: `/coys/${coy.slug}` },
        })
        for (const id of new Set(devices.map((row: Doc) => String(row.accountId)))) {
          const { created } = await enqueueNotification({
            accountId: id,
            channel: 'push',
            templateKey: 'push',
            sourceType: 'coy_announce',
            sourceId: campaignId,
            deduplicationKey: `coy-push:${campaignId}:${id}`,
            payload,
          })
          if (created) pushQueued += 1
        }
      }

      await audit(req, account, {
        action: 'coy.announce',
        targetType: 'coy_campaign',
        targetId: campaignId,
        reason,
        after: {
          coy: coy.slug,
          channels,
          participants: rows.length,
          emailQueued,
          pushQueued,
          notice: notice?.id ?? null,
        },
      })
      if (emailQueued || pushQueued) {
        after(() =>
          drainNotificationOutbox(req).catch((error) =>
            req.payload.logger.error({ err: error }, 'notification drain failed'),
          ),
        )
      }
      return json(
        {
          ok: true,
          campaignId,
          participants: rows.length,
          notice: notice ? noticeView(notice as Doc) : null,
          email: { queued: emailQueued, eligible: audience.emailEligible },
          push: { queued: pushQueued, devices: audience.pushDevices },
        },
        { status: 202 },
      )
    }),
  },
]
