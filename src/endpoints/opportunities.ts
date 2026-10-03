import type { Endpoint, PayloadRequest } from 'payload'
import { ApiError, endpoint, fail, json, readBody, param } from '../lib/respond'
import { hasTeamRole } from '../lib/access'
import { requireVerifiedMember, verifiedContext, memberContext } from '../lib/accounts'
import * as store from '../lib/content'
import { opportunityShape } from '../lib/content'
import { requirePgPool } from '../lib/pg'
import { audit } from '../lib/audit'
import { trimmed } from '../lib/text'
import { requireOrgScope } from '../lib/ngo'
import type { Doc, DocData } from '../lib/domain'

const OPPORTUNITY_KINDS = [
  { value: 'event', label: 'Event' },
  { value: 'workshop', label: 'Online workshop' },
  { value: 'hackathon', label: 'Hackathon' },
  { value: 'opportunity', label: 'Opportunity' },
  { value: 'call', label: 'Open call' },
  { value: 'training', label: 'Training' },
]
const OPPORTUNITY_FORMATS = [
  { value: 'online', label: 'Online' },
  { value: 'in_person', label: 'In person' },
  { value: 'hybrid', label: 'Hybrid' },
]
const KIND_VALUES = new Set(OPPORTUNITY_KINDS.map((k) => k.value))
const FORMAT_VALUES = new Set(OPPORTUNITY_FORMATS.map((f) => f.value))

function safeUrl(value: unknown) {
  const raw = trimmed(value, 500)
  if (!raw) return null
  let url: URL
  try {
    url = new URL(raw)
  } catch {
    throw fail.validation({ linkUrl: 'The link must be a full http(s) URL.' })
  }
  if (!['http:', 'https:'].includes(url.protocol))
    throw fail.validation({ linkUrl: 'The link must be a full http(s) URL.' })
  return url.toString()
}

async function orgPostingTrust(req: PayloadRequest, orgAccountId: any) {
  const org = (await req.payload.findByID({
    collection: 'accounts',
    id: orgAccountId,
    overrideAccess: true,
    req,
  })) as Doc
  if (org?.postingTrust) return org.postingTrust === 'trusted'
  const published = await req.payload.find({
    collection: 'opportunities',
    where: {
      orgAccount: { equals: orgAccountId },
      status: { equals: 'published' },
    },
    limit: 1,
    overrideAccess: true,
  })
  return published.totalDocs > 0
}

export const opportunityEndpoints: Endpoint[] = [
  // ── Opportunities board (member read) ─────────────────────────────
  {
    path: '/member/opportunities',
    method: 'get',
    handler: endpoint(async (req) => {
      requireVerifiedMember(req)
      const items = await store.listOpportunities(req, {
        kind: req.query?.kind as string,
        format: req.query?.format as string,
      })
      return json({
        items,
        kinds: [
          { value: 'event', label: 'Event' },
          { value: 'workshop', label: 'Online workshop' },
          { value: 'hackathon', label: 'Hackathon' },
          { value: 'opportunity', label: 'Opportunity' },
          { value: 'call', label: 'Open call' },
          { value: 'training', label: 'Training' },
        ],
        formats: [
          { value: 'online', label: 'Online' },
          { value: 'in_person', label: 'In person' },
          { value: 'hybrid', label: 'Hybrid' },
        ],
      })
    }),
  },
  {
    path: '/member/opportunities/review',
    method: 'get',
    handler: endpoint(async (req) => {
      const { access } = await memberContext(req)
      if (!hasTeamRole(access, 'membership_team'))
        throw fail.forbidden('Posting review requires a Membership Team appointment.')
      const [pending, published] = await Promise.all([
        req.payload.find({
          collection: 'opportunities',
          where: { status: { equals: 'pending_review' } },
          sort: 'createdAt',
          limit: 100,
          overrideAccess: true,
        }),
        req.payload.find({
          collection: 'opportunities',
          where: { status: { equals: 'published' } },
          sort: '-createdAt',
          limit: 50,
          overrideAccess: true,
        }),
      ])
      const pool = requirePgPool()
      const { rows: orgRows } = await pool.query(
        `SELECT a.id AS org_account_id,
                a.organization_name,
                a.posting_trust AS override_state,
                a.posting_trust_note AS override_note,
                EXISTS (
                  SELECT 1 FROM opportunities o
                   WHERE o.org_account_id = a.id AND o.status = 'published'
                ) AS has_published
           FROM accounts a
           JOIN (
             SELECT DISTINCT org_account_id FROM opportunities
           ) posted ON posted.org_account_id = a.id
          ORDER BY a.organization_name NULLS LAST, a.id
          LIMIT 200`,
      )
      const organisations = orgRows.map((row: Doc) => {
        const override = row.override_state || null
        const trusted =
          override === 'trusted' || (override !== 'review_required' && Boolean(row.has_published))
        return {
          orgAccountId: row.org_account_id,
          organizationName: row.organization_name || null,
          trusted,
          override,
          overrideNote: row.override_note || null,
        }
      })
      return json({
        items: (pending.docs as Doc[]).map(opportunityShape),
        published: (published.docs as Doc[]).map(opportunityShape),
        organisations,
      })
    }),
  },

  // ── NGO opportunity postings ──────────────────────────────────────
  {
    path: '/member/ngo/opportunities',
    method: 'get',
    handler: endpoint(async (req) => {
      const { ctx } = await requireOrgScope(req)
      const { docs } = await req.payload.find({
        collection: 'opportunities',
        where: { orgAccount: { equals: Number(ctx.orgAccountId) } },
        sort: '-createdAt',
        limit: 100,
        overrideAccess: true,
      })
      return json({
        items: (docs as Doc[]).map(opportunityShape),
        trusted: await orgPostingTrust(req, ctx.orgAccountId),
        kinds: OPPORTUNITY_KINDS,
        formats: OPPORTUNITY_FORMATS,
        canPost: ctx.canManageRequests,
      })
    }),
  },
  {
    path: '/member/ngo/opportunities',
    method: 'post',
    handler: endpoint(async (req) => {
      const { account, ctx } = await requireOrgScope(req, 'requests')
      const b = await readBody(req)
      const title = trimmed(b.title, 200)
      if (title.length < 6)
        throw fail.validation({ title: 'Give the posting a title of at least 6 characters.' })
      if (!KIND_VALUES.has(b.kind)) throw fail.validation({ kind: 'Choose a posting type.' })
      const format = FORMAT_VALUES.has(b.format) ? b.format : null
      if (!format) throw fail.validation({ format: 'Choose a format.' })
      const startsAt = b.startsAt ? Date.parse(b.startsAt) : null
      const endsAt = b.endsAt ? Date.parse(b.endsAt) : null
      if (startsAt && endsAt && endsAt < startsAt)
        throw fail.validation({ endsAt: 'The end time cannot be before the start time.' })
      const status = (await orgPostingTrust(req, ctx.orgAccountId)) ? 'published' : 'pending_review'
      const org = (await req.payload.findByID({
        collection: 'accounts',
        id: ctx.orgAccountId,
        overrideAccess: true,
        req,
      })) as Doc
      const created = await req.payload.create({
        collection: 'opportunities',
        data: {
          kind: b.kind,
          format,
          title,
          summary: trimmed(b.summary, 500) || null,
          body: trimmed(b.body, 5000) || null,
          location: trimmed(b.location, 200) || null,
          region: trimmed(b.region, 120) || null,
          startsAt: startsAt ? new Date(startsAt).toISOString() : null,
          endsAt: endsAt ? new Date(endsAt).toISOString() : null,
          deadlineAt: b.deadlineAt ? new Date(Date.parse(b.deadlineAt)).toISOString() : null,
          linkUrl: safeUrl(b.linkUrl),
          orgAccount: ctx.orgAccountId,
          organizationName: org?.organizationName || org?.name || null,
          status,
          source: 'ngo',
        } as DocData,
        overrideAccess: true,
        req,
      })
      await audit(req, account, {
        action: 'ngo.opportunity_created',
        targetType: 'opportunity',
        targetId: String(created.id),
        after: { status },
      })
      return json(
        {
          item: opportunityShape(created),
          note:
            status === 'published'
              ? 'Published to the constituency.'
              : 'Sent for review. Your organisation posts directly once this first one is approved.',
        },
        { status: 201 },
      )
    }),
  },
  {
    path: '/member/ngo/opportunities/:id/withdraw',
    method: 'post',
    handler: endpoint(async (req) => {
      const { account, ctx } = await requireOrgScope(req, 'requests')
      const item = (await req.payload.findByID({
        collection: 'opportunities',
        id: param(req, 'id'),
        overrideAccess: true,
        req,
      })) as Doc
      if (
        !item ||
        !['published', 'pending_review'].includes(item.status) ||
        String(typeof item.orgAccount === 'object' ? item.orgAccount.id : item.orgAccount) !==
          ctx.orgAccountId
      )
        throw new ApiError(404, 'not_found', 'That posting is not live.')
      const updated = await req.payload.update({
        collection: 'opportunities',
        id: item.id,
        data: { status: 'withdrawn' } as DocData,
        overrideAccess: true,
        req,
      })
      await audit(req, account, {
        action: 'ngo.opportunity_withdrawn',
        targetType: 'opportunity',
        targetId: String(item.id),
      })
      return json({ item: opportunityShape(updated) })
    }),
  },
  {
    path: '/member/opportunities/:id/review',
    method: 'post',
    handler: endpoint(async (req) => {
      const { account, access } = await verifiedContext(req)
      if (!hasTeamRole(access, 'membership_team'))
        throw fail.forbidden('Posting review requires a Membership Team appointment.')
      const b = await readBody(req)
      const approve = b.decision === 'approve'
      const reviewNote = trimmed(b.note, 1000) || null
      if (!approve && !reviewNote)
        throw fail.validation({
          note: 'Give the organisation a reason for the rejection.',
        })
      const item = (await req.payload.findByID({
        collection: 'opportunities',
        id: param(req, 'id'),
        overrideAccess: true,
        req,
      })) as Doc
      if (!item || item.status !== 'pending_review')
        throw new ApiError(404, 'not_found', 'That posting is no longer awaiting review.')
      const updated = await req.payload.update({
        collection: 'opportunities',
        id: item.id,
        data: {
          status: approve ? 'published' : 'rejected',
          reviewNote,
          reviewedAt: new Date().toISOString(),
        } as DocData,
        overrideAccess: true,
        req,
      })
      await audit(req, account, {
        action: approve ? 'ngo.opportunity_approved' : 'ngo.opportunity_rejected',
        targetType: 'ngo_opportunity',
        targetId: String(item.id),
        after: { status: updated.status },
        reason: reviewNote,
      })
      return json({ item: opportunityShape(updated) })
    }),
  },
  {
    // Staff override of the derived "trusted after one approved posting" rule.
    path: '/member/opportunities/trust/:orgAccountId',
    method: 'post',
    handler: endpoint(async (req) => {
      const { account, access } = await verifiedContext(req)
      if (!hasTeamRole(access, 'membership_team'))
        throw fail.forbidden('Posting review requires a Membership Team appointment.')
      const orgAccountId = param(req, 'orgAccountId')
      const b = await readBody(req)
      const state = String(b.state || '')
      if (!['trusted', 'review_required'].includes(state))
        throw fail.validation({ state: 'Trust state must be trusted or review_required.' })
      const org = (await req.payload.findByID({
        collection: 'accounts',
        id: orgAccountId,
        overrideAccess: true,
        req,
      })) as Doc
      if (!org || org.entityType !== 'organization')
        throw fail.notFound('Organisation account not found.')
      await req.payload.update({
        collection: 'accounts',
        id: org.id,
        data: {
          postingTrust: state,
          postingTrustNote: trimmed(b.note, 500) || null,
        } as DocData,
        overrideAccess: true,
        req,
      })
      const result = { orgAccountId, state }
      await audit(req, account, {
        action: 'ngo.opportunity_trust_set',
        targetType: 'hub_account',
        targetId: orgAccountId,
        after: result,
        reason: trimmed(b.note, 500) || null,
      })
      return json(result)
    }),
  },
  {
    path: '/member/opportunities/:id/unpublish',
    method: 'post',
    handler: endpoint(async (req) => {
      const { account, access } = await verifiedContext(req)
      if (!hasTeamRole(access, 'membership_team')) throw fail.forbidden()
      const b = await readBody(req)
      const reviewNote = trimmed(b.note, 1000) || null
      if (!reviewNote) throw fail.validation({ note: 'Give a reason for unpublishing.' })
      const item = (await req.payload.findByID({
        collection: 'opportunities',
        id: param(req, 'id'),
        overrideAccess: true,
        req,
      })) as Doc
      if (!item || item.status !== 'published')
        throw new ApiError(404, 'not_found', 'That posting is not published.')
      const updated = await req.payload.update({
        collection: 'opportunities',
        id: item.id,
        data: {
          status: 'rejected',
          reviewNote,
          reviewedAt: new Date().toISOString(),
        } as DocData,
        overrideAccess: true,
        req,
      })
      await audit(req, account, {
        action: 'ngo.opportunity_unpublished',
        targetType: 'ngo_opportunity',
        targetId: String(item.id),
        after: { status: 'rejected' },
        reason: reviewNote,
      })
      return json({ item: opportunityShape(updated) })
    }),
  },
]
