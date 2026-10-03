// Membership lifecycle: staff-side status transitions, field updates,
// session destruction and activation email. Ported from
// server/lib/memberProfiles.js + membershipAppeals.js + membershipReview.js.
import { ApiError } from './respond'
import { accountView } from './accounts'
import { sendEmail } from './email'
import { appBaseUrl } from './env'
import { requirePgPool } from './pg'

// Port of server/routes/member/guards.js updateMembershipLifecycle +
// server/lib/accounts.js setAccountFields/destroyAllSessions.

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
export const ENDED_MEMBERSHIP_STATUSES = [...CLOSED_MEMBERSHIP_STATUSES, 'rejected']

export { isCwActive } from './accounts'

const ACCOUNT_FIELD_COLUMNS = new Set([
  'member_status',
  'hub_access_status',
  'membership_status',
  'constituency_work_status',
  'onboarding_cohort',
  'renewal_due_at',
  'membership_ended_at',
  'membership_end_reason',
  'verified_at',
  'verified_by',
  'role',
  'email_verified_at',
  'course_passed_at',
  'course_score',
])

export async function findAccountRowById(id: number | string) {
  const pool = requirePgPool()
  const { rows } = await pool.query(`SELECT * FROM accounts WHERE id=$1`, [Number(id)])
  return rows[0] || null
}

// Platform-scope mandates (focal point and peers) may only be ended by
// another platform officer — ordinary team staff cannot touch them.
export async function hasActivePlatformMandate(accountId: number | string) {
  const pool = requirePgPool()
  const { rows } = await pool.query(
    `SELECT 1 FROM authority_records
     WHERE account_id=$1 AND status='active' AND scope_type='platform' LIMIT 1`,
    [Number(accountId)],
  )
  return rows.length > 0
}

export async function setAccountFields(id: number | string, fields: Record<string, any>) {
  const pool = requirePgPool()
  const keys = Object.keys(fields).filter((key) => ACCOUNT_FIELD_COLUMNS.has(key))
  if (!keys.length) return findAccountRowById(id)
  const sets = keys.map((key, i) => `${key}=$${i + 2}`).join(', ')
  const { rows } = await pool.query(
    `UPDATE accounts SET ${sets}, updated_at=now() WHERE id=$1 RETURNING *`,
    [Number(id), ...keys.map((key) => fields[key])],
  )
  return rows[0] || null
}

export async function destroyAllSessions(accountId: number | string) {
  const pool = requirePgPool()
  await pool.query(`DELETE FROM accounts_sessions WHERE _parent_id=$1`, [Number(accountId)])
}

export async function sendMembershipActivatedEmail(account: any) {
  if (!account?.email) return { sent: false, reason: 'missing_recipient' }
  const firstName =
    String(account.firstName || account.first_name || account.name || '')
      .trim()
      .split(/\s+/)[0] || 'there'
  const origin = appBaseUrl()
  try {
    const { delivered } = await sendEmail({
      to: account.email,
      subject: 'Your YOUNGO Hub membership is active',
      text: `Hi ${firstName},\n\nYour YOUNGO Hub membership is now active. Sign in at ${origin}/ to get started.\n\n— YOUNGO Hub`,
    })
    return { sent: delivered }
  } catch (error) {
    return { sent: false, reason: 'send_failed' }
  }
}

export async function updateMembershipLifecycle({
  actor,
  actorIsOfficer,
  targetId,
  body,
}: {
  actor: any
  /** Whether the actor holds platform.manage — gates officer-account edits. */
  actorIsOfficer?: boolean
  targetId: number | string
  body: any
}) {
  const status = String(body?.status || body?.membershipStatus || '')
  if (!MEMBERSHIP_STATUSES.includes(status))
    throw new ApiError(400, 'validation', 'Invalid membership status.')
  const beforeRow = await findAccountRowById(targetId)
  if (!beforeRow) throw new ApiError(404, 'not_found', 'Account not found.')
  const before = accountView(beforeRow)!
  const beforeIsOfficer = await hasActivePlatformMandate(before.id)
  if (!actorIsOfficer && beforeIsOfficer)
    throw new ApiError(
      403,
      'forbidden',
      'Only a platform officer can change an officer\u2019s membership.',
    )
  if (actor.id === before.id && ENDED_MEMBERSHIP_STATUSES.includes(status))
    throw new ApiError(400, 'self_suspend', 'You cannot suspend your own account.')
  if (status === 'active' && !before.coursePassedAt && !beforeIsOfficer)
    throw new ApiError(
      409,
      'course_required',
      'The member must pass the membership course before activation.',
    )
  const reason = String(body?.reason || '').trim()
  if (status === 'terminated' && !reason)
    throw new ApiError(400, 'validation', 'A reason is required when terminating membership.')
  if (status === 'rejected' && !reason)
    throw new ApiError(400, 'validation', 'A reason is required when rejecting an application.')
  if (body?.renewalDueAt && Number.isNaN(Date.parse(body.renewalDueAt)))
    throw new ApiError(400, 'validation', 'Invalid renewal date.')

  const now = new Date().toISOString()
  const closed = CLOSED_MEMBERSHIP_STATUSES.includes(status)
  const ended = ENDED_MEMBERSHIP_STATUSES.includes(status)
  const accessStatus = closed
    ? 'suspended'
    : status === 'rejected'
      ? 'pending_course'
      : ['course_passed', 'awaiting_onboarding', 'active', 'renewal_due'].includes(status)
        ? 'active'
        : 'pending_course'
  const becameActive = status === 'active' && before.membershipStatus !== 'active'
  const updatedRow = await setAccountFields(targetId, {
    membership_status: status,
    hub_access_status: accessStatus,
    ...(status === 'active'
      ? { member_status: 'verified', verified_at: before.verifiedAt || now }
      : {}),
    onboarding_cohort: body?.onboardingCohort || before.onboardingCohort || null,
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
  const updated = accountView(updatedRow)
  if (accessStatus === 'suspended' || status === 'rejected') await destroyAllSessions(targetId)
  let emailSent: boolean | null = null
  if (becameActive) {
    const mail = await sendMembershipActivatedEmail(updated)
    emailSent = mail.sent
  }
  return { before, updated, reason: reason || null, emailSent }
}
