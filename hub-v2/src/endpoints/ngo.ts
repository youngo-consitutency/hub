import type { Endpoint, PayloadRequest } from 'payload'
import { ApiError, endpoint, fail, json } from '../lib/respond'
import { accountView, requireAccount } from '../lib/accounts'
import { rateLimit } from '../lib/rateLimit'
import { emailConfigured, sendEmail } from '../lib/email'
import { createHash, randomBytes } from 'node:crypto'
import { requirePgPool } from '../lib/pg'
import { getAccessProfile } from '../lib/access'

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

const AFFILIATION_ROLES = ['affiliate', 'viewer', 'representative']

type OrgContext = {
  orgAccountId: string
  seatRole: string
  canManageRequests: boolean
  canManageSeats: boolean
}

async function resolveOrgContext(
  req: PayloadRequest,
  account: any,
): Promise<OrgContext | null> {
  const requestedOrgId =
    (req.query?.orgId as string) || (req.body as any)?.orgId || null
  if (account.role === 'admin') {
    if (!requestedOrgId) return null
    return {
      orgAccountId: String(requestedOrgId),
      seatRole: 'owner',
      canManageRequests: true,
      canManageSeats: true,
    }
  }
  const { docs } = await req.payload.find({
    collection: 'ngo-seats',
    where: {
      memberAccount: { equals: account.id },
      status: { equals: 'active' },
      ...(requestedOrgId ? { orgAccount: { equals: requestedOrgId } } : {}),
    },
    sort: '-acceptedAt',
    limit: 1,
    overrideAccess: true,
  })
  const seat = docs[0] as any
  if (!seat) return null
  return {
    orgAccountId: String(
      typeof seat.orgAccount === 'object' ? seat.orgAccount.id : seat.orgAccount,
    ),
    seatRole: seat.seatRole,
    canManageRequests: ['owner', 'representative'].includes(seat.seatRole),
    canManageSeats: seat.seatRole === 'owner',
  }
}

async function requireOrgScope(
  req: PayloadRequest,
  permission: 'read' | 'requests' | 'seats' = 'read',
) {
  const account = verifiedAccount(req)
  const ctx = await resolveOrgContext(req, account)
  if (!ctx) throw fail.forbidden('Accredited NGO access required.')
  if (permission === 'requests' && !ctx.canManageRequests)
    throw fail.forbidden('Your seat cannot post requests for this organisation.')
  if (permission === 'seats' && !ctx.canManageSeats)
    throw fail.forbidden('Only the organisation owner can manage seats.')
  return { account, ctx }
}

const seatView = (row: any) => ({
  id: row.id,
  orgAccountId:
    typeof row.orgAccount === 'object'
      ? row.orgAccount?.id
      : (row.orgAccount ?? row.org_account_id),
  memberAccountId:
    typeof row.memberAccount === 'object'
      ? row.memberAccount?.id
      : (row.memberAccount ?? row.member_account_id ?? null),
  email: row.email ?? null,
  name: row.name || null,
  seatRole: row.seatRole ?? row.seat_role,
  status: row.status,
  inviteExpiresAt: row.inviteExpiresAt ?? row.invite_expires_at ?? null,
  createdAt: row.createdAt ?? row.created_at,
  acceptedAt: row.acceptedAt ?? row.accepted_at ?? null,
  memberName: row.member_name || row.name || null,
  memberEmail: row.member_email || row.email || null,
})

const inviteLimit = rateLimit({ windowMs: 60 * 60 * 1000, max: 20, scope: 'ngo-invite' })
const sha256 = (v: string) => createHash('sha256').update(v).digest('hex')

const OPPORTUNITY_KINDS = new Set([
  'event',
  'workshop',
  'hackathon',
  'opportunity',
  'call',
  'training',
])
const OPPORTUNITY_FORMATS = new Set(['online', 'in_person', 'hybrid'])

const trimmed = (v: unknown, max: number) => String(v ?? '').trim().slice(0, max)

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
  })) as any
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

export const ngoEndpoints: Endpoint[] = [
  {
    path: '/member/ngo/points',
    method: 'get',
    handler: endpoint(async () => {
      throw new ApiError(
        410,
        'retired',
        'Contribution points have been retired.',
      )
    }),
  },
  {
    path: '/member/ngo/requests',
    method: 'get',
    handler: endpoint(async (req) => {
      const { ctx } = await requireOrgScope(req)
      const pool = requirePgPool()
      const { rows: items } = await pool.query(
        'SELECT * FROM ngo_requests WHERE org_account_id=$1 ORDER BY created_at DESC LIMIT 100',
        [ctx.orgAccountId],
      )
      const { rows: seatRows } = await pool.query(
        `SELECT s.*, a.name AS member_name, a.email AS member_email
         FROM ngo_seats s
         LEFT JOIN accounts a ON a.id=s.member_account_id
         WHERE s.org_account_id=$1 AND s.status != 'revoked'
         ORDER BY s.created_at ASC`,
        [ctx.orgAccountId],
      )
      return json({
        items,
        seats: seatRows.map(seatView),
        orgAccountId: ctx.orgAccountId,
        permissions: {
          seatRole: ctx.seatRole,
          canWriteRequests: ctx.canManageRequests,
          canManageSeats: ctx.canManageSeats,
        },
        deadlines: [],
      })
    }),
  },
  {
    path: '/member/ngo/requests',
    method: 'post',
    handler: endpoint(async (req) => {
      const { account, ctx } = await requireOrgScope(req, 'requests')
      const b = ((await req.json?.()) || {}) as any
      if (!b.title || !b.kind)
        throw fail.validation({ title: 'title and kind required.' })
      const pool = requirePgPool()
      const { rows } = await pool.query(
        `INSERT INTO ngo_requests (org_account_id, kind, title, body, deadline_at, created_by_id)
         VALUES ($1,$2,$3,$4,$5,$6) RETURNING *`,
        [
          ctx.orgAccountId,
          String(b.kind).slice(0, 80),
          String(b.title).slice(0, 200),
          b.body || null,
          b.deadlineAt || null,
          account.id,
        ],
      )
      const item = rows[0]
      await req.payload.create({
        collection: 'audit-log',
        data: {
          actor: account.id,
          action: 'ngo.request_created',
          targetType: 'ngo_request',
          targetId: String(item.id),
        } as any,
        overrideAccess: true,
        req,
      })
      return json({ item }, { status: 201 })
    }),
  },
  {
    path: '/member/ngo/requests/:id',
    method: 'patch',
    handler: endpoint(async (req) => {
      const { account, ctx } = await requireOrgScope(req, 'requests')
      const b = ((await req.json?.()) || {}) as any
      const nextStatus = String(b.status || 'done')
      if (!['open', 'in_progress', 'done', 'declined'].includes(nextStatus))
        throw fail.validation({ status: 'Invalid request status.' })
      const pool = requirePgPool()
      const { rows } = await pool.query(
        'UPDATE ngo_requests SET status=$1, updated_at=now() WHERE id=$2 AND org_account_id=$3 RETURNING *',
        [nextStatus, req.routeParams?.id, ctx.orgAccountId],
      )
      const item = rows[0]
      if (!item) throw fail.notFound('Request not found.')
      const updated = item
      await req.payload.create({
        collection: 'audit-log',
        data: {
          actor: account.id,
          action: 'ngo.request_status_changed',
          targetType: 'ngo_request',
          targetId: String(item.id),
          after: { status: nextStatus },
        } as any,
        overrideAccess: true,
        req,
      })
      return json({ item: updated })
    }),
  },
  {
    path: '/member/ngo/seats',
    method: 'get',
    handler: endpoint(async (req) => {
      const { ctx } = await requireOrgScope(req)
      const pool = requirePgPool()
      const { rows } = await pool.query(
        `SELECT s.*, a.name AS member_name, a.email AS member_email
         FROM ngo_seats s
         LEFT JOIN accounts a ON a.id=s.member_account_id
         WHERE s.org_account_id=$1 AND s.status != 'revoked'
         ORDER BY s.created_at ASC`,
        [ctx.orgAccountId],
      )
      return json({
        seats: rows.map(seatView),
        orgAccountId: ctx.orgAccountId,
      })
    }),
  },
  {
    path: '/member/ngo/seats/invite',
    method: 'post',
    handler: endpoint(async (req) => {
      inviteLimit(req)
      const { account, ctx } = await requireOrgScope(req, 'seats')
      const b = ((await req.json?.()) || {}) as any
      const email = trimmed(b.email, 200).toLowerCase()
      if (!email || !email.includes('@'))
        throw fail.validation({ email: 'A valid email address is required.' })
      const seatRole = AFFILIATION_ROLES.includes(b.seatRole)
        ? b.seatRole
        : 'representative'
      const dup = await req.payload.find({
        collection: 'ngo-seats',
        where: {
          orgAccount: { equals: ctx.orgAccountId },
          email: { equals: email },
          status: { in: ['invited', 'active', 'requested'] },
        },
        limit: 1,
        overrideAccess: true,
      })
      if (dup.docs[0])
        throw new ApiError(409, 'duplicate', 'This person already holds a seat or an open invitation.')
      if (!emailConfigured())
        throw new ApiError(
          503,
          'email_not_configured',
          'Email delivery must be configured before inviting a seat.',
        )
      const token = randomBytes(24).toString('hex')
      const seat = await req.payload.create({
        collection: 'ngo-seats',
        data: {
          orgAccount: ctx.orgAccountId,
          email,
          name: trimmed(b.name, 160) || null,
          seatRole,
          status: 'invited',
          inviteTokenHash: sha256(token),
          inviteExpiresAt: new Date(Date.now() + 7 * 24 * 3600 * 1000).toISOString(),
          invitedBy: account.id,
        } as any,
        overrideAccess: true,
        req,
      })
      const base = process.env.APP_BASE_URL || 'http://localhost:3000'
      const inviteUrl = `${base}/#/ngo/accept?token=${token}`
      const { delivered } = await sendEmail({
        to: email,
        subject: 'YOUNGO Hub organisation invitation',
        text: `You have been invited to hold a ${seatRole} seat for an accredited NGO on YOUNGO Hub.\n\nReview the invitation: ${inviteUrl}\n\nIt expires in 7 days.`,
      })
      if (!delivered) {
        await req.payload.update({
          collection: 'ngo-seats',
          id: seat.id,
          data: { status: 'revoked' } as any,
          overrideAccess: true,
          req,
        })
        throw new ApiError(
          502,
          'email_delivery_failed',
          'The email provider did not accept the invitation.',
        )
      }
      await req.payload.create({
        collection: 'audit-log',
        data: {
          actor: account.id,
          action: 'ngo.seat_invited',
          targetType: 'ngo_seat',
          targetId: String(seat.id),
        } as any,
        overrideAccess: true,
        req,
      })
      return json(
        {
          seat: seatView(seat),
          note: 'The invitation was sent to the representative. It expires in 7 days.',
        },
        { status: 201 },
      )
    }),
  },
  {
    path: '/member/ngo/seats/:id/revoke',
    method: 'post',
    handler: endpoint(async (req) => {
      const { account, ctx } = await requireOrgScope(req, 'seats')
      const seat = (await req.payload.findByID({
        collection: 'ngo-seats',
        id: String(req.routeParams?.id),
        overrideAccess: true,
        req,
      })) as any
      if (!seat) throw fail.notFound('Seat not found.')
      if (
        String(
          typeof seat.orgAccount === 'object'
            ? seat.orgAccount.id
            : seat.orgAccount,
        ) !== ctx.orgAccountId
      )
        throw fail.notFound('Seat not found.')
      const updated = await req.payload.update({
        collection: 'ngo-seats',
        id: seat.id,
        data: { status: 'revoked' } as any,
        overrideAccess: true,
        req,
      })
      await req.payload.create({
        collection: 'audit-log',
        data: {
          actor: account.id,
          action: 'ngo.seat_revoked',
          targetType: 'ngo_seat',
          targetId: String(seat.id),
        } as any,
        overrideAccess: true,
        req,
      })
      return json({ seat: seatView(updated) })
    }),
  },
  {
    path: '/member/ngo/invite/:token',
    method: 'get',
    handler: endpoint(async (req) => {
      const token = String(req.routeParams?.token)
      const { docs } = await req.payload.find({
        collection: 'ngo-seats',
        where: { inviteTokenHash: { equals: sha256(token) } },
        limit: 1,
        overrideAccess: true,
        depth: 1,
      })
      const seat = docs[0] as any
      if (
        !seat ||
        seat.status !== 'invited' ||
        (seat.inviteExpiresAt && Date.parse(seat.inviteExpiresAt) < Date.now())
      )
        throw fail.notFound('This invitation is no longer valid.')
      const org = seat.orgAccount
      return json({
        seat: {
          ...seatView(seat),
          orgName: org?.organizationName || org?.name || 'Organisation',
        },
      })
    }),
  },
  {
    path: '/member/ngo/invite/:token/accept',
    method: 'post',
    handler: endpoint(async (req) => {
      const account = requireAccount(req)
      const token = String(req.routeParams?.token)
      const { docs } = await req.payload.find({
        collection: 'ngo-seats',
        where: { inviteTokenHash: { equals: sha256(token) } },
        limit: 1,
        overrideAccess: true,
      })
      const seat = docs[0] as any
      if (
        !seat ||
        seat.status !== 'invited' ||
        (seat.inviteExpiresAt && Date.parse(seat.inviteExpiresAt) < Date.now())
      )
        throw fail.notFound('This invitation is no longer valid.')
      if (
        seat.email &&
        String(seat.email).toLowerCase() !== String(account.email).toLowerCase()
      )
        throw fail.forbidden('This invitation was sent to a different email address.')
      const updated = await req.payload.update({
        collection: 'ngo-seats',
        id: seat.id,
        data: {
          memberAccount: account.id,
          status: 'active',
          acceptedAt: new Date().toISOString(),
          inviteTokenHash: null,
        } as any,
        overrideAccess: true,
        req,
      })
      return json({ ok: true, seat: seatView(updated), account: accountView(account) })
    }),
  },
  {
    path: '/member/organisations',
    method: 'get',
    handler: endpoint(async (req) => {
      verifiedAccount(req)
      const term = String(req.query?.search || '').trim().toLowerCase()
      const { docs } = await req.payload.find({
        collection: 'accounts',
        where: { entityType: { equals: 'organization' } },
        limit: 50,
        sort: 'organizationName',
        overrideAccess: true,
      })
      const items = (docs as any[])
        .map((a) => ({
          id: a.id,
          name: a.organizationName || a.name,
          country: a.country || null,
          isUnfcccAdmitted: Boolean(a.isUnfcccAdmitted),
        }))
        .filter((o) =>
          term
            ? `${o.name || ''} ${o.country || ''}`.toLowerCase().includes(term)
            : true,
        )
      return json({ items })
    }),
  },
  {
    path: '/member/affiliations',
    method: 'get',
    handler: endpoint(async (req) => {
      const account = verifiedAccount(req)
      const { docs } = await req.payload.find({
        collection: 'ngo-seats',
        where: { memberAccount: { equals: account.id } },
        sort: '-createdAt',
        limit: 50,
        overrideAccess: true,
        depth: 1,
      })
      return json({
        items: (docs as any[]).map((s) => ({
          ...seatView(s),
          organizationName:
            s.orgAccount?.organizationName || s.orgAccount?.name || null,
        })),
      })
    }),
  },
  {
    path: '/member/affiliations',
    method: 'post',
    handler: endpoint(async (req) => {
      const account = verifiedAccount(req)
      const b = ((await req.json?.()) || {}) as any
      const orgAccountId = String(b.orgAccountId || '').trim()
      if (!orgAccountId)
        throw fail.validation({ orgAccountId: 'Choose an organisation.' })
      const org = (await req.payload.findByID({
        collection: 'accounts',
        id: orgAccountId,
        overrideAccess: true,
        req,
      })) as any
      if (!org || org.entityType !== 'organization')
        throw new ApiError(404, 'unknown_organisation', 'Organisation not found.')
      const dup = await req.payload.find({
        collection: 'ngo-seats',
        where: {
          orgAccount: { equals: orgAccountId },
          memberAccount: { equals: account.id },
          status: { in: ['requested', 'active'] },
        },
        limit: 1,
        overrideAccess: true,
      })
      if (dup.docs[0])
        throw new ApiError(409, 'duplicate', 'You already have a seat or open request with this organisation.')
      const seat = await req.payload.create({
        collection: 'ngo-seats',
        data: {
          orgAccount: orgAccountId,
          memberAccount: account.id,
          email: account.email,
          name: account.name,
          seatRole: 'affiliate',
          status: 'requested',
        } as any,
        overrideAccess: true,
        req,
      })
      await req.payload.create({
        collection: 'audit-log',
        data: {
          actor: account.id,
          action: 'ngo.affiliation_requested',
          targetType: 'ngo_seat',
          targetId: String(seat.id),
          after: { orgAccountId },
        } as any,
        overrideAccess: true,
        req,
      })
      return json({ seat: seatView(seat) }, { status: 201 })
    }),
  },
  {
    path: '/member/affiliations/:id/decide',
    method: 'post',
    handler: endpoint(async (req) => {
      const { account, ctx } = await requireOrgScope(req, 'seats')
      const b = ((await req.json?.()) || {}) as any
      const approve = b.decision === 'approve'
      const seatRole = AFFILIATION_ROLES.includes(b.seatRole)
        ? b.seatRole
        : 'affiliate'
      const seat = (await req.payload.findByID({
        collection: 'ngo-seats',
        id: String(req.routeParams?.id),
        overrideAccess: true,
        req,
      })) as any
      if (!seat) throw fail.notFound('Seat request not found.')
      if (
        String(
          typeof seat.orgAccount === 'object'
            ? seat.orgAccount.id
            : seat.orgAccount,
        ) !== ctx.orgAccountId
      )
        throw fail.notFound('Seat request not found.')
      if (seat.status !== 'requested')
        throw new ApiError(409, 'conflict', 'This request was already decided.')
      const updated = await req.payload.update({
        collection: 'ngo-seats',
        id: seat.id,
        data: approve
          ? {
              status: 'active',
              seatRole,
              acceptedAt: new Date().toISOString(),
            }
          : { status: 'declined' },
        overrideAccess: true,
        req,
      } as any)
      await req.payload.create({
        collection: 'audit-log',
        data: {
          actor: account.id,
          action: approve ? 'ngo.affiliation_approved' : 'ngo.affiliation_declined',
          targetType: 'ngo_seat',
          targetId: String(seat.id),
        } as any,
        overrideAccess: true,
        req,
      })
      return json({ seat: seatView(updated) })
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
        where: { orgAccount: { equals: ctx.orgAccountId } },
        sort: '-createdAt',
        limit: 100,
        overrideAccess: true,
      })
      return json({ items: docs })
    }),
  },
  {
    path: '/member/ngo/opportunities',
    method: 'post',
    handler: endpoint(async (req) => {
      const { account, ctx } = await requireOrgScope(req, 'requests')
      const b = ((await req.json?.()) || {}) as any
      const title = trimmed(b.title, 200)
      if (title.length < 6)
        throw fail.validation({ title: 'Give the posting a title of at least 6 characters.' })
      if (!OPPORTUNITY_KINDS.has(b.kind))
        throw fail.validation({ kind: 'Choose a posting type.' })
      const format = OPPORTUNITY_FORMATS.has(b.format) ? b.format : null
      if (!format) throw fail.validation({ format: 'Choose a format.' })
      const startsAt = b.startsAt ? Date.parse(b.startsAt) : null
      const endsAt = b.endsAt ? Date.parse(b.endsAt) : null
      if (startsAt && endsAt && endsAt < startsAt)
        throw fail.validation({ endsAt: 'The end time cannot be before the start time.' })
      const status = (await orgPostingTrust(req, ctx.orgAccountId))
        ? 'published'
        : 'pending_review'
      const org = (await req.payload.findByID({
        collection: 'accounts',
        id: ctx.orgAccountId,
        overrideAccess: true,
        req,
      })) as any
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
        } as any,
        overrideAccess: true,
        req,
      })
      await req.payload.create({
        collection: 'audit-log',
        data: {
          actor: account.id,
          action: 'ngo.opportunity_created',
          targetType: 'opportunity',
          targetId: String(created.id),
          after: { status },
        } as any,
        overrideAccess: true,
        req,
      })
      return json({ item: created, status }, { status: 201 })
    }),
  },
  {
    path: '/member/ngo/opportunities/:id/withdraw',
    method: 'post',
    handler: endpoint(async (req) => {
      const { account, ctx } = await requireOrgScope(req, 'requests')
      const item = (await req.payload.findByID({
        collection: 'opportunities',
        id: String(req.routeParams?.id),
        overrideAccess: true,
        req,
      })) as any
      if (!item) throw fail.notFound('Posting not found.')
      if (
        String(
          typeof item.orgAccount === 'object'
            ? item.orgAccount.id
            : item.orgAccount,
        ) !== ctx.orgAccountId
      )
        throw fail.notFound('Posting not found.')
      const updated = await req.payload.update({
        collection: 'opportunities',
        id: item.id,
        data: { status: 'withdrawn' } as any,
        overrideAccess: true,
        req,
      })
      await req.payload.create({
        collection: 'audit-log',
        data: {
          actor: account.id,
          action: 'ngo.opportunity_withdrawn',
          targetType: 'opportunity',
          targetId: String(item.id),
        } as any,
        overrideAccess: true,
        req,
      })
      return json({ item: updated })
    }),
  },
  {
    path: '/member/opportunities/:id/review',
    method: 'post',
    handler: endpoint(async (req) => {
      const account = verifiedAccount(req)
      const access = await getAccessProfile(req, account)
      if (!(account.role === 'admin' || access.teamRoles.includes('membership_team')))
        throw fail.forbidden('Posting review is for admins and the Membership Team.')
      const b = ((await req.json?.()) || {}) as any
      const approve = b.decision === 'approve'
      const item = (await req.payload.findByID({
        collection: 'opportunities',
        id: String(req.routeParams?.id),
        overrideAccess: true,
        req,
      })) as any
      if (!item || item.status !== 'pending_review')
        throw new ApiError(409, 'conflict', 'This posting is not awaiting review.')
      const updated = await req.payload.update({
        collection: 'opportunities',
        id: item.id,
        data: {
          status: approve ? 'published' : 'rejected',
          reviewNote: trimmed(b.reviewNote, 2000) || null,
          reviewedAt: new Date().toISOString(),
        } as any,
        overrideAccess: true,
        req,
      })
      return json({ item: updated })
    }),
  },
  {
    // Staff override of the derived "trusted after one approved posting" rule.
    path: '/member/opportunities/trust/:orgAccountId',
    method: 'post',
    handler: endpoint(async (req) => {
      const account = verifiedAccount(req)
      const access = await getAccessProfile(req, account)
      if (!(account.role === 'admin' || access.teamRoles.includes('membership_team')))
        throw fail.forbidden('Posting review is for admins and the Membership Team.')
      const orgAccountId = String(req.routeParams?.orgAccountId)
      const b = ((await req.json?.()) || {}) as any
      const state = String(b.state || '')
      if (!['trusted', 'review_required'].includes(state))
        throw fail.validation({ state: 'Trust state must be trusted or review_required.' })
      const org = (await req.payload.findByID({
        collection: 'accounts',
        id: orgAccountId,
        overrideAccess: true,
        req,
      })) as any
      if (!org || org.entityType !== 'organization')
        throw fail.notFound('Organisation account not found.')
      await req.payload.update({
        collection: 'accounts',
        id: org.id,
        data: { postingTrust: state } as any,
        overrideAccess: true,
        req,
      })
      const result = { orgAccountId, state }
      await req.payload.create({
        collection: 'audit-log',
        data: {
          actor: account.id,
          action: 'ngo.opportunity_trust_set',
          targetType: 'hub_account',
          targetId: orgAccountId,
          after: result,
          reason: trimmed(b.note, 500) || null,
        } as any,
        overrideAccess: true,
        req,
      })
      return json(result)
    }),
  },
  {
    path: '/member/opportunities/:id/unpublish',
    method: 'post',
    handler: endpoint(async (req) => {
      const account = verifiedAccount(req)
      const access = await getAccessProfile(req, account)
      if (!(account.role === 'admin' || access.teamRoles.includes('membership_team')))
        throw fail.forbidden()
      const updated = await req.payload.update({
        collection: 'opportunities',
        id: String(req.routeParams?.id),
        data: { status: 'withdrawn' } as any,
        overrideAccess: true,
        req,
      })
      return json({ item: updated })
    }),
  },
]
