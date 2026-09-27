// Authentication, authorisation and membership-lifecycle helpers shared by the
// member route modules. Guards live here so no route file redefines them.
import { getAccessProfile, hasCapability } from '../../lib/access.js'
import { destroyAllSessions, getSessionAccount } from '../../lib/accounts.js'
import {
  listAccountsForAdmin,
  resolveOrgContext,
  setAccountFields,
} from '../../lib/lifecycle.js'
import { sendMembershipActivatedEmail } from '../../lib/membershipMail.js'
import { bearerToken } from '../../lib/security.js'

export async function requireAccount(req, res) {
  const account = await getSessionAccount(bearerToken(req))
  if (!account) {
    res.status(401).json({
      error: { code: 'unauthorized', message: 'Sign in to continue.' },
    })
    return null
  }
  req.account = account
  return account
}

export function requireVerified(req, res) {
  if (!req.account?.isVerified) {
    res.status(403).json({
      error: {
        code: 'not_verified',
        message: 'Complete the membership course to use this feature.',
      },
    })
    return false
  }
  return true
}

export async function requireTeam(req, res, teamRole) {
  const access = await getAccessProfile(req.account)
  if (!access.teamRoles.includes(teamRole)) {
    res.status(403).json({
      error: {
        code: 'forbidden',
        message: 'This team workspace is not assigned to your account.',
      },
    })
    return null
  }
  return access
}

export async function requireCapability(req, res, capability) {
  const access = await getAccessProfile(req.account)
  if (!hasCapability(access, capability)) {
    res.status(403).json({
      error: {
        code: 'forbidden',
        message: 'This content responsibility is not assigned to your account.',
      },
    })
    return null
  }
  return access
}

/**
 * Resolve the organisation the caller is acting for and check the seat role.
 * Sets req.orgAccountId / req.orgContext and returns the account, or null when
 * a response has already been sent.
 */
export async function requireOrgScope(req, res, permission = 'read') {
  const account = await requireAccount(req, res)
  if (!account) return null
  if (!requireVerified(req, res)) return null
  const requestedOrgId = req.query.orgId || req.body?.orgId || null
  const context = await resolveOrgContext(account, requestedOrgId)
  if (!context) {
    res.status(403).json({
      error: { code: 'forbidden', message: 'Accredited NGO access required.' },
    })
    return null
  }
  if (permission === 'requests' && !context.canManageRequests) {
    res.status(403).json({
      error: {
        code: 'forbidden',
        message: 'Viewer seats have read-only access.',
      },
    })
    return null
  }
  if (permission === 'seats' && !context.canManageSeats) {
    res.status(403).json({
      error: {
        code: 'forbidden',
        message: 'Only the organisation owner may manage seats.',
      },
    })
    return null
  }
  req.orgAccountId = context.orgAccountId
  req.orgContext = context
  return account
}

export function requireFocalPoint(req, res) {
  if (!['admin', 'focal_point'].includes(req.account?.role)) {
    res.status(403).json({
      error: { code: 'forbidden', message: 'Focal Point access required.' },
    })
    return false
  }
  return true
}

export const MEMBERSHIP_STATUSES = [
  'registered',
  'course_passed',
  'awaiting_onboarding',
  'active',
  'renewal_due',
  'expired',
  'terminated',
  'rejected',
]

export const CLOSED_MEMBERSHIP_STATUSES = ['expired', 'terminated']

export const ENDED_MEMBERSHIP_STATUSES = [
  ...CLOSED_MEMBERSHIP_STATUSES,
  'rejected',
]

export function routeError(status, code, message) {
  return Object.assign(new Error(message), { status, code })
}

export function sendRouteError(res, error) {
  if (!error.status) return false
  res.status(error.status).json({
    error: { code: error.code || 'request_failed', message: error.message },
  })
  return true
}

export function adminReason(req, res) {
  const reason = String(req.body?.reason || '').trim()
  if (reason.length < 8) {
    res.status(400).json({
      error: {
        code: 'validation',
        message:
          'Give a reason of at least 8 characters for this admin action.',
      },
    })
    return null
  }
  return reason.slice(0, 500)
}

export async function updateMembershipLifecycle({ actor, targetId, body }) {
  const status = String(body?.status || '')
  if (!MEMBERSHIP_STATUSES.includes(status))
    throw routeError(400, 'validation', 'Invalid membership status.')
  const items = await listAccountsForAdmin()
  const before = items.find((item) => item.id === targetId)
  if (!before) throw routeError(404, 'not_found', 'Account not found.')
  if (actor.role !== 'admin' && ['admin', 'focal_point'].includes(before.role))
    throw routeError(
      403,
      'forbidden',
      'Only an admin can change platform staff membership.',
    )
  if (actor.id === before.id && ENDED_MEMBERSHIP_STATUSES.includes(status))
    throw routeError(
      400,
      'self_suspend',
      'You cannot suspend your own admin account.',
    )
  if (
    status === 'active' &&
    !before.coursePassedAt &&
    !['admin', 'focal_point'].includes(before.role)
  )
    throw routeError(
      409,
      'course_required',
      'The member must pass the membership course before activation.',
    )
  const reason = String(body?.reason || '').trim()
  if (status === 'terminated' && !reason)
    throw routeError(
      400,
      'validation',
      'A reason is required when terminating membership.',
    )
  if (status === 'rejected' && !reason)
    throw routeError(
      400,
      'validation',
      'A reason is required when rejecting an application.',
    )
  if (body?.renewalDueAt && Number.isNaN(Date.parse(body.renewalDueAt)))
    throw routeError(400, 'validation', 'Invalid renewal date.')

  const now = new Date().toISOString()
  const closed = CLOSED_MEMBERSHIP_STATUSES.includes(status)
  const ended = ENDED_MEMBERSHIP_STATUSES.includes(status)
  const accessStatus = closed
    ? 'suspended'
    : status === 'rejected'
      ? 'pending_course'
      : [
            'course_passed',
            'awaiting_onboarding',
            'active',
            'renewal_due',
          ].includes(status)
        ? 'active'
        : 'pending_course'
  const becameActive =
    status === 'active' && before.membershipStatus !== 'active'
  const updated = await setAccountFields(targetId, {
    membership_status: status,
    hub_access_status: accessStatus,
    ...(status === 'active'
      ? { member_status: 'verified', verified_at: before.verifiedAt || now }
      : {}),
    onboarding_cohort:
      body?.onboardingCohort || before.onboardingCohort || null,
    renewal_due_at: body?.renewalDueAt || before.renewalDueAt || null,
    membership_ended_at: ended ? now : null,
    membership_end_reason: ended ? reason.slice(0, 500) || null : null,
    constituency_work_status:
      status === 'active'
        ? 'active'
        : status === 'awaiting_onboarding'
          ? 'pending_onboarding'
          : before.constituencyWorkStatus,
  })
  if (accessStatus === 'suspended' || status === 'rejected')
    await destroyAllSessions(targetId)
  let emailSent = null
  if (becameActive) {
    const mail = await sendMembershipActivatedEmail(updated)
    emailSent = mail.sent
  }
  return { before, updated, reason: reason || null, emailSent }
}
