import type { Endpoint, PayloadRequest } from 'payload'
import { endpoint, fail, json } from '../lib/respond'
import { requireVerifiedMember } from '../lib/accounts'
import { audit } from '../lib/audit'
import { getAccessProfile } from '../lib/access'

// Operational workflows: funding (S12), safeguarding (S23/S04), COI (S07),
// recognition (S20), partnerships (S13), privacy requests (S08). Members
// file and track their own records; the responsible teams review through
// scoped endpoints. Generated REST writes stay staff-only throughout.

// Review authority: a member holding one of the named team appointments
// (e.g. 'finance_team', 'safeguarding_team'). The admin role carries no
// team authority — technical administration is not constituency authority.
async function requireOpsTeam(req: PayloadRequest, teams: string[]) {
  const account = requireVerifiedMember(req)
  const access = await getAccessProfile(req, account)
  if (!teams.some((t) => access.teamRoles.includes(t)))
    throw fail.forbidden('This workspace is not assigned to your account.')
  return { account }
}

const accountRef = (a: any) =>
  a == null
    ? null
    : { id: typeof a === 'object' ? a.id : a, name: typeof a === 'object' ? a.name : undefined }

const own = (doc: any) => {
  const id = doc?.account?.id ?? doc?.reporter?.id ?? doc?.account ?? doc?.reporter
  return typeof id === 'object' ? id?.id : id
}

async function loadDoc(
  req: PayloadRequest,
  collection: string,
  id: string | number,
  notFound = 'Record not found.',
) {
  return req.payload
    .findByID({ collection: collection as any, id: Number(id), overrideAccess: true })
    .catch(() => {
      throw fail.notFound(notFound)
    })
}

function ownOr404(doc: any, account: any) {
  if (own(doc) !== account.id) throw fail.notFound('Record not found.') // don't leak existence
}

const fundingView = (f: any, staff = false) => ({
  id: f.id,
  title: f.title,
  purpose: f.purpose,
  amountNumeric: f.amountNumeric,
  currency: f.currency,
  category: f.category,
  periodStart: f.periodStart,
  periodEnd: f.periodEnd,
  status: f.status,
  submittedAt: f.submittedAt,
  reportNote: f.reportNote,
  reportedAt: f.reportedAt,
  ...(staff
    ? {
        account: accountRef(f.account),
        reviewNote: f.reviewNote,
        reviewedBy: accountRef(f.reviewedBy),
        reviewedAt: f.reviewedAt,
        disbursedAt: f.disbursedAt,
      }
    : {}),
})

export const operationEndpoints: Endpoint[] = [
  // ── Funding requests (S12) ────────────────────────────────────────
  {
    path: '/member/funding',
    method: 'get',
    handler: endpoint(async (req) => {
      const account = requireVerifiedMember(req)
      const { docs } = await req.payload.find({
        collection: 'funding-requests',
        where: { account: { equals: account.id } },
        sort: '-submittedAt',
        limit: 50,
        overrideAccess: true,
      })
      return json({ items: (docs as any[]).map((f) => fundingView(f)) })
    }),
  },
  {
    path: '/member/funding',
    method: 'post',
    handler: endpoint(async (req) => {
      const account = requireVerifiedMember(req)
      const b = (await req.json?.()) ?? ({} as any)
      const fields: Record<string, string> = {}
      if (!b.title?.trim()) fields.title = 'Required.'
      if (!b.purpose?.trim()) fields.purpose = 'Required.'
      const amount = Number(b.amountNumeric)
      if (!Number.isFinite(amount) || amount <= 0)
        fields.amountNumeric = 'A positive amount is required.'
      if (!['event_travel', 'project', 'operations', 'other'].includes(b.category))
        fields.category = 'Invalid category.'
      if (Object.keys(fields).length) throw fail.validation(fields)
      const rec = await req.payload.create({
        collection: 'funding-requests',
        data: {
          account: account.id,
          title: b.title.trim(),
          purpose: b.purpose.trim(),
          amountNumeric: amount,
          currency: (b.currency || 'EUR').trim().slice(0, 8),
          category: b.category,
          periodStart: b.periodStart ?? null,
          periodEnd: b.periodEnd ?? null,
          status: 'submitted',
          submittedAt: new Date().toISOString(),
        } as any,
        overrideAccess: true,
      })
      await audit(req, account, {
        action: 'funding.submitted',
        targetType: 'funding_request',
        targetId: String(rec.id),
      })
      return json({ request: fundingView(rec) }, { status: 201 })
    }),
  },
  {
    path: '/member/funding/:id',
    method: 'get',
    handler: endpoint(async (req) => {
      const account = requireVerifiedMember(req)
      const f = await loadDoc(req, 'funding-requests', req.routeParams!.id as string)
      ownOr404(f, account)
      return json({ request: fundingView(f) })
    }),
  },
  {
    // Withdraw while still submitted.
    path: '/member/funding/:id/withdraw',
    method: 'post',
    handler: endpoint(async (req) => {
      const account = requireVerifiedMember(req)
      const f = await loadDoc(req, 'funding-requests', req.routeParams!.id as string)
      ownOr404(f, account)
      if (f.status !== 'submitted')
        throw fail.conflict('invalid_phase', `Cannot withdraw while ${f.status}.`)
      const updated = await req.payload.update({
        collection: 'funding-requests',
        id: f.id,
        data: { status: 'cancelled' },
        overrideAccess: true,
      })
      await audit(req, account, {
        action: 'funding.withdrawn',
        targetType: 'funding_request',
        targetId: String(f.id),
      })
      return json({ request: fundingView(updated) })
    }),
  },
  {
    // Applicant files the spend report after disbursement.
    path: '/member/funding/:id/report',
    method: 'post',
    handler: endpoint(async (req) => {
      const account = requireVerifiedMember(req)
      const f = await loadDoc(req, 'funding-requests', req.routeParams!.id as string)
      ownOr404(f, account)
      if (f.status !== 'disbursed')
        throw fail.conflict('invalid_phase', 'A report can only follow a disbursement.')
      const b = (await req.json?.()) ?? ({} as any)
      if (!b.reportNote?.trim())
        throw fail.validation({ reportNote: 'Describe how the funds were used.' })
      const updated = await req.payload.update({
        collection: 'funding-requests',
        id: f.id,
        data: {
          status: 'reported',
          reportNote: b.reportNote.trim(),
          reportedAt: new Date().toISOString(),
        },
        overrideAccess: true,
      })
      await audit(req, account, {
        action: 'funding.reported',
        targetType: 'funding_request',
        targetId: String(f.id),
      })
      return json({ request: fundingView(updated) })
    }),
  },
  {
    path: '/member/team/funding',
    method: 'get',
    handler: endpoint(async (req) => {
      await requireOpsTeam(req, ['finance_team', 'gct'])
      const status = req.query?.status as string | undefined
      const { docs } = await req.payload.find({
        collection: 'funding-requests',
        where: status ? { status: { equals: status as any } } : {},
        sort: '-submittedAt',
        limit: 200,
        overrideAccess: true,
      })
      return json({ items: (docs as any[]).map((f) => fundingView(f, true)) })
    }),
  },
  {
    path: '/member/team/funding/:id/review',
    method: 'post',
    handler: endpoint(async (req) => {
      const { account: staff } = await requireOpsTeam(req, ['finance_team', 'gct'])
      const f = await loadDoc(req, 'funding-requests', req.routeParams!.id as string)
      const b = (await req.json?.()) ?? ({} as any)
      const next = String(b.status || '')
      const allowed: Record<string, string[]> = {
        submitted: ['under_review', 'approved', 'rejected'],
        under_review: ['approved', 'rejected'],
      }
      if (!allowed[f.status]?.includes(next))
        throw fail.conflict('invalid_phase', `Cannot move ${f.status} → ${next}.`)
      if (next === 'rejected' && !String(b.reviewNote || '').trim())
        throw fail.validation({ reviewNote: 'Explain the rejection.' })
      const updated = await req.payload.update({
        collection: 'funding-requests',
        id: f.id,
        data: {
          status: next as any,
          reviewNote: b.reviewNote?.trim() || f.reviewNote,
          reviewedBy: staff.id,
          reviewedAt: new Date().toISOString(),
        },
        overrideAccess: true,
      })
      await audit(req, staff, {
        action: `funding.${next}`,
        targetType: 'funding_request',
        targetId: String(f.id),
      })
      return json({ request: fundingView(updated, true) })
    }),
  },
  {
    path: '/member/team/funding/:id/disburse',
    method: 'post',
    handler: endpoint(async (req) => {
      const { account: staff } = await requireOpsTeam(req, ['finance_team'])
      const f = await loadDoc(req, 'funding-requests', req.routeParams!.id as string)
      if (f.status !== 'approved')
        throw fail.conflict('invalid_phase', 'Only an approved request can be disbursed.')
      const updated = await req.payload.update({
        collection: 'funding-requests',
        id: f.id,
        data: { status: 'disbursed', disbursedAt: new Date().toISOString() },
        overrideAccess: true,
      })
      await audit(req, staff, {
        action: 'funding.disbursed',
        targetType: 'funding_request',
        targetId: String(f.id),
      })
      return json({ request: fundingView(updated, true) })
    }),
  },

  // ── Safeguarding (S23/S04) ────────────────────────────────────────
  {
    // Report a safeguarding concern — confidential by design. The response
    // returns only the case reference; case detail stays with the team.
    path: '/member/safeguarding',
    method: 'post',
    handler: endpoint(async (req) => {
      const account = requireVerifiedMember(req)
      const b = (await req.json?.()) ?? ({} as any)
      const fields: Record<string, string> = {}
      if (!['safeguarding', 'child_safeguarding', 'concern', 'coc'].includes(b.kind))
        fields.kind = 'Invalid case type.'
      if (!b.description?.trim() || b.description.trim().length < 20)
        fields.description = 'Describe the concern in at least 20 characters.'
      if (Object.keys(fields).length) throw fail.validation(fields)
      const rec = await req.payload.create({
        collection: 'safeguarding-cases',
        data: {
          reporter: account.id,
          anonymous: Boolean(b.anonymous),
          kind: b.kind,
          severity: ['low', 'medium', 'high', 'critical'].includes(b.severity)
            ? b.severity
            : 'medium',
          description: b.description.trim(),
          involvedParties: b.involvedParties ?? null,
          status: 'received',
          receivedAt: new Date().toISOString(),
        } as any,
        overrideAccess: true,
      })
      await audit(req, account, {
        action: 'safeguarding.reported',
        targetType: 'safeguarding_case',
        targetId: String(rec.id),
      })
      // Reporters get the reference and status — never team internals.
      return json({ caseRef: `SG-${rec.id}`, status: 'received' }, { status: 201 })
    }),
  },
  {
    // Own submitted cases (reference + status only).
    path: '/member/safeguarding',
    method: 'get',
    handler: endpoint(async (req) => {
      const account = requireVerifiedMember(req)
      const { docs } = await req.payload.find({
        collection: 'safeguarding-cases',
        where: { reporter: { equals: account.id } },
        sort: '-receivedAt',
        limit: 50,
        overrideAccess: true,
      })
      return json({
        items: (docs as any[]).map((c) => ({
          caseRef: `SG-${c.id}`,
          kind: c.kind,
          status: c.status,
          receivedAt: c.receivedAt,
        })),
      })
    }),
  },
  {
    path: '/member/team/safeguarding',
    method: 'get',
    handler: endpoint(async (req) => {
      await requireOpsTeam(req, ['safeguarding_team', 'awareness_team'])
      const status = req.query?.status as string | undefined
      const { docs } = await req.payload.find({
        collection: 'safeguarding-cases',
        where: status ? { status: { equals: status as any } } : {},
        sort: '-receivedAt',
        limit: 200,
        overrideAccess: true,
      })
      return json({
        items: (docs as any[]).map((c) => ({
          id: c.id,
          kind: c.kind,
          severity: c.severity,
          description: c.description,
          involvedParties: c.involvedParties,
          anonymous: c.anonymous,
          // anonymous reports hide the reporter even from the team
          reporter: c.anonymous ? null : accountRef(c.reporter),
          status: c.status,
          assignedTo: accountRef(c.assignedTo),
          updates: c.updates ?? [],
          outcomeNote: c.outcomeNote,
          receivedAt: c.receivedAt,
        })),
      })
    }),
  },
  {
    path: '/member/team/safeguarding/:id/update',
    method: 'post',
    handler: endpoint(async (req) => {
      const { account: staff } = await requireOpsTeam(req, ['safeguarding_team', 'awareness_team'])
      const c = await loadDoc(req, 'safeguarding-cases', req.routeParams!.id as string)
      const b = (await req.json?.()) ?? ({} as any)
      const next = String(b.status || '')
      const flow: Record<string, string[]> = {
        received: ['triaged', 'closed'],
        triaged: ['investigating', 'closed'],
        investigating: ['resolved', 'closed'],
        resolved: ['closed'],
      }
      if (!flow[c.status]?.includes(next))
        throw fail.conflict('invalid_phase', `Cannot move ${c.status} → ${next}.`)
      const note = String(b.note || '').trim()
      if (!note) throw fail.validation({ note: 'Record a case update note.' })
      const updates = [
        ...(c.updates ?? []),
        {
          note,
          status: next,
          by: staff.id,
          at: new Date().toISOString(),
        },
      ]
      const updated = await req.payload.update({
        collection: 'safeguarding-cases',
        id: c.id,
        data: {
          status: next as any,
          updates,
          assignedTo: b.assignTo ?? c.assignedTo ?? staff.id,
          outcomeNote: b.outcomeNote?.trim() || c.outcomeNote,
          ...(next === 'closed' ? { closedAt: new Date().toISOString() } : {}),
        },
        overrideAccess: true,
      })
      await audit(req, staff, {
        action: `safeguarding.${next}`,
        targetType: 'safeguarding_case',
        targetId: String(c.id),
      })
      return json({ case: { id: (updated as any).id, status: (updated as any).status } })
    }),
  },

  // ── Conflict-of-interest declarations (S07) ──────────────────────
  {
    path: '/member/coi',
    method: 'get',
    handler: endpoint(async (req) => {
      const account = requireVerifiedMember(req)
      const { docs } = await req.payload.find({
        collection: 'coi-declarations',
        where: { account: { equals: account.id } },
        sort: '-declaredAt',
        limit: 50,
        overrideAccess: true,
      })
      return json({ items: docs })
    }),
  },
  {
    path: '/member/coi',
    method: 'post',
    handler: endpoint(async (req) => {
      const account = requireVerifiedMember(req)
      const b = (await req.json?.()) ?? ({} as any)
      const fields: Record<string, string> = {}
      if (!b.interest?.trim()) fields.interest = 'Name the interest.'
      if (!b.details?.trim()) fields.details = 'Describe the conflict.'
      if (Object.keys(fields).length) throw fail.validation(fields)
      const rec = await req.payload.create({
        collection: 'coi-declarations',
        data: {
          account: account.id,
          interest: b.interest.trim(),
          details: b.details.trim(),
          relatedScope: b.relatedScope?.trim() || null,
          status: 'declared',
          declaredAt: new Date().toISOString(),
        } as any,
        overrideAccess: true,
      })
      await audit(req, account, {
        action: 'coi.declared',
        targetType: 'coi_declaration',
        targetId: String(rec.id),
      })
      return json({ declaration: rec }, { status: 201 })
    }),
  },
  {
    path: '/member/team/membership/coi',
    method: 'get',
    handler: endpoint(async (req) => {
      await requireOpsTeam(req, ['membership_team', 'safeguarding_team'])
      const { docs } = await req.payload.find({
        collection: 'coi-declarations',
        where: { status: { in: ['declared', 'under_review'] } },
        sort: '-declaredAt',
        limit: 200,
        overrideAccess: true,
      })
      return json({ items: docs })
    }),
  },
  {
    path: '/member/team/membership/coi/:id/review',
    method: 'post',
    handler: endpoint(async (req) => {
      const { account: staff } = await requireOpsTeam(req, ['membership_team', 'safeguarding_team'])
      const d = await loadDoc(req, 'coi-declarations', req.routeParams!.id as string)
      const b = (await req.json?.()) ?? ({} as any)
      if (!['under_review', 'resolved', 'dismissed'].includes(b.status))
        throw fail.validation({ status: 'Must be under_review, resolved or dismissed.' })
      const updated = await req.payload.update({
        collection: 'coi-declarations',
        id: d.id,
        data: {
          status: b.status,
          reviewNote: b.reviewNote?.trim() || null,
          reviewedBy: staff.id,
          reviewedAt: new Date().toISOString(),
        },
        overrideAccess: true,
      })
      await audit(req, staff, {
        action: `coi.${b.status}`,
        targetType: 'coi_declaration',
        targetId: String(d.id),
      })
      return json({ declaration: updated })
    }),
  },

  // ── Recognition (S20) ────────────────────────────────────────────
  {
    path: '/member/recognition',
    method: 'get',
    handler: endpoint(async (req) => {
      const account = requireVerifiedMember(req)
      const { docs } = await req.payload.find({
        collection: 'recognition-requests',
        where: { account: { equals: account.id } },
        sort: '-requestedAt',
        limit: 50,
        overrideAccess: true,
      })
      return json({ items: docs })
    }),
  },
  {
    path: '/member/recognition',
    method: 'post',
    handler: endpoint(async (req) => {
      const account = requireVerifiedMember(req)
      const b = (await req.json?.()) ?? ({} as any)
      const fields: Record<string, string> = {}
      if (!['certificate', 'letter', 'other'].includes(b.kind))
        fields.kind = 'Must be certificate, letter or other.'
      if (!b.purpose?.trim()) fields.purpose = 'Say what the recognition is for.'
      if (Object.keys(fields).length) throw fail.validation(fields)
      const rec = await req.payload.create({
        collection: 'recognition-requests',
        data: {
          account: account.id,
          kind: b.kind,
          purpose: b.purpose.trim(),
          eventRef: b.eventRef?.trim() || null,
          status: 'requested',
          requestedAt: new Date().toISOString(),
        } as any,
        overrideAccess: true,
      })
      await audit(req, account, {
        action: 'recognition.requested',
        targetType: 'recognition_request',
        targetId: String(rec.id),
      })
      return json({ request: rec }, { status: 201 })
    }),
  },
  {
    path: '/member/team/recognition',
    method: 'get',
    handler: endpoint(async (req) => {
      await requireOpsTeam(req, ['comms_team', 'gct', 'membership_team'])
      const { docs } = await req.payload.find({
        collection: 'recognition-requests',
        where: { status: { in: ['requested', 'approved'] } },
        sort: '-requestedAt',
        limit: 200,
        overrideAccess: true,
      })
      return json({ items: docs })
    }),
  },
  {
    path: '/member/team/recognition/:id/review',
    method: 'post',
    handler: endpoint(async (req) => {
      const { account: staff } = await requireOpsTeam(req, ['comms_team', 'gct', 'membership_team'])
      const r = await loadDoc(req, 'recognition-requests', req.routeParams!.id as string)
      const b = (await req.json?.()) ?? ({} as any)
      const flow: Record<string, string[]> = {
        requested: ['approved', 'declined'],
        approved: ['issued'],
      }
      if (!flow[r.status]?.includes(b.status))
        throw fail.conflict('invalid_phase', `Cannot move ${r.status} → ${b.status}.`)
      const updated = await req.payload.update({
        collection: 'recognition-requests',
        id: r.id,
        data: {
          status: b.status,
          reviewNote: b.reviewNote?.trim() || null,
          reviewedBy: staff.id,
          ...(b.status === 'issued' ? { issuedAt: new Date().toISOString() } : {}),
        },
        overrideAccess: true,
      })
      await audit(req, staff, {
        action: `recognition.${b.status}`,
        targetType: 'recognition_request',
        targetId: String(r.id),
      })
      return json({ request: updated })
    }),
  },

  // ── Partnerships & sponsorships (S13) ────────────────────────────
  {
    path: '/member/partnerships',
    method: 'post',
    handler: endpoint(async (req) => {
      const account = requireVerifiedMember(req)
      const b = (await req.json?.()) ?? ({} as any)
      const fields: Record<string, string> = {}
      if (!b.organisationName?.trim()) fields.organisationName = 'Required.'
      if (!['partnership', 'sponsorship', 'mou', 'other'].includes(b.kind))
        fields.kind = 'Invalid kind.'
      if (!b.summary?.trim()) fields.summary = 'Summarise the proposal.'
      if (Object.keys(fields).length) throw fail.validation(fields)
      const rec = await req.payload.create({
        collection: 'partnership-requests',
        data: {
          account: account.id,
          organisationName: b.organisationName.trim(),
          kind: b.kind,
          summary: b.summary.trim(),
          valueNote: b.valueNote?.trim() || null,
          requiresCouncilDecision: Boolean(b.requiresCouncilDecision),
          status: 'proposed',
          proposedAt: new Date().toISOString(),
        } as any,
        overrideAccess: true,
      })
      await audit(req, account, {
        action: 'partnership.proposed',
        targetType: 'partnership_request',
        targetId: String(rec.id),
      })
      return json({ request: rec }, { status: 201 })
    }),
  },
  {
    path: '/member/team/partnerships',
    method: 'get',
    handler: endpoint(async (req) => {
      await requireOpsTeam(req, ['partnerships_team', 'gct'])
      const { docs } = await req.payload.find({
        collection: 'partnership-requests',
        where: { status: { not_in: ['ended'] } },
        sort: '-proposedAt',
        limit: 200,
        overrideAccess: true,
      })
      return json({ items: docs })
    }),
  },
  {
    path: '/member/team/partnerships/:id/review',
    method: 'post',
    handler: endpoint(async (req) => {
      const { account: staff } = await requireOpsTeam(req, ['partnerships_team', 'gct'])
      const p = await loadDoc(req, 'partnership-requests', req.routeParams!.id as string)
      const b = (await req.json?.()) ?? ({} as any)
      const flow: Record<string, string[]> = {
        proposed: ['under_review', 'declined'],
        under_review: ['approved', 'declined'],
        approved: ['active', 'ended'],
        active: ['ended'],
      }
      if (!flow[p.status]?.includes(b.status))
        throw fail.conflict('invalid_phase', `Cannot move ${p.status} → ${b.status}.`)
      // S13: major partnerships/sponsorships need a council decision on record.
      if (
        ['approved', 'active'].includes(b.status) &&
        p.requiresCouncilDecision &&
        !b.councilDecisionId &&
        !p.councilDecision
      )
        throw fail.conflict(
          'council_decision_required',
          'A council decision is required before approval (S13).',
        )
      const updated = await req.payload.update({
        collection: 'partnership-requests',
        id: p.id,
        data: {
          status: b.status,
          councilDecision: b.councilDecisionId ?? p.councilDecision,
          reviewNote: b.reviewNote?.trim() || null,
          reviewedBy: staff.id,
          ...(b.status === 'ended' ? { endedAt: new Date().toISOString() } : {}),
        },
        overrideAccess: true,
      })
      await audit(req, staff, {
        action: `partnership.${b.status}`,
        targetType: 'partnership_request',
        targetId: String(p.id),
      })
      return json({ request: updated })
    }),
  },

  // ── Data-protection requests (S08) ───────────────────────────────
  {
    path: '/member/privacy',
    method: 'get',
    handler: endpoint(async (req) => {
      const account = requireVerifiedMember(req)
      const { docs } = await req.payload.find({
        collection: 'privacy-requests',
        where: { account: { equals: account.id } },
        sort: '-requestedAt',
        limit: 50,
        overrideAccess: true,
      })
      return json({ items: docs })
    }),
  },
  {
    path: '/member/privacy',
    method: 'post',
    handler: endpoint(async (req) => {
      const account = requireVerifiedMember(req)
      const b = (await req.json?.()) ?? ({} as any)
      const fields: Record<string, string> = {}
      if (!['access', 'erasure', 'rectification', 'portability', 'objection'].includes(b.kind))
        fields.kind = 'Invalid request type.'
      if (!b.details?.trim()) fields.details = 'Describe the request.'
      if (Object.keys(fields).length) throw fail.validation(fields)
      const rec = await req.payload.create({
        collection: 'privacy-requests',
        data: {
          account: account.id,
          kind: b.kind,
          details: b.details.trim(),
          status: 'received',
          dueAt: new Date(Date.now() + 30 * 86400000).toISOString(),
          requestedAt: new Date().toISOString(),
        } as any,
        overrideAccess: true,
      })
      await audit(req, account, {
        action: 'privacy.requested',
        targetType: 'privacy_request',
        targetId: String(rec.id),
      })
      return json({ request: rec }, { status: 201 })
    }),
  },
  {
    path: '/member/team/privacy',
    method: 'get',
    handler: endpoint(async (req) => {
      await requireOpsTeam(req, ['data_controller', 'membership_team'])
      const { docs } = await req.payload.find({
        collection: 'privacy-requests',
        where: { status: { in: ['received', 'in_progress'] } },
        sort: 'dueAt',
        limit: 200,
        overrideAccess: true,
      })
      return json({ items: docs })
    }),
  },
  {
    path: '/member/team/privacy/:id/respond',
    method: 'post',
    handler: endpoint(async (req) => {
      const { account: staff } = await requireOpsTeam(req, ['data_controller', 'membership_team'])
      const p = await loadDoc(req, 'privacy-requests', req.routeParams!.id as string)
      const b = (await req.json?.()) ?? ({} as any)
      const flow: Record<string, string[]> = {
        received: ['in_progress', 'declined'],
        in_progress: ['fulfilled', 'declined'],
      }
      if (!flow[p.status]?.includes(b.status))
        throw fail.conflict('invalid_phase', `Cannot move ${p.status} → ${b.status}.`)
      if (b.status === 'declined' && !String(b.responseNote || '').trim())
        throw fail.validation({ responseNote: 'Explain the refusal.' })
      const updated = await req.payload.update({
        collection: 'privacy-requests',
        id: p.id,
        data: {
          status: b.status,
          responseNote: b.responseNote?.trim() || p.responseNote,
          handledBy: staff.id,
          ...(b.status === 'fulfilled' ? { fulfilledAt: new Date().toISOString() } : {}),
        },
        overrideAccess: true,
      })
      await audit(req, staff, {
        action: `privacy.${b.status}`,
        targetType: 'privacy_request',
        targetId: String(p.id),
      })
      return json({ request: updated })
    }),
  },
]
