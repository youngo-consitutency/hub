import type { AnyValue, Doc } from '../lib/domain'
import type { Endpoint, PayloadRequest } from 'payload'
import { after } from 'next/server'
import { randomUUID } from 'node:crypto'
import { endpoint, fail, json, readBody, param } from '../lib/respond'
import { verifiedContext } from '../lib/accounts'
import { audit } from '../lib/audit'
import { rateLimit } from '../lib/rateLimit'
import { cleanText } from '../lib/text'
import {
  drainNotificationOutbox,
  enqueueNotification,
  listEligibleNotificationAccountIds,
  renderEmailTemplate,
} from '../lib/notifications'
import { MAX_INDIVIDUAL_RECIPIENTS, mailReach } from '../shared/mailReach'
import { emailPlainText, sanitizeEmailHtml } from '../shared/emailHtml'

const queueLimit = rateLimit({ windowMs: 60 * 60 * 1000, max: 10, scope: 'mail-queue' })
const INACTIVE_MEMBERSHIP = ['expired', 'terminated', 'rejected']

type Reach = ReturnType<typeof mailReach>
type Scope = { type: string; wgSlug: string | null; accountIds: number[] }

async function mailContext(req: PayloadRequest) {
  const { account, access } = await verifiedContext(req)
  const reach = mailReach(access)
  if (!reach.canDraft) throw fail.forbidden('Mail Desk is for contact points and focal points.')
  return { account, reach }
}

async function activeMemberIds(req: PayloadRequest, wgSlugs: string[]) {
  if (!wgSlugs.length) return []
  const { docs } = await req.payload.find({
    collection: 'wg-progress',
    where: { wgSlug: { in: wgSlugs }, status: { equals: 'active' } },
    depth: 0,
    limit: 10000,
    pagination: false,
    overrideAccess: true,
  })
  return [...new Set(docs.map((row: Doc) => String(row.account)))]
}

// Every scope is checked against the author's reach when saved and again
// when queued, so a lapsed mandate cannot send a draft it saved earlier.
async function resolveScope(req: PayloadRequest, reach: Reach, raw: AnyValue): Promise<Scope> {
  const type = String(raw?.type || '')
  if (type === 'constituency') {
    if (!reach.everyone) throw fail.forbidden('This mandate can only write to its own groups.')
    return { type, wgSlug: null, accountIds: [] }
  }
  if (type === 'working_group') {
    const wgSlug = cleanText(raw?.wgSlug, 80)
    const { totalDocs } = await req.payload.count({
      collection: 'working-groups',
      where: { slug: { equals: wgSlug } },
      overrideAccess: true,
    })
    if (!wgSlug || !totalDocs) throw fail.validation({ wgSlug: 'Choose a working group.' })
    if (!reach.everyone && !reach.wgSlugs.includes(wgSlug))
      throw fail.forbidden('This mandate can only write to its own groups.')
    return { type, wgSlug, accountIds: [] }
  }
  if (type === 'individual') {
    const ids = [
      ...new Set<number>((Array.isArray(raw?.accountIds) ? raw.accountIds : []).map(Number)),
    ].filter(Number.isInteger)
    if (!ids.length || ids.length > MAX_INDIVIDUAL_RECIPIENTS)
      throw fail.validation({
        recipients: `Choose between 1 and ${MAX_INDIVIDUAL_RECIPIENTS} people.`,
      })
    if (!reach.everyone) {
      const reachable = new Set(await activeMemberIds(req, reach.wgSlugs))
      if (ids.some((id) => !reachable.has(String(id))))
        throw fail.forbidden('Some of these people are outside this mandate’s groups.')
    }
    return { type, wgSlug: null, accountIds: ids }
  }
  throw fail.validation({ scope: 'Choose who this goes to.' })
}

// Recipients honour the email preferences: group mail is on unless a member
// turned it off; constituency-wide mail is the opt-in announcement category.
async function recipientIds(req: PayloadRequest, scope: Scope) {
  if (scope.type === 'constituency')
    return listEligibleNotificationAccountIds({
      category: 'announcement',
      scope: { type: 'all_active', ids: [] },
    })
  const ids =
    scope.type === 'working_group'
      ? await activeMemberIds(req, [scope.wgSlug!])
      : scope.accountIds.map(String)
  if (!ids.length) return []
  return listEligibleNotificationAccountIds({
    category: 'group_mail',
    scope: { type: 'account_ids', ids },
  })
}

function cleanDraft(b: AnyValue) {
  const title = cleanText(b.title, 160)
  const message = sanitizeEmailHtml(b.message)
  const actionUrl = cleanText(b.actionUrl, 500) || null
  const fields: Record<string, string> = {}
  if (!title || title.length < 4) fields.title = 'Give the email a subject.'
  if (emailPlainText(message).length < 12) fields.message = 'Write the message.'
  if (actionUrl && !/^https:\/\//.test(actionUrl))
    fields.actionUrl = 'Links must start with https://'
  if (Object.keys(fields).length) throw fail.validation(fields)
  return { title, message, actionUrl }
}

async function personNames(req: PayloadRequest, ids: number[]) {
  if (!ids.length) return []
  const { docs } = await req.payload.find({
    collection: 'accounts',
    where: { id: { in: ids } },
    depth: 0,
    limit: ids.length,
    overrideAccess: true,
  })
  return docs.map((a: Doc) => ({ id: a.id, name: a.name }))
}

const draftView = (d: Doc) => ({
  id: d.id,
  title: d.title,
  message: d.message,
  actionUrl: d.actionUrl,
  scope: { type: d.scopeType, wgSlug: d.wgSlug, recipients: d.recipients || [] },
  status: d.status,
  recipientCount: d.recipientCount ?? null,
  queuedAt: d.queuedAt,
  updatedAt: d.updatedAt,
})

async function ownDraft(req: PayloadRequest, accountId: AnyValue) {
  const draft = await req.payload
    .findByID({ collection: 'mail-drafts', id: param(req, 'id'), depth: 0, overrideAccess: true })
    .catch(() => null)
  // another author's draft reads as missing, not forbidden
  if (!draft || String(draft.author) !== String(accountId) || draft.status !== 'draft')
    throw fail.notFound('This draft is no longer editable.')
  return draft as Doc
}

export const mailEndpoints: Endpoint[] = [
  {
    path: '/member/mail/drafts',
    method: 'get',
    handler: endpoint(async (req) => {
      const { account, reach } = await mailContext(req)
      const { docs } = await req.payload.find({
        collection: 'mail-drafts',
        where: { author: { equals: account.id }, status: { not_equals: 'discarded' } },
        sort: '-updatedAt',
        limit: 40,
        depth: 0,
        overrideAccess: true,
      })
      return json({ reach, drafts: docs.map(draftView) })
    }),
  },
  {
    // Names only: the desk never exposes members' email addresses.
    path: '/member/mail/people',
    method: 'get',
    handler: endpoint(async (req) => {
      const { reach } = await mailContext(req)
      const q = cleanText(req.query?.q, 80)
      if (q.length < 2) return json({ people: [] })
      const where: AnyValue = {
        and: [
          { name: { like: q } },
          { hubAccessStatus: { equals: 'active' } },
          { membershipStatus: { not_in: INACTIVE_MEMBERSHIP } },
          { emailVerifiedAt: { exists: true } },
        ],
      }
      if (!reach.everyone) where.and.push({ id: { in: await activeMemberIds(req, reach.wgSlugs) } })
      const { docs } = await req.payload.find({
        collection: 'accounts',
        where,
        depth: 0,
        limit: 20,
        overrideAccess: true,
      })
      return json({ people: docs.map((a: Doc) => ({ id: a.id, name: a.name })) })
    }),
  },
  {
    path: '/member/mail/render',
    method: 'post',
    handler: endpoint(async (req) => {
      await mailContext(req)
      const draft = cleanDraft(await readBody(req))
      const { subject, html } = renderEmailTemplate('group-mail', {
        title: draft.title,
        html: draft.message,
        actionUrl: draft.actionUrl,
      })
      return json({ subject, html })
    }),
  },
  {
    path: '/member/mail/preview',
    method: 'post',
    handler: endpoint(async (req) => {
      const { reach } = await mailContext(req)
      const scope = await resolveScope(req, reach, (await readBody(req)).scope)
      return json({ count: (await recipientIds(req, scope)).length })
    }),
  },
  {
    path: '/member/mail/drafts',
    method: 'post',
    handler: endpoint(async (req) => {
      const { account, reach } = await mailContext(req)
      const b = await readBody(req)
      const draft = cleanDraft(b)
      const scope = await resolveScope(req, reach, b.scope)
      const created = await req.payload.create({
        collection: 'mail-drafts',
        data: {
          author: account.id,
          ...draft,
          scopeType: scope.type as AnyValue,
          wgSlug: scope.wgSlug,
          recipients: await personNames(req, scope.accountIds),
          status: 'draft',
        },
        overrideAccess: true,
        req,
      })
      await audit(req, account, {
        action: 'mail.draft_created',
        targetType: 'mail_draft',
        targetId: String(created.id),
        after: { scope: scope.type, wgSlug: scope.wgSlug },
      })
      return json({ draft: draftView(created) }, { status: 201 })
    }),
  },
  {
    path: '/member/mail/drafts/:id',
    method: 'patch',
    handler: endpoint(async (req) => {
      const { account, reach } = await mailContext(req)
      const existing = await ownDraft(req, account.id)
      const b = await readBody(req)
      const draft = cleanDraft(b)
      const scope = await resolveScope(req, reach, b.scope)
      const updated = await req.payload.update({
        collection: 'mail-drafts',
        id: existing.id,
        data: {
          ...draft,
          scopeType: scope.type as AnyValue,
          wgSlug: scope.wgSlug,
          recipients: await personNames(req, scope.accountIds),
        },
        overrideAccess: true,
        req,
      })
      await audit(req, account, {
        action: 'mail.draft_updated',
        targetType: 'mail_draft',
        targetId: String(existing.id),
        after: { scope: scope.type, wgSlug: scope.wgSlug },
      })
      return json({ draft: draftView(updated) })
    }),
  },
  {
    path: '/member/mail/drafts/:id/queue',
    method: 'post',
    handler: endpoint(async (req) => {
      const { account, reach } = await mailContext(req)
      await queueLimit(req)
      const draft = await ownDraft(req, account.id)
      const scope = await resolveScope(req, reach, {
        type: draft.scopeType,
        wgSlug: draft.wgSlug,
        accountIds: (draft.recipients || []).map((r: Doc) => r.id),
      })
      const ids = await recipientIds(req, scope)
      if (!ids.length)
        throw fail.validation({ scope: 'Nobody in this audience can receive email right now.' })
      const campaignId = randomUUID()
      const category = scope.type === 'constituency' ? 'announcement' : 'group_mail'
      let queued = 0
      for (const id of ids) {
        const { created } = await enqueueNotification({
          accountId: id,
          category,
          templateKey: 'group-mail',
          sourceType: 'mail_draft',
          sourceId: String(draft.id),
          deduplicationKey: `mail-draft:${draft.id}:${id}`,
          payload: { title: draft.title, html: draft.message, actionUrl: draft.actionUrl },
        })
        if (created) queued += 1
      }
      await req.payload.update({
        collection: 'mail-drafts',
        id: draft.id,
        data: {
          status: 'queued',
          campaignId,
          recipientCount: queued,
          queuedAt: new Date().toISOString(),
        },
        overrideAccess: true,
        req,
      })
      await audit(req, account, {
        action: 'mail.draft_queued',
        targetType: 'mail_draft',
        targetId: String(draft.id),
        reason: draft.title,
        after: { scope: scope.type, wgSlug: scope.wgSlug, eligible: ids.length, queued, category },
      })
      after(() =>
        drainNotificationOutbox(req).catch((error) =>
          req.payload.logger.error({ err: error }, 'notification drain failed'),
        ),
      )
      return json({ ok: true, campaignId, queued }, { status: 202 })
    }),
  },
  {
    path: '/member/mail/drafts/:id/discard',
    method: 'post',
    handler: endpoint(async (req) => {
      const { account } = await mailContext(req)
      const draft = await ownDraft(req, account.id)
      await req.payload.update({
        collection: 'mail-drafts',
        id: draft.id,
        data: { status: 'discarded' },
        overrideAccess: true,
        req,
      })
      await audit(req, account, {
        action: 'mail.draft_discarded',
        targetType: 'mail_draft',
        targetId: String(draft.id),
      })
      return json({ ok: true })
    }),
  },
]
