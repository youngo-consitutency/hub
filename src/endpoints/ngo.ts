import type { Endpoint } from 'payload'
import { ApiError, endpoint, fail, json, readBody, param } from '../lib/respond'
import { accountView, requireAccount } from '../lib/accounts'
import { rateLimit } from '../lib/rateLimit'
import { emailConfigured, sendEmail } from '../lib/email'
import { randomBytes } from 'node:crypto'
import { sha256Hex } from '../lib/crypto'
import { requirePgPool } from '../lib/pg'
import { audit } from '../lib/audit'
import { appBaseUrl } from '../lib/env'
import { trimmed } from '../lib/text'
import { AFFILIATION_ROLES, requireOrgScope, seatView } from '../lib/ngo'

const inviteLimit = rateLimit({ windowMs: 60 * 60 * 1000, max: 20, scope: 'ngo-invite' })

export const ngoEndpoints: Endpoint[] = [
  {
    path: '/member/ngo/points',
    method: 'get',
    handler: endpoint(async () => {
      throw new ApiError(410, 'retired', 'Contribution points have been retired.')
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
      const b = await readBody(req)
      if (!b.title || !b.kind) throw fail.validation({ title: 'title and kind required.' })
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
      await audit(req, account, {
        action: 'ngo.request_created',
        targetType: 'ngo_request',
        targetId: String(item.id),
      })
      return json({ item }, { status: 201 })
    }),
  },
  {
    path: '/member/ngo/requests/:id',
    method: 'patch',
    handler: endpoint(async (req) => {
      const { account, ctx } = await requireOrgScope(req, 'requests')
      const b = await readBody(req)
      const nextStatus = String(b.status || 'done')
      if (!['open', 'in_progress', 'done', 'declined'].includes(nextStatus))
        throw fail.validation({ status: 'Invalid request status.' })
      const pool = requirePgPool()
      const { rows } = await pool.query(
        'UPDATE ngo_requests SET status=$1, updated_at=now() WHERE id=$2 AND org_account_id=$3 RETURNING *',
        [nextStatus, param(req, 'id'), ctx.orgAccountId],
      )
      const item = rows[0]
      if (!item) throw fail.notFound('Request not found.')
      const updated = item
      await audit(req, account, {
        action: 'ngo.request_status_changed',
        targetType: 'ngo_request',
        targetId: String(item.id),
        after: { status: nextStatus },
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
      await inviteLimit(req)
      const { account, ctx } = await requireOrgScope(req, 'seats')
      const b = await readBody(req)
      const email = trimmed(b.email, 200).toLowerCase()
      if (!email || !email.includes('@'))
        throw fail.validation({ email: 'A valid email address is required.' })
      const seatRole = AFFILIATION_ROLES.includes(b.seatRole) ? b.seatRole : 'representative'
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
        throw new ApiError(
          409,
          'duplicate',
          'This person already holds a seat or an open invitation.',
        )
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
          orgAccount: Number(ctx.orgAccountId),
          email,
          name: trimmed(b.name, 160) || null,
          seatRole,
          status: 'invited',
          inviteTokenHash: sha256Hex(token),
          inviteExpiresAt: new Date(Date.now() + 7 * 24 * 3600 * 1000).toISOString(),
          invitedBy: account.id,
        } as any,
        overrideAccess: true,
        req,
      })
      const base = appBaseUrl()
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
      await audit(req, account, {
        action: 'ngo.seat_invited',
        targetType: 'ngo_seat',
        targetId: String(seat.id),
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
        id: param(req, 'id'),
        overrideAccess: true,
        req,
      })) as any
      if (!seat) throw fail.notFound('Seat not found.')
      if (
        String(typeof seat.orgAccount === 'object' ? seat.orgAccount.id : seat.orgAccount) !==
        ctx.orgAccountId
      )
        throw fail.notFound('Seat not found.')
      const updated = await req.payload.update({
        collection: 'ngo-seats',
        id: seat.id,
        data: { status: 'revoked' } as any,
        overrideAccess: true,
        req,
      })
      await audit(req, account, {
        action: 'ngo.seat_revoked',
        targetType: 'ngo_seat',
        targetId: String(seat.id),
      })
      return json({ seat: seatView(updated) })
    }),
  },
  {
    path: '/member/ngo/invite/:token',
    method: 'get',
    handler: endpoint(async (req) => {
      const token = param(req, 'token')
      const { docs } = await req.payload.find({
        collection: 'ngo-seats',
        where: { inviteTokenHash: { equals: sha256Hex(token) } },
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
      const token = param(req, 'token')
      const { docs } = await req.payload.find({
        collection: 'ngo-seats',
        where: { inviteTokenHash: { equals: sha256Hex(token) } },
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
      if (seat.email && String(seat.email).toLowerCase() !== String(account.email).toLowerCase())
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
]
