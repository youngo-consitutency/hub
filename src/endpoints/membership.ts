import type { Endpoint, PayloadRequest } from 'payload'
import { ApiError, endpoint, fail, json, readBody, param } from '../lib/respond'
import { accountView, requireAccount, requireVerifiedMember } from '../lib/accounts'
import { audit } from '../lib/audit'
import { hasCapability } from '../lib/access'
import {
  destroyAllSessions,
  findAccountRowById,
  hasActivePlatformMandate,
  setAccountFields,
} from '../lib/membership'
import { getOwnAppeal, submitAppeal } from '../lib/membershipAppeals'
import { requireTeam } from '../lib/accounts'

import { withAuthorityLock } from '../lib/authorityLock'

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
    // Always bind to the request: inside an authority transaction an
    // unbound create runs on another pooled connection and deadlocks on
    // rows this transaction holds.
    req,
  })
}

// End every active authority record — participation and mandates alike.
// A record must not outlive the membership exit that ends it (S17).
// `scopeTypes` limits which scopes are closed. The sweep runs under the
// shared authority lock so a concurrent grant cannot slip a record past
// the exit. Returns the number of rows ended.
async function endRecords(
  req: PayloadRequest,
  accountId: number,
  { scopeTypes }: { scopeTypes?: string[] } = {},
) {
  return withAuthorityLock(req, accountId, async () => {
    const and: any[] = [{ account: { equals: accountId } }, { status: { equals: 'active' } }]
    if (scopeTypes?.length) and.push({ scopeType: { in: scopeTypes } })
    const { docs } = await req.payload.find({
      collection: 'authority-records',
      where: { and },
      pagination: false,
      overrideAccess: true,
      req,
    })
    const ended = new Date().toISOString()
    for (const doc of docs as any[]) {
      await req.payload.update({
        collection: 'authority-records',
        id: doc.id,
        data: { status: 'expired', endsAt: ended },
        overrideAccess: true,
        req,
      })
    }
    return docs.length
  })
}

// One atomic membership transition: the authority sweep, the account's
// status change, the handover record and the audit entry commit or roll
// back together under the account's advisory lock. A grant arriving between
// the sweep and the status write queues on the lock and then re-verifies
// eligibility against the post-exit state — it cannot slip a mandate past
// the exit. `hooks.afterSweep` exists for concurrency tests only.
export async function applyMembershipTransition(
  req: PayloadRequest,
  accountId: number,
  transition: {
    scopeTypes?: string[]
    accountFields: Record<string, any>
    handover: { reason: string; scopeLabel: string; items?: string[] }
    actor: any
    auditEntry: (result: { ended: number; updated: any }) => Record<string, any>
  },
  hooks?: { afterSweep?: () => Promise<void> },
) {
  return withAuthorityLock(req, accountId, async () => {
    const ended = await endRecords(req, accountId, { scopeTypes: transition.scopeTypes })
    await hooks?.afterSweep?.()
    const updated = await req.payload.update({
      collection: 'accounts',
      id: accountId,
      data: transition.accountFields,
      overrideAccess: true,
      req,
    })
    const handover = await openHandover(req, {
      accountId,
      reason: transition.handover.reason,
      scopeLabel: transition.handover.scopeLabel,
      actorId: transition.actor.id,
      items: transition.handover.items,
    })
    await audit(req, transition.actor, transition.auditEntry({ ended, updated }))
    return { ended, updated, handover }
  })
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
const CW_SCOPES = ['working_group', 'body']

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
      const recordRes = await req.payload.find({
        collection: 'authority-records',
        where: { account: { equals: account.id } },
        pagination: false,
        overrideAccess: true,
      })
      return json({
        membershipStatus: account.membershipStatus,
        membershipTrack: account.membershipTrack,
        constituencyWorkStatus: account.constituencyWorkStatus,
        renewalDueAt: account.renewalDueAt,
        membershipEndedAt: account.membershipEndedAt,
        // All authority — participation and mandates (WG Contact Points,
        // team roles, Council seats) — in one list.
        records: (recordRes.docs as any[]).map((a) => ({
          id: a.id,
          kind: a.kind,
          role: a.role,
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
      if (!['active', 'expired'].includes(String(account.membershipStatus ?? '')))
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
      const b = await readBody(req)
      const scope = b.scope === 'membership' ? 'membership' : 'constituency_work'
      if (scope === 'constituency_work') {
        if (account.membershipTrack !== 'constituency_work')
          throw fail.validation({ scope: 'You are not on the Constituency Work track.' })
        const { updated, handover } = await applyMembershipTransition(req, account.id, {
          scopeTypes: CW_SCOPES,
          accountFields: { constituencyWorkStatus: '', renewalDueAt: null },
          handover: { reason: 'resignation', scopeLabel: 'Constituency Work roles' },
          actor: account,
          auditEntry: (r) => ({
            action: 'membership.cw_resigned',
            targetType: 'account',
            targetId: String(account.id),
            after: { recordsEnded: r.ended },
          }),
        })
        return json({
          membershipStatus: updated.membershipStatus,
          constituencyWorkStatus: updated.constituencyWorkStatus || null,
          handover: handoverView(handover),
        })
      }
      // Full resignation: membership ends entirely (S17).
      const { updated, handover } = await applyMembershipTransition(req, account.id, {
        accountFields: {
          membershipStatus: 'expired',
          membershipEndedAt: new Date().toISOString(),
          membershipEndReason: 'resigned',
          constituencyWorkStatus: '',
        },
        handover: { reason: 'resignation', scopeLabel: 'Membership' },
        actor: account,
        auditEntry: () => ({
          action: 'membership.resigned',
          targetType: 'account',
          targetId: String(account.id),
        }),
      })
      await destroyAllSessions(account.id)
      return json({
        membershipStatus: updated.membershipStatus,
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
          id: Number(param(req, 'id')),
          overrideAccess: true,
        })
        .catch(() => {
          throw fail.notFound('Handover not found.')
        })
      const owner = (h.account as any)?.id ?? h.account
      if (owner !== account.id) throw fail.forbidden('This is not your handover.')
      if (h.status !== 'open') throw fail.conflict('invalid_phase', `Handover is ${h.status}.`)
      const idx = Number(param(req, 'idx'))
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
        const { ended } = await applyMembershipTransition(req, row.id, {
          scopeTypes: CW_SCOPES,
          accountFields: { constituencyWorkStatus: '', renewalDueAt: null },
          handover: { reason: 'cw_expiry', scopeLabel: 'Constituency Work roles' },
          actor: staff,
          auditEntry: (r) => ({
            action: 'membership.cw_expired',
            targetType: 'account',
            targetId: String(row.id),
            after: { recordsEnded: r.ended },
          }),
        })
        results.push({ accountId: row.id, recordsEnded: ended })
      }
      return json({ expired: results.length, items: results })
    }),
  },
  {
    path: '/member/team/membership/accounts/:id/terminate',
    method: 'post',
    handler: endpoint(async (req) => {
      const { account: staff, access } = await requireTeam(req, 'membership_team')
      const id = param(req, 'id')
      const b = await readBody(req)
      const reason = String(b.reason || '').trim()
      if (reason.length < 8)
        throw fail.validation({ reason: 'A reason of at least 8 characters is required.' })
      const target = await findAccountRowById(id)
      if (!target) throw fail.notFound('Account not found.')
      if (target.id === staff.id)
        throw fail.validation({ _: 'You cannot terminate your own account.' })
      if ((await hasActivePlatformMandate(target.id)) && !hasCapability(access, 'platform.manage'))
        throw fail.forbidden('Only a platform officer can terminate an officer\u2019s membership.')
      const { updated, handover } = await applyMembershipTransition(req, target.id, {
        accountFields: {
          membershipStatus: 'terminated',
          membershipEndedAt: new Date().toISOString(),
          membershipEndReason: reason.slice(0, 500),
          constituencyWorkStatus: '',
          hubAccessStatus: 'suspended',
        },
        handover: { reason: 'termination', scopeLabel: 'Membership' },
        actor: staff,
        auditEntry: (r) => ({
          action: 'membership.terminated',
          targetType: 'account',
          targetId: id,
          reason: reason.slice(0, 500),
          after: accountView(r.updated),
        }),
      })
      await destroyAllSessions(target.id)
      return json({
        account: accountView(updated),
        handover: handoverView(handover),
      })
    }),
  },
  {
    // End a single authority record (revocation, vacancy, handover).
    path: '/member/team/membership/accounts/:id/records/:rid/end',
    method: 'post',
    handler: endpoint(async (req) => {
      const { account: staff } = await requireTeam(req, 'membership_team')
      const b = await readBody(req)
      const reason = String(b.reason || '').trim()
      if (reason.length < 8)
        throw fail.validation({ reason: 'A reason of at least 8 characters is required.' })
      const record = await req.payload
        .findByID({
          collection: 'authority-records',
          id: Number(param(req, 'rid')),
          overrideAccess: true,
        })
        .catch(() => {
          throw fail.notFound('Authority record not found.')
        })
      const owner = (record.account as any)?.id ?? record.account
      if (String(owner) !== param(req, 'id'))
        throw fail.validation({ id: 'Record does not belong to that account.' })
      if (record.status !== 'active')
        throw fail.conflict('invalid_phase', `Record is already ${record.status}.`)
      const { updated, handover } = await withAuthorityLock(req, Number(owner), async () => {
        // Re-read under the lock: a concurrent staff request or the
        // endRecords sweep can change the status between the pre-check
        // and this update — only an active record may transition.
        const current = (await req.payload.findByID({
          collection: 'authority-records',
          id: record.id,
          overrideAccess: true,
          req,
        })) as any
        if (current.status !== 'active')
          throw fail.conflict('invalid_phase', `Record is already ${current.status}.`)
        const endsAt = new Date().toISOString()
        const updated = await req.payload.update({
          collection: 'authority-records',
          id: record.id,
          data: { status: 'expired', endsAt },
          overrideAccess: true,
          req,
        })
        // A mandate is a responsibility — ending one opens a handover to
        // the body it served.
        let handover = null
        if (record.kind === 'mandate') {
          handover = await openHandover(req, {
            accountId: Number(owner),
            reason: 'mandate_end',
            scopeLabel: `${record.scopeId} ${record.scopeType} (${record.role})`,
            actorId: staff.id,
          })
        }
        await audit(req, staff, {
          action: 'membership.record_ended',
          targetType: 'authority_record',
          targetId: String(record.id),
          reason: reason.slice(0, 500),
          after: {
            accountId: owner,
            scopeType: record.scopeType,
            scopeId: record.scopeId,
            role: record.role,
          },
        })
        return { updated, handover }
      })
      return json({
        record: { id: updated.id, status: updated.status, endsAt: updated.endsAt },
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
      const b = await readBody(req)
      const reason = String(b.reason || '').trim()
      if (reason.length < 8)
        throw fail.validation({ reason: 'A reason of at least 8 characters is required.' })
      const h = await req.payload
        .findByID({
          collection: 'handovers',
          id: Number(param(req, 'id')),
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
