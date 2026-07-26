// Authentication, authorization and membership-lifecycle helpers shared by the
// member route modules. Guards live here so no route file redefines them.
import { getAccessProfile, hasCapability } from '../../lib/access.js'
import { destroyAllSessions, getSessionAccount } from '../../lib/accounts.js'
import { listAccountsForAdmin, setAccountFields } from '../../lib/lifecycle.js'
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
  if (actor.id === before.id && ['expired', 'terminated'].includes(status))
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
  if (body?.renewalDueAt && Number.isNaN(Date.parse(body.renewalDueAt)))
    throw routeError(400, 'validation', 'Invalid renewal date.')

  const now = new Date().toISOString()
  const accessStatus = ['expired', 'terminated'].includes(status)
    ? 'suspended'
    : [
          'course_passed',
          'awaiting_onboarding',
          'active',
          'renewal_due',
        ].includes(status)
      ? 'active'
      : 'pending_course'
  const updated = await setAccountFields(targetId, {
    membership_status: status,
    hub_access_status: accessStatus,
    ...(status === 'active'
      ? { member_status: 'verified', verified_at: before.verifiedAt || now }
      : {}),
    onboarding_cohort:
      body?.onboardingCohort || before.onboardingCohort || null,
    renewal_due_at: body?.renewalDueAt || before.renewalDueAt || null,
    membership_ended_at: ['expired', 'terminated'].includes(status)
      ? now
      : null,
    membership_end_reason: ['expired', 'terminated'].includes(status)
      ? reason.slice(0, 500) || null
      : null,
    constituency_work_status:
      status === 'active'
        ? 'active'
        : status === 'awaiting_onboarding'
          ? 'pending_onboarding'
          : before.constituencyWorkStatus,
  })
  if (accessStatus === 'suspended') await destroyAllSessions(targetId)
  return { before, updated, reason: reason || null }
}
