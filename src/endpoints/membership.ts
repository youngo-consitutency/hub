import type { Endpoint, PayloadRequest } from 'payload'
import { ApiError, endpoint, fail, json } from '../lib/respond'
import { accountView, requireAccount, requireVerifiedMember } from '../lib/accounts'
import { audit } from '../lib/audit'
import { destroyAllSessions, findAccountRowById, setAccountFields } from '../lib/membership'
import { getOwnAppeal, submitAppeal } from '../lib/membershipAppeals'
import { requireTeam } from '../lib/accounts'

// S17 membership lifecycle: Constituency Work renewal (every February),
// resignation, termination, and the two-week handover duty. Account status
// columns are updated through the same helpers the staff console uses, and
// every transition writes an audit-log entry.

const DAY = 86_400_000

// Last day of the next February — CW renewals run annually each February.
function nextCWRenewalDue(from = new Date()): string {
  const year = from.getUTCMonth() > 1 ? from.getUTCFullYear() + 1 : from.getUTCFullYear()
  return new Date(Date.UTC(year, 2, 0, 23, 59, 59)).toISOString()
}

const HANDOVER_ITEMS = [
  'Return YOUNGO documents and files in your possession',
  'Hand over credentials, inboxes and shared accounts you manage',
  'Brief your successor or contact point on pending work',
  'Confirm removal of YOUNGO data from personal devices',
]

async function openHandover(
  req: PayloadRequest,
  {
    accountId,
    reason,
    scopeLabel,
    actorId,
    items = HANDOVER_ITEMS,
  }: {
    accountId: number
    reason: string
    scopeLabel: string
    actorId: number
    items?: string[]
  },
) {
  return req.payload.create({
    collection: 'handovers',
    data: {
      account: accountId,
      reason,
      scopeLabel,
      items: items.map((label) => ({ label, done: false })),
      dueAt: new Date(Date.now() + 14 * DAY).toISOString(),
      status: 'open',
      openedBy: actorId,
      openedAt: new Date().toISOString(),
    } as any,
    overrideAccess: true,
  })
}

// Legacy/appointment scope vocabularies differ slightly; map when limiting
// which scopes a membership change closes.
const APPOINTMENT_SCOPE_EQUIV: Record<string, string> = {
  platform_body: 'body',
  organization: 'organisation',
}

// End active participation rows *and* the mandates they fed — an appointment
// must not outlive the membership exit that ends it (S17). `scopeTypes`
// limits which scopes are closed. Returns the number of rows ended.
async function endAssignments(
  req: PayloadRequest,
  accountId: number,
  { scopeTypes }: { scopeTypes?: string[] } = {},
) {
  const and: any[] = [{ account: { equals: accountId } }, { status: { equals: 'active' } }]
  if (scopeTypes?.length) and.push({ scopeType: { in: scopeTypes } })
  const { docs } = await req.payload.find({
    collection: 'assignments',
    where: { and },
    limit: 1000,
    overrideAccess: true,
  })
  const ended = new Date().toISOString()
  for (const doc of docs as any[]) {
    await req.payload.update({
      collection: 'assignments',
      id: doc.id,
      data: { status: 'expired', endsAt: ended },
      overrideAccess: true,
    })
  }
  const appointmentAnd: any[] = [
    { account: { equals: accountId } },
    { status: { equals: 'active' } },
  ]
  if (scopeTypes?.length) {
    appointmentAnd.push({
      scopeType: { in: scopeTypes.map((t) => APPOINTMENT_SCOPE_EQUIV[t] ?? t) },
    })
  }
  const { docs: appointments } = await req.payload.find({
    collection: 'appointments',
    where: { and: appointmentAnd },
    limit: 1000,
    overrideAccess: true,
  })
  for (const doc of appointments as any[]) {
    await req.payload.update({
      collection: 'appointments',
      id: doc.id,
      data: { status: 'expired', endsAt: ended },
      overrideAccess: true,
    })
  }
  return docs.length + appointments.length
}

const handoverView = (h: any) => ({
  id: h.id,
  reason: h.reason,
  scopeLabel: h.scopeLabel,
  items: (h.items ?? []).map((i: any) => ({
    label: i.label,
    done: Boolean(i.done),
    doneAt: i.doneAt,
  })),
  dueAt: h.dueAt,
  status:
    h.status === 'open' && h.dueAt && new Date(h.dueAt).getTime() < Date.now()
      ? 'overdue'
      : h.status,
  openedAt: h.openedAt,
  closedAt: h.closedAt,
})

// Scopes a Constituency Work exit closes — platform/staff teams survive a
// CW resignation; full resignation closes everything.
const CW_SCOPES = ['working_group', 'platform_body', 'body']

export const membershipEndpoints: Endpoint[] = [
  {
    path: '/member/membership/state',
    method: 'get',
    handler: endpoint(async (req) => {
      const account = requireVerifiedMember(req)
      const { docs: handovers } = await req.payload.find({
        collection: 'handovers',
        where: {
          and: [{ account: { equals: account.id } }, { status: { in: ['open', 'overdue'] } }],
        },
        limit: 20,
        overrideAccess: true,
      })
      const [assignmentRes, appointmentRes] = await Promise.all([
        req.payload.find({
          collection: 'assignments',
          where: {
            and: [{ account: { equals: account.id } }, { status: { equals: 'active' } }],
          },
          limit: 200,
          overrideAccess: true,
        }),
        req.payload.find({
          collection: 'appointments',
          where: { account: { equals: account.id } },
          limit: 200,
          overrideAccess: true,
        }),
      ])
      return json({
        membershipStatus: account.membershipStatus,
        membershipTrack: account.membershipTrack,
        constituencyWorkStatus: account.constituencyWorkStatus,
        renewalDueAt: account.renewalDueAt,
        membershipEndedAt: account.membershipEndedAt,
        assignments: (assignmentRes.docs as any[]).map((a) => ({
          id: a.id,
          scopeType: a.scopeType,
          scopeId: a.scopeId,
          role: a.role,
          startsAt: a.startsAt,
          endsAt: a.endsAt,
        })),
        // Mandated responsibilities (WG Contact Points, team roles, Council
        // seats) live in appointments — surfaced with their term and seat.
        appointments: (appointmentRes.docs as any[]).map((a) => ({
          id: a.id,
          appointmentRole: a.appointmentRole,
          scopeType: a.scopeType,
          scopeId: a.scopeId,
          councilSeat: a.councilSeat ?? null,
          status: a.status,
          startsAt: a.startsAt,
          endsAt: a.endsAt,
        })),
        openHandovers: (handovers as any[]).map(handoverView),
      })
    }),
  },
  {
    path: '/member/membership/renew',
    method: 'post',
    handler: endpoint(async (req) => {
      const account = requireVerifiedMember(req)
      if (account.membershipTrack !== 'constituency_work')
        throw fail.validation({
          _: 'Only Constituency Work membership renews annually.',
        })
      if (!['active', 'expired'].includes(account.membershipStatus))
        throw fail.conflict(
          'invalid_state',
          `Cannot renew while membership status is ${account.membershipStatus}.`,
        )
      const due = nextCWRenewalDue()
      const updated = await setAccountFields(account.id, {
        membership_status: 'active',
        constituency_work_status: 'active',
        renewal_due_at: due,
      })
      await audit(req, account, {
        action: 'membership.cw_renewed',
        targetType: 'account',
        targetId: String(account.id),
        after: { renewalDueAt: due },
      })
      return json({
        membershipStatus: updated.membership_status,
        constituencyWorkStatus: updated.constituency_work_status,
        renewalDueAt: updated.renewal_due_at,
      })
    }),
  },
  {
    path: '/member/membership/resign',
    method: 'post',
    handler: endpoint(async (req) => {
      const account = requireVerifiedMember(req)
      const b = ((await req.json?.()) || {}) as any
      const scope = b.scope === 'membership' ? 'membership' : 'constituency_work'
      if (scope === 'constituency_work') {
        if (account.membershipTrack !== 'constituency_work')
          throw fail.validation({ scope: 'You are not on the Constituency Work track.' })
        const ended = await endAssignments(req, account.id, {
          scopeTypes: CW_SCOPES,
        })
        const updated = await setAccountFields(account.id, {
          constituency_work_status: '',
          renewal_due_at: null,
        })
        const handover = await openHandover(req, {
          accountId: account.id,
          reason: 'resignation',
          scopeLabel: 'Constituency Work roles',
          actorId: account.id,
        })
        await audit(req, account, {
          action: 'membership.cw_resigned',
          targetType: 'account',
          targetId: String(account.id),
          after: { assignmentsEnded: ended },
        })
        return json({
          membershipStatus: updated.membership_status,
          constituencyWorkStatus: updated.constituency_work_status || null,
          handover: handoverView(handover),
        })
      }
      // Full resignation: membership ends entirely (S17).
      await endAssignments(req, account.id)
      const updated = await setAccountFields(account.id, {
        membership_status: 'expired',
        membership_ended_at: new Date().toISOString(),
        membership_end_reason: 'resigned',
        constituency_work_status: '',
      })
      await destroyAllSessions(account.id)
      const handover = await openHandover(req, {
        accountId: account.id,
        reason: 'resignation',
        scopeLabel: 'Membership',
        actorId: account.id,
      })
      await audit(req, account, {
        action: 'membership.resigned',
        targetType: 'account',
        targetId: String(account.id),
      })
      return json({
        membershipStatus: updated.membership_status,
        handover: handoverView(handover),
      })
    }),
  },
  {
    path: '/member/handovers',
    method: 'get',
    handler: endpoint(async (req) => {
      const account = requireVerifiedMember(req)
      const { docs } = await req.payload.find({
        collection: 'handovers',
        where: { account: { equals: account.id } },
        sort: '-openedAt',
        limit: 20,
        overrideAccess: true,
      })
      return json({ items: (docs as any[]).map(handoverView) })
    }),
  },
  {
    path: '/member/handovers/:id/items/:idx/complete',
    method: 'post',
    handler: endpoint(async (req) => {
      const account = requireVerifiedMember(req)
      const h = await req.payload
        .findByID({
          collection: 'handovers',
          id: Number(req.routeParams!.id),
          overrideAccess: true,
        })
        .catch(() => {
          throw fail.notFound('Handover not found.')
        })
      const owner = (h.account as any)?.id ?? h.account
      if (owner !== account.id) throw fail.forbidden('This is not your handover.')
      if (h.status !== 'open') throw fail.conflict('invalid_phase', `Handover is ${h.status}.`)
      const idx = Number(req.routeParams!.idx)
      const items = (h.items ?? []) as any[]
      if (!Number.isInteger(idx) || idx < 0 || idx >= items.length)
        throw fail.validation({ idx: 'No such handover item.' })
      items[idx] = {
        ...items[idx],
        done: true,
        doneAt: new Date().toISOString(),
      }
      const allDone = items.every((i) => i.done)
      const updated = await req.payload.update({
        collection: 'handovers',
        id: h.id,
        data: {
          items,
          ...(allDone
            ? {
                status: 'completed',
                closedAt: new Date().toISOString(),
                closedBy: account.id,
              }
            : {}),
        },
        overrideAccess: true,
      })
      await audit(req, account, {
        action: 'membership.handover_item_completed',
        targetType: 'handover',
        targetId: String(h.id),
      })
      return json({ handover: handoverView(updated) })
    }),
  },

  // ── Membership team ───────────────────────────────────────────────
  {
    // Annual renewal expiry sweep (S17): CW members who did not renew by
    // the February deadline lose CW status but keep Network membership.
    path: '/member/team/membership/renewals/run',
    method: 'post',
    handler: endpoint(async (req) => {
      const { account: staff } = await requireTeam(req, 'membership_team')
      const { docs } = await req.payload.find({
        collection: 'accounts',
        where: {
          and: [
            { membershipTrack: { equals: 'constituency_work' } },
            { constituencyWorkStatus: { equals: 'active' } },
            { renewalDueAt: { less_than: new Date().toISOString() } },
          ],
        },
        limit: 10000,
        overrideAccess: true,
      })
      const results: any[] = []
      for (const row of docs as any[]) {
        const ended = await endAssignments(req, row.id, {
          scopeTypes: CW_SCOPES,
        })
        await setAccountFields(row.id, {
          constituency_work_status: '',
          renewal_due_at: null,
        })
        await openHandover(req, {
          accountId: row.id,
          reason: 'cw_expiry',
          scopeLabel: 'Constituency Work roles',
          actorId: staff.id,
        })
        await audit(req, staff, {
          action: 'membership.cw_expired',
          targetType: 'account',
          targetId: String(row.id),
          after: { assignmentsEnded: ended },
        })
        results.push({ accountId: row.id, assignmentsEnded: ended })
      }
      return json({ expired: results.length, items: results })
    }),
  },
  {
    path: '/member/team/membership/accounts/:id/terminate',
    method: 'post',
    handler: endpoint(async (req) => {
      const { account: staff } = await requireTeam(req, 'membership_team')
      const id = String(req.routeParams!.id)
      const b = ((await req.json?.()) || {}) as any
      const reason = String(b.reason || '').trim()
      if (reason.length < 8)
        throw fail.validation({ reason: 'A reason of at least 8 characters is required.' })
      const target = await findAccountRowById(id)
      if (!target) throw fail.notFound('Account not found.')
      if (target.id === staff.id)
        throw fail.validation({ _: 'You cannot terminate your own account.' })
      if (['admin', 'focal_point'].includes(target.role) && staff.role !== 'admin')
        throw fail.forbidden('Only an admin can terminate platform staff membership.')
      await endAssignments(req, target.id)
      const updated = await setAccountFields(id, {
        membership_status: 'terminated',
        membership_ended_at: new Date().toISOString(),
        membership_end_reason: reason.slice(0, 500),
        constituency_work_status: '',
        hub_access_status: 'suspended',
      })
      await destroyAllSessions(target.id)
      const handover = await openHandover(req, {
        accountId: target.id,
        reason: 'termination',
        scopeLabel: 'Membership',
        actorId: staff.id,
      })
      await audit(req, staff, {
        action: 'membership.terminated',
        targetType: 'account',
        targetId: id,
        reason: reason.slice(0, 500),
        after: accountView(updated),
      })
      return json({
        account: accountView(updated),
        handover: handoverView(handover),
      })
    }),
  },
  {
    // End a single mandate/assignment (revocation, vacancy, handover).
    path: '/member/team/membership/accounts/:id/assignments/:aid/end',
    method: 'post',
    handler: endpoint(async (req) => {
      const { account: staff } = await requireTeam(req, 'membership_team')
      const b = ((await req.json?.()) || {}) as any
      const reason = String(b.reason || '').trim()
      if (reason.length < 8)
        throw fail.validation({ reason: 'A reason of at least 8 characters is required.' })
      const assignment = await req.payload
        .findByID({
          collection: 'assignments',
          id: Number(req.routeParams!.aid),
          overrideAccess: true,
        })
        .catch(() => {
          throw fail.notFound('Assignment not found.')
        })
      const owner = (assignment.account as any)?.id ?? assignment.account
      if (String(owner) !== String(req.routeParams!.id))
        throw fail.validation({ id: 'Assignment does not belong to that account.' })
      if (assignment.status !== 'active')
        throw fail.conflict('invalid_phase', `Assignment is already ${assignment.status}.`)
      const updated = await req.payload.update({
        collection: 'assignments',
        id: assignment.id,
        data: { status: 'expired', endsAt: new Date().toISOString() },
        overrideAccess: true,
      })
      // Coordination mandates carry a handover duty to the body they served.
      let handover = null
      if (['contact', 'lead', 'coordinator', 'contact_point'].includes(assignment.role)) {
        handover = await openHandover(req, {
          accountId: Number(owner),
          reason: 'mandate_end',
          scopeLabel: `${assignment.scopeId} ${assignment.scopeType} (${assignment.role})`,
          actorId: staff.id,
        })
      }
      await audit(req, staff, {
        action: 'membership.assignment_ended',
        targetType: 'assignment',
        targetId: String(assignment.id),
        reason: reason.slice(0, 500),
        after: {
          accountId: owner,
          scopeType: assignment.scopeType,
          scopeId: assignment.scopeId,
          role: assignment.role,
        },
      })
      return json({
        assignment: { id: updated.id, status: updated.status, endsAt: updated.endsAt },
        handover: handover ? handoverView(handover) : null,
      })
    }),
  },
  {
    path: '/member/team/membership/handovers',
    method: 'get',
    handler: endpoint(async (req) => {
      await requireTeam(req, 'membership_team')
      const { docs } = await req.payload.find({
        collection: 'handovers',
        where: { status: { in: ['open', 'overdue'] } },
        sort: 'dueAt',
        limit: 200,
        overrideAccess: true,
      })
      const items = []
      for (const h of docs as any[]) {
        const acct =
          typeof h.account === 'object'
            ? { id: h.account.id, name: h.account.name }
            : { id: h.account }
        items.push({ ...handoverView(h), account: acct })
      }
      return json({ items })
    }),
  },
  {
    // Close a handover without full completion (e.g. member unreachable —
    // data access is already revoked; record the decision).
    path: '/member/team/membership/handovers/:id/waive',
    method: 'post',
    handler: endpoint(async (req) => {
      const { account: staff } = await requireTeam(req, 'membership_team')
      const b = ((await req.json?.()) || {}) as any
      const reason = String(b.reason || '').trim()
      if (reason.length < 8)
        throw fail.validation({ reason: 'A reason of at least 8 characters is required.' })
      const h = await req.payload
        .findByID({
          collection: 'handovers',
          id: Number(req.routeParams!.id),
          overrideAccess: true,
        })
        .catch(() => {
          throw fail.notFound('Handover not found.')
        })
      if (h.status !== 'open') throw fail.conflict('invalid_phase', `Handover is ${h.status}.`)
      const updated = await req.payload.update({
        collection: 'handovers',
        id: h.id,
        data: {
          status: 'waived',
          notes: reason.slice(0, 500),
          closedAt: new Date().toISOString(),
          closedBy: staff.id,
        },
        overrideAccess: true,
      })
      await audit(req, staff, {
        action: 'membership.handover_waived',
        targetType: 'handover',
        targetId: String(h.id),
        reason: reason.slice(0, 500),
      })
      return json({ handover: handoverView(updated) })
    }),
  },

  // ── Membership appeal ─────────────────────────────────────────────
  {
    path: '/member/membership/appeal',
    method: 'get',
    handler: endpoint(async (req) => {
      const account = requireAccount(req)
      return json({
        membershipStatus: account.membershipStatus,
        membershipEndReason: account.membershipEndReason || null,
        appeal: await getOwnAppeal(account.id),
      })
    }),
  },
  {
    // Raw file body: X-Identity-Kind + X-Appeal-Statement (URI-encoded) headers,
    // Content-Type = the file's type. Matches the legacy SPA apiPostFile call.
    path: '/member/membership/appeal',
    method: 'post',
    handler: endpoint(async (req) => {
      const account = requireAccount(req)
      if (account.membershipStatus !== 'rejected') {
        throw new ApiError(409, 'not_rejected', 'Only a rejected application can be appealed.')
      }
      const bytes = Buffer.from(await (req as any).arrayBuffer())
      const identityKind = String(req.headers.get('x-identity-kind') || '')
      const statement = decodeURIComponent(String(req.headers.get('x-appeal-statement') || ''))
      const appeal = await submitAppeal({
        account,
        statement,
        identityKind,
        bytes,
        contentType: String(req.headers.get('content-type') || ''),
      })
      await audit(req, account, {
        action: 'membership.appeal_submitted',
        targetType: 'membership_appeal',
        targetId: String(appeal.id),
      })
      return Response.json({ appeal }, { status: 201 })
    }),
  },
]
