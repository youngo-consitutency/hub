import type { Endpoint } from 'payload'
import { ApiError, endpoint, fail, json } from '../lib/respond'
import { accountView, adminReason, requireAdmin } from '../lib/accounts'
import { audit } from '../lib/audit'
import { rateLimit } from '../lib/rateLimit'
import {
  updateMembershipLifecycle,
  setAccountFields,
  sendMembershipActivatedEmail,
  findAccountRowById,
} from '../lib/membership'
import {
  setTeamAssignment,
  ensureOwnerSeat,
  listAccountsForAdmin,
  queryAccountsForAdmin,
} from '../lib/adminAccounts'
import { emailConfigured, sendEmail } from '../lib/email'
import { randomBytes } from 'node:crypto'
import { appBaseUrl } from '../lib/env'
import { sha256Hex } from '../lib/crypto'

const adminLimit = rateLimit({
  windowMs: 60 * 1000,
  max: 120,
  scope: 'admin',
})

const ROLE_OPTIONS = ['member', 'admin', 'focal_point', 'wg_contact', 'ngo_admin']

export const adminEndpoints: Endpoint[] = [
  // ── Admin: accounts ───────────────────────────────────────────────
  {
    path: '/member/admin/accounts',
    method: 'get',
    handler: endpoint(async (req) => {
      await adminLimit(req)
      await requireAdmin(req)
      return json(
        await queryAccountsForAdmin({
          search: req.query?.search,
          entityType: req.query?.entityType,
          status: req.query?.status,
          role: req.query?.role,
          sort: req.query?.sort,
          page: req.query?.page,
          pageSize: req.query?.pageSize,
        }),
      )
    }),
  },
  {
    path: '/member/admin/audit',
    method: 'get',
    handler: endpoint(async (req) => {
      await adminLimit(req)
      await requireAdmin(req)
      const where: any = {}
      if (req.query?.action) where.action = { contains: req.query.action }
      if (req.query?.actorId) where.actor = { equals: req.query.actorId }
      const { docs } = await req.payload.find({
        collection: 'audit-log',
        where,
        sort: '-createdAt',
        limit: Math.min(500, Number(req.query?.limit || 200)),
        overrideAccess: true,
      })
      return json({ items: docs })
    }),
  },
  {
    path: '/member/admin/accounts/:id/verify',
    method: 'post',
    handler: endpoint(async (req) => {
      await adminLimit(req)
      const admin = await requireAdmin(req)
      const id = String(req.routeParams?.id)
      const b = ((await req.json?.()) || {}) as any
      const reason = adminReason(b)
      const before = await findAccountRowById(id)
      if (!before) throw fail.notFound('Account not found.')
      const updatedRow = await setAccountFields(id, {
        member_status: 'verified',
        hub_access_status: 'active',
        membership_status: 'active',
        verified_at: new Date().toISOString(),
        verified_by: 'staff',
      })
      const updated = accountView(updatedRow)
      await audit(req, admin, {
        action: 'membership.status_changed',
        targetType: 'account',
        targetId: id,
        before: accountView(before),
        after: updated,
        reason,
      })
      const mail = await sendMembershipActivatedEmail(updated)
      return json({ account: updated, emailSent: mail.sent })
    }),
  },
  {
    path: '/member/admin/accounts/:id/status',
    method: 'patch',
    handler: endpoint(async (req) => {
      await adminLimit(req)
      const admin = await requireAdmin(req)
      const id = String(req.routeParams?.id)
      const b = ((await req.json?.()) || {}) as any
      const reason = adminReason(b)
      const result = await updateMembershipLifecycle({
        actor: accountView(admin),
        targetId: id,
        body: { ...b, reason },
      })
      await audit(req, admin, {
        action: 'membership.status_changed',
        targetType: 'account',
        targetId: id,
        before: result.before,
        after: result.updated,
        reason,
      })
      return json({ account: result.updated })
    }),
  },
  {
    path: '/member/admin/accounts/:id/role',
    method: 'post',
    handler: endpoint(async (req) => {
      await adminLimit(req)
      const admin = await requireAdmin(req)
      const id = String(req.routeParams?.id)
      const b = ((await req.json?.()) || {}) as any
      const reason = adminReason(b)
      const role = String(b.role || 'member')
      if (!ROLE_OPTIONS.includes(role)) throw fail.validation({ role: 'Invalid role.' })
      const items = await listAccountsForAdmin()
      const target = items.find((item: any) => String(item.id) === id)
      if (!target) throw fail.notFound('Account not found.')
      if (target.id === admin.id && role !== 'admin')
        throw new ApiError(400, 'self_demote', 'You cannot remove your own admin access.')
      if (role === 'ngo_admin' && (target.entityType !== 'organization' || !target.isVerified))
        throw fail.validation({
          role: 'Only a verified organisation account can become an NGO administrator.',
        })
      const updatedRow = await setAccountFields(id, { role })
      const updated = accountView(updatedRow)
      if (role === 'ngo_admin') await ensureOwnerSeat(updated)
      await audit(req, admin, {
        action: 'account.platform_role_changed',
        targetType: 'account',
        targetId: id,
        before: { role: target.role },
        after: { role },
        reason,
      })
      return json({ account: updated })
    }),
  },
  {
    path: '/member/admin/accounts/:id/team-role',
    method: 'post',
    handler: endpoint(async (req) => {
      await adminLimit(req)
      const admin = await requireAdmin(req)
      const id = String(req.routeParams?.id)
      const b = ((await req.json?.()) || {}) as any
      const reason = adminReason(b)
      const teamRole = String(b.teamRole || '')
      if (
        !['membership_team', 'gys_policy_team', 'content_editor', 'content_publisher'].includes(
          teamRole,
        )
      )
        throw fail.validation({ teamRole: 'Invalid team role.' })
      const items = await listAccountsForAdmin()
      const target = items.find((item: any) => String(item.id) === id)
      if (!target) throw fail.notFound('Account not found.')
      const roles = new Set(target.teamRoles || [])
      if (b.enabled === false) roles.delete(teamRole)
      else roles.add(teamRole)
      const updatedRow = await setAccountFields(id, { team_roles: [...roles] })
      await setTeamAssignment({
        accountId: id,
        teamRole,
        enabled: b.enabled !== false,
        assignedBy: admin.id,
      })
      await audit(req, admin, {
        action: 'account.team_assignment_changed',
        targetType: 'account',
        targetId: id,
        before: { teamRoles: target.teamRoles },
        after: { teamRoles: [...roles] },
        reason,
      })
      return json({ account: accountView(updatedRow) })
    }),
  },
  {
    path: '/member/admin/accounts/:id/reset-link',
    method: 'post',
    handler: endpoint(async (req) => {
      await adminLimit(req)
      const admin = await requireAdmin(req)
      const id = String(req.routeParams?.id)
      const b = ((await req.json?.()) || {}) as any
      const reason = adminReason(b)
      if (!emailConfigured())
        throw new ApiError(
          503,
          'email_not_configured',
          'Email delivery must be configured before issuing a reset.',
        )
      const targetRow = await findAccountRowById(id)
      if (!targetRow) throw fail.notFound('Account not found.')
      const target = accountView(targetRow)!
      const rawToken = randomBytes(32).toString('hex')
      const tokenHash = sha256Hex(rawToken)
      const expiresAt = new Date(Date.now() + 60 * 60 * 1000)
      const reset = await req.payload.create({
        collection: 'password-resets' as never,
        data: {
          account: target.id,
          email: target.email,
          tokenHash,
          expiresAt: expiresAt.toISOString(),
        } as never,
        overrideAccess: true,
        req,
      })
      const url = `${appBaseUrl()}/reset-password?token=${encodeURIComponent(rawToken)}`
      try {
        await sendEmail({
          to: target.email,
          subject: 'Reset your YOUNGO Hub password',
          text: `Reset your password: ${url}\n\nThis link expires in 1 hour.`,
        })
      } catch {
        await req.payload.delete({
          collection: 'password-resets' as never,
          id: (reset as any).id,
          overrideAccess: true,
          req,
        })
        throw new ApiError(
          502,
          'email_delivery_failed',
          'The email provider did not accept the reset message.',
        )
      }
      await audit(req, admin, {
        action: 'account.password_reset_issued',
        targetType: 'account',
        targetId: id,
        after: { expiresAt: expiresAt.toISOString() },
        reason,
      })
      return json({
        ok: true,
        expiresAt: expiresAt.toISOString(),
        message: 'Password-reset instructions were sent to the account address.',
      })
    }),
  },
]
