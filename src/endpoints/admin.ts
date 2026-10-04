import type { Endpoint } from 'payload'
import { ApiError, endpoint, fail, json, readBody, param } from '../lib/respond'
import { accountView, adminReason, requireAccountsManager } from '../lib/accounts'
import { audit } from '../lib/audit'
import { rateLimit } from '../lib/rateLimit'
import {
  updateMembershipLifecycle,
  setAccountFields,
  sendMembershipActivatedEmail,
  findAccountRowById,
} from '../lib/membership'
import { listAccountsForAdmin, queryAccountsForAdmin } from '../lib/adminAccounts'
import { resolveLegacyRole } from '../lib/authority'
import { hasCapability } from '../lib/access'
import { grantAuthority, revokeAuthorityInTx } from '../lib/authorityService'
import { withAuthorityLock } from '../lib/authorityLock'
import { emailConfigured, sendEmail } from '../lib/email'
import { randomBytes } from 'node:crypto'
import { appBaseUrl } from '../lib/env'
import { sha256Hex } from '../lib/crypto'
import type { Doc, AnyValue } from '../lib/domain'

const adminLimit = rateLimit({
  windowMs: 60 * 1000,
  max: 120,
  scope: 'admin',
})

export const adminEndpoints: Endpoint[] = [
  // ── Admin: accounts ───────────────────────────────────────────────
  {
    path: '/member/admin/accounts',
    method: 'get',
    handler: endpoint(async (req) => {
      await adminLimit(req)
      await requireAccountsManager(req)
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
      await requireAccountsManager(req)
      const where: AnyValue = {}
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
      const { account: admin } = await requireAccountsManager(req)
      const id = param(req, 'id')
      const b = await readBody(req)
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
      const { account: admin, access } = await requireAccountsManager(req)
      const id = param(req, 'id')
      const b = await readBody(req)
      const reason = adminReason(b)
      const result = await updateMembershipLifecycle({
        actor: accountView(admin),
        actorIsOfficer: hasCapability(access, 'platform.manage'),
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
    path: '/member/admin/accounts/:id/team-role',
    method: 'post',
    handler: endpoint(async (req) => {
      await adminLimit(req)
      const { account: admin } = await requireAccountsManager(req)
      const id = param(req, 'id')
      const b = await readBody(req)
      const reason = adminReason(b)
      const teamRole = String(b.teamRole || '')
      if (
        !['membership_team', 'gys_policy_team', 'content_editor', 'content_publisher'].includes(
          teamRole,
        )
      )
        throw fail.validation({ teamRole: 'Invalid team role.' })
      const items = await listAccountsForAdmin()
      const target = items.find((item) => item && String(item.id) === id)
      if (!target) throw fail.notFound('Account not found.')
      const roles = new Set(target.teamRoles || [])
      // Team roles are canonical mandates written to `authority-records`
      // (with the shared lock and audit trail).
      const recordRole = resolveLegacyRole('team', teamRole, 'member')
      if (!recordRole) throw fail.validation({ teamRole: 'Invalid team role.' })
      if (b.enabled === false) {
        roles.delete(teamRole)
        // Under ONE advisory lock — including when no record exists — so a
        // racing grant cannot interleave between lookup and revocation:
        // revoke every active record for the tuple, whatever its
        // provenance.
        await withAuthorityLock(req, target.id, async () => {
          const { docs: active } = await req.payload.find({
            collection: 'authority-records',
            where: {
              and: [
                { account: { equals: target.id } },
                { role: { equals: recordRole } },
                { scopeType: { equals: 'team' } },
                { scopeId: { equals: teamRole } },
                { status: { equals: 'active' } },
              ],
            },
            limit: 50,
            overrideAccess: true,
            req,
          })
          for (const record of active as Doc[]) {
            await revokeAuthorityInTx(req, record.id, admin, reason)
          }
        })
      } else {
        roles.add(teamRole)
        try {
          await grantAuthority(req, {
            account: target.id,
            role: recordRole,
            scopeType: 'team',
            scopeId: teamRole,
            evidence: reason,
            recordedBy: admin.id,
            provenance: { source: 'admin_console' },
          })
        } catch (error: AnyValue) {
          // Already holds the mandate — enabling twice is a no-op.
          if (error?.code !== 'duplicate_record') throw error
        }
      }
      // No mirror column: the authority record IS the team assignment —
      // the audit row captures the toggle either way.
      const after = [...roles]
      await audit(req, admin, {
        action: 'account.team_assignment_changed',
        targetType: 'account',
        targetId: id,
        before: { teamRoles: target.teamRoles },
        after: { teamRoles: after },
        reason,
      })
      return json({ account: { ...target, teamRoles: after } })
    }),
  },
  {
    path: '/member/admin/accounts/:id/reset-link',
    method: 'post',
    handler: endpoint(async (req) => {
      await adminLimit(req)
      const { account: admin } = await requireAccountsManager(req)
      const id = param(req, 'id')
      const b = await readBody(req)
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
          id: (reset as Doc).id,
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
