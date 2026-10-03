import type { PayloadRequest } from 'payload'
import { ApiError, fail } from './respond'
import { getAccessProfile } from './access'

// Port of server/lib/accounts.js publicAccount() — the exact shape the SPA
// reads from /api/auth/me and login/register responses.
export const VERIFIED_PLATFORM_ROLES = new Set(['admin', 'focal_point'])

// Single source for "may use member features". Every endpoint must go through
// requireVerifiedMember/requireCwMember below — do not re-implement the check.
export function isVerifiedAccount(account: any): boolean {
  return (
    account?.hubAccessStatus === 'active' &&
    (account?.memberStatus === 'verified' || VERIFIED_PLATFORM_ROLES.has(account?.role))
  )
}

// Active Constituency Work membership (S17): decision rights and mandate
// eligibility. Same predicate the platform bridge uses — keep them aligned.
// Accepts Payload docs (camelCase) and raw SQL rows (snake_case).
export function isCwActive(account: any): boolean {
  if (!account) return false
  const track = account.membershipTrack ?? account.membership_track
  const cwStatus = account.constituencyWorkStatus ?? account.constituency_work_status
  const membership = account.membershipStatus ?? account.membership_status
  const hub = account.hubAccessStatus ?? account.hub_access_status
  return (
    track === 'constituency_work' &&
    cwStatus === 'active' &&
    ['active', 'renewal_due'].includes(membership ?? '') &&
    hub === 'active'
  )
}

export function requireVerifiedMember(req: PayloadRequest) {
  const account = requireAccount(req)
  if (!isVerifiedAccount(account))
    throw new ApiError(403, 'not_verified', 'Complete onboarding and verification first.')
  return account
}

// Constituency Work membership is required for decision rights (S17 §1.1).
// A role label is not membership: admins and focal points need an active CW
// record like everyone else.
export function requireCwMember(req: PayloadRequest) {
  const account = requireVerifiedMember(req)
  if (!isCwActive(account))
    throw new ApiError(
      403,
      'not_constituency_work',
      'Decision rights require active Constituency Work membership (S17 §1.1).',
    )
  return account
}

// Accepts both Payload docs (camelCase) and raw SQL rows (snake_case).
export function accountView(row: any) {
  if (!row) return null
  const first = row.first_name ?? row.firstName
  const last = row.last_name ?? row.lastName
  const name = row.name || [first, last].filter(Boolean).join(' ')
  const memberStatus = row.member_status ?? row.memberStatus ?? 'pending_course'
  const role = row.role || 'member'
  const hubAccessStatus =
    row.hub_access_status ??
    row.hubAccessStatus ??
    (memberStatus === 'verified' ? 'active' : 'pending_course')
  return {
    id: row.id,
    email: row.email,
    name,
    firstName: first || null,
    lastName: last || null,
    phone: row.phone || null,
    gender: row.gender || null,
    entityType: row.entity_type ?? row.entityType,
    membershipTrack: row.membership_track ?? row.membershipTrack,
    country: row.country,
    nationality: row.nationality || null,
    region: row.region || null,
    ageBand: row.age_band ?? row.ageBand ?? null,
    organizationName: row.organization_name ?? row.organizationName ?? null,
    organizationType: row.organization_type ?? row.organizationType ?? null,
    isUnfcccAdmitted: Boolean(row.is_unfccc_admitted ?? row.isUnfcccAdmitted),
    youthAffiliation: row.youth_affiliation ?? row.youthAffiliation ?? null,
    under18: Boolean(row.under_18 ?? row.under18),
    constituencyWorkStatus: row.constituency_work_status ?? row.constituencyWorkStatus ?? null,
    membershipPolicyVersion: row.membership_policy_version ?? row.membershipPolicyVersion,
    privacyConsent: Boolean(row.privacy_consent ?? row.privacyConsent),
    privacyNoticeVersion: row.privacy_notice_version ?? row.privacyNoticeVersion ?? null,
    privacyConsentAt: row.privacy_consent_at ?? row.privacyConsentAt ?? null,
    emailVerifiedAt: row.email_verified_at ?? row.emailVerifiedAt ?? null,
    memberStatus,
    hubAccessStatus,
    membershipStatus:
      row.membership_status ??
      row.membershipStatus ??
      (row.course_passed_at || row.coursePassedAt ? 'course_passed' : 'registered'),
    onboardingCohort: row.onboarding_cohort ?? row.onboardingCohort ?? null,
    renewalDueAt: row.renewal_due_at ?? row.renewalDueAt ?? null,
    membershipEndedAt: row.membership_ended_at ?? row.membershipEndedAt ?? null,
    membershipEndReason: row.membership_end_reason ?? row.membershipEndReason ?? null,
    role,
    teamRoles: row.team_roles ?? row.teamRoles ?? [],
    wgInterests: row.wg_interests ?? row.wgInterests ?? [],
    coursePassedAt: row.course_passed_at ?? row.coursePassedAt ?? null,
    courseScore: row.course_score ?? row.courseScore ?? null,
    verifiedAt: row.verified_at ?? row.verifiedAt ?? null,
    isVerified: isVerifiedAccount({
      hubAccessStatus,
      memberStatus,
      role,
    }),
    isAdmin: role === 'admin',
    isFocalPoint: role === 'focal_point',
    isMandateHolder: ['admin', 'focal_point', 'wg_contact', 'ngo_admin'].includes(role),
    isWgContact: role === 'wg_contact' || role === 'admin',
    isNgo: (row.entity_type ?? row.entityType) === 'organization',
    isNgoAdmin: role === 'ngo_admin' || role === 'admin',
    createdAt: row.created_at ?? row.createdAt,
    lastLoginAt: row.last_login_at ?? row.lastLoginAt ?? null,
    mustChangePassword: Boolean(row.must_change_password ?? row.mustChangePassword),
  }
}

// The SPA may also hit with a Bearer token (agent/MCP use) in addition to the
// httpOnly cookie; Payload already populates req.user for both.
export function requireAccount(req: PayloadRequest): any {
  const user = req.user
  if (!user || user.collection !== 'accounts') {
    throw fail.unauthorized()
  }
  return user
}

export async function requireCapability(req: PayloadRequest, capability: string) {
  const account = requireAccount(req)
  const access = await getAccessProfile(req, account)
  if (!access.capabilities.includes(capability)) throw fail.forbidden()
  return { account, access }
}

// Team workspaces require the corresponding *appointment*. Technical
// administrators do not inherit team authority (S13: administration ≠
// constituency authority).
export async function requireTeam(req: PayloadRequest, teamRole: string) {
  const account = requireVerifiedMember(req)
  const access = await getAccessProfile(req, account)
  if (!access.teamRoles.includes(teamRole))
    throw fail.forbidden('This team workspace is not assigned to your account.')
  return { account, access }
}

export async function requireAdmin(req: PayloadRequest) {
  const account = requireVerifiedMember(req)
  if (account.role !== 'admin') throw fail.forbidden('This console is for administrators.')
  return account
}

export function adminReason(body: any): string {
  const reason = String(body?.reason || '').trim()
  if (reason.length < 8)
    throw fail.validation({
      _: 'Give a reason of at least 8 characters for this admin action.',
    })
  return reason.slice(0, 500)
}

// Payload's auth cookie. Setting it ourselves keeps the legacy
// {ok, token, account, expiresAt} response contract.
export const SESSION_COOKIE = 'payload-token'

export function sessionCookieHeader(token: string, expiresAt: Date | string | number) {
  const secure = process.env.NODE_ENV === 'production' ? '; Secure' : ''
  return `${SESSION_COOKIE}=${encodeURIComponent(token)}; Path=/; HttpOnly; SameSite=Lax; Expires=${new Date(expiresAt).toUTCString()}${secure}`
}

export function clearSessionCookieHeader() {
  const secure = process.env.NODE_ENV === 'production' ? '; Secure' : ''
  return `${SESSION_COOKIE}=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0${secure}`
}
