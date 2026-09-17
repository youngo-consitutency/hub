// Administrator console: accounts, roles, audit trail.
import { Router } from 'express'
import {
  adminReason,
  requireAccount,
  sendRouteError,
  updateMembershipLifecycle,
} from './guards.js'
import { setTeamAssignment } from '../../lib/access.js'
import { listAudit, recordAudit } from '../../lib/audit.js'
import { appOrigin } from '../../lib/config.js'
import {
  ensureOwnerSeat,
  listAccountsForAdmin,
  queryAccountsForAdmin,
  setAccountFields,
} from '../../lib/lifecycle.js'
import {
  createPasswordResetToken,
  invalidatePasswordResetToken,
  resetLink,
} from '../../lib/passwordReset.js'
import {
  deliveryFailure,
  emailConfigured,
  sendTemplatedEmail,
} from '../../lib/notifications/transport.js'
import { sendMembershipActivatedEmail } from '../../lib/membershipMail.js'

export const router = Router()

router.get('/admin/accounts', async (req, res) => {
  const account = await requireAccount(req, res)
  if (!account) return
  if (account.role !== 'admin') {
    return res
      .status(403)
      .json({ error: { code: 'forbidden', message: 'Admin access required.' } })
  }
  res.json(
    await queryAccountsForAdmin({
      search: req.query.search,
      entityType: req.query.entityType,
      status: req.query.status,
      role: req.query.role,
      sort: req.query.sort,
      page: req.query.page,
      pageSize: req.query.pageSize,
    }),
  )
})

router.get('/admin/audit', async (req, res) => {
  const account = await requireAccount(req, res)
  if (!account) return
  if (account.role !== 'admin')
    return res
      .status(403)
      .json({ error: { code: 'forbidden', message: 'Admin access required.' } })
  res.json({
    items: await listAudit({
      limit: req.query.limit,
      targetType: req.query.targetType || null,
    }),
  })
})

router.post('/admin/accounts/:id/verify', async (req, res) => {
  const account = await requireAccount(req, res)
  if (!account) return
  if (account.role !== 'admin') {
    return res
      .status(403)
      .json({ error: { code: 'forbidden', message: 'Admin access required.' } })
  }
  const reason = adminReason(req, res)
  if (!reason) return
  const items = await listAccountsForAdmin()
  const before = items.find((item) => item.id === req.params.id)
  if (!before)
    return res
      .status(404)
      .json({ error: { code: 'not_found', message: 'Account not found.' } })
  const updated = await setAccountFields(req.params.id, {
    member_status: 'verified',
    hub_access_status: 'active',
    membership_status: 'active',
    verified_at: new Date().toISOString(),
    verified_by: 'staff',
  })
  await recordAudit({
    actorId: account.id,
    action: 'membership.status_changed',
    targetType: 'account',
    targetId: req.params.id,
    before,
    after: updated,
    reason,
    requestId: req.requestId,
  })
  const mail = await sendMembershipActivatedEmail(updated)
  res.json({ account: updated, emailSent: mail.sent })
})

router.patch('/admin/accounts/:id/status', async (req, res) => {
  const account = await requireAccount(req, res)
  if (!account) return
  if (account.role !== 'admin')
    return res
      .status(403)
      .json({ error: { code: 'forbidden', message: 'Admin access required.' } })
  const reason = adminReason(req, res)
  if (!reason) return
  try {
    const result = await updateMembershipLifecycle({
      actor: account,
      targetId: req.params.id,
      body: { ...req.body, reason },
    })
    await recordAudit({
      actorId: account.id,
      action: 'membership.status_changed',
      targetType: 'account',
      targetId: req.params.id,
      before: result.before,
      after: result.updated,
      reason,
      requestId: req.requestId,
    })
    res.json({ account: result.updated })
  } catch (error) {
    if (!sendRouteError(res, error)) throw error
  }
})

router.post('/admin/accounts/:id/role', async (req, res) => {
  const account = await requireAccount(req, res)
  if (!account) return
  if (account.role !== 'admin') {
    return res
      .status(403)
      .json({ error: { code: 'forbidden', message: 'Admin access required.' } })
  }
  const reason = adminReason(req, res)
  if (!reason) return
  const role = String(req.body?.role || 'member')
  if (
    !['member', 'focal_point', 'wg_contact', 'ngo_admin', 'admin'].includes(
      role,
    )
  ) {
    return res
      .status(400)
      .json({ error: { code: 'validation', message: 'Invalid role.' } })
  }
  const items = await listAccountsForAdmin()
  const target = items.find((item) => item.id === req.params.id)
  if (!target)
    return res
      .status(404)
      .json({ error: { code: 'not_found', message: 'Account not found.' } })
  if (target.id === account.id && role !== 'admin') {
    return res.status(400).json({
      error: {
        code: 'self_demote',
        message: 'You cannot remove your own admin access.',
      },
    })
  }
  if (
    role === 'ngo_admin' &&
    (target.entityType !== 'organization' || !target.isVerified)
  ) {
    return res.status(400).json({
      error: {
        code: 'validation',
        message:
          'Only a verified organisation account can become an NGO administrator.',
      },
    })
  }
  const updated = await setAccountFields(req.params.id, { role })
  if (role === 'ngo_admin') await ensureOwnerSeat(updated)
  await recordAudit({
    actorId: account.id,
    action: 'account.platform_role_changed',
    targetType: 'account',
    targetId: req.params.id,
    before: { role: target?.role },
    after: { role },
    reason,
    requestId: req.requestId,
  })
  res.json({ account: updated })
})

router.post('/admin/accounts/:id/team-role', async (req, res) => {
  const account = await requireAccount(req, res)
  if (!account) return
  if (account.role !== 'admin') {
    return res
      .status(403)
      .json({ error: { code: 'forbidden', message: 'Admin access required.' } })
  }
  const reason = adminReason(req, res)
  if (!reason) return
  const teamRole = String(req.body?.teamRole || '')
  if (
    ![
      'membership_team',
      'gys_policy_team',
      'content_editor',
      'content_publisher',
    ].includes(teamRole)
  ) {
    return res
      .status(400)
      .json({ error: { code: 'validation', message: 'Invalid team role.' } })
  }
  const items = await listAccountsForAdmin()
  const target = items.find((item) => item.id === req.params.id)
  if (!target)
    return res
      .status(404)
      .json({ error: { code: 'not_found', message: 'Account not found.' } })
  const roles = new Set(target.teamRoles || [])
  if (req.body?.enabled === false) roles.delete(teamRole)
  else roles.add(teamRole)
  const updated = await setAccountFields(req.params.id, {
    team_roles: [...roles],
  })
  await setTeamAssignment({
    accountId: req.params.id,
    teamRole,
    enabled: req.body?.enabled !== false,
    assignedBy: account.id,
  })
  await recordAudit({
    actorId: account.id,
    action: 'account.team_assignment_changed',
    targetType: 'account',
    targetId: req.params.id,
    before: { teamRoles: target.teamRoles },
    after: { teamRoles: [...roles] },
    reason,
    requestId: req.requestId,
  })
  res.json({ account: updated })
})

/** Admin: issue and deliver a password-reset link without exposing the token. */

router.post('/admin/accounts/:id/reset-link', async (req, res) => {
  const account = await requireAccount(req, res)
  if (!account) return
  if (account.role !== 'admin') {
    return res
      .status(403)
      .json({ error: { code: 'forbidden', message: 'Admin access required.' } })
  }
  const reason = adminReason(req, res)
  if (!reason) return
  try {
    if (!emailConfigured()) {
      return res.status(503).json({
        error: {
          code: 'email_not_configured',
          message: 'Email delivery must be configured before issuing a reset.',
        },
      })
    }
    const list = await listAccountsForAdmin()
    const target = list.find((a) => a.id === req.params.id)
    if (!target) {
      return res
        .status(404)
        .json({ error: { code: 'not_found', message: 'Account not found.' } })
    }
    const created = await createPasswordResetToken(target.email)
    if (!created) {
      return res
        .status(404)
        .json({ error: { code: 'not_found', message: 'Account not found.' } })
    }
    const url = resetLink(appOrigin(), created.rawToken)
    try {
      await sendTemplatedEmail({
        to: created.email,
        templateKey: 'password-reset',
        data: { actionUrl: url, actionLabel: 'Reset password' },
      })
    } catch (error) {
      await invalidatePasswordResetToken(created.rawToken)
      const failure = deliveryFailure(error)
      console.warn(
        JSON.stringify({
          event: 'admin_password_reset_email_failed',
          actorId: account.id,
          targetId: target.id,
          code: failure.code,
        }),
      )
      return res.status(502).json({
        error: {
          code: 'email_delivery_failed',
          message: 'The email provider did not accept the reset message.',
        },
      })
    }
    console.log(
      JSON.stringify({
        event: 'admin_password_reset_email_accepted',
        actorId: account.id,
        targetId: target.id,
        expiresAt: created.expiresAt,
      }),
    )
    await recordAudit({
      actorId: account.id,
      action: 'account.password_reset_issued',
      targetType: 'account',
      targetId: target.id,
      after: { expiresAt: created.expiresAt },
      reason,
      requestId: req.requestId,
    })
    res.json({
      ok: true,
      expiresAt: created.expiresAt,
      message: 'Password-reset instructions were sent to the account address.',
    })
  } catch (err) {
    console.error('admin reset-link failed:', err.message)
    res.status(500).json({
      error: {
        code: 'server_error',
        message: 'Could not create reset link.',
      },
    })
  }
})
