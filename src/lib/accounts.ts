import type { PayloadRequest } from 'payload'
import { ApiError, fail } from './respond'
import { getAccessProfile } from './access'
import type { AccessProfile } from './access'
import { accountRow, isCwActive, isVerifiedAccount } from './accountStatus'
import type { AccountLike, AccountView } from './domain'

// Port of server/lib/accounts.js publicAccount() — the exact shape the SPA
// reads from /api/auth/me and login/register responses.

// Re-exported so callers keep a single import site; the predicates live in
// the leaf module to keep accounts/access acyclic.
export { isVerifiedAccount, isCwActive }

export function requireVerifiedMember(req: PayloadRequest) {
  const account = requireAccount(req)
  if (!isVerifiedAccount(account))
    throw new ApiError(403, 'not_verified', 'Complete onboarding and verification first.')
  return account
}

// Constituency Work membership is required for decision rights (S17 §1.1).
// A mandate is not membership: officers need an active CW record like
// everyone else.
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

// Normalises a Payload doc or raw SQL row into the SPA's account shape.
export function accountView(row: AccountLike | null | undefined): AccountView | null {
  if (!row) return null
  const r = accountRow(row)
  const name = r.name || [r.firstName, r.lastName].filter(Boolean).join(' ')
  const memberStatus = r.memberStatus ?? 'pending_course'
  const role = r.role || 'member'
  const hubAccessStatus =
    r.hubAccessStatus ?? (memberStatus === 'verified' ? 'active' : 'pending_course')
  return {
    id: r.id,
    email: r.email,
    name,
    firstName: r.firstName || null,
    lastName: r.lastName || null,
    phone: r.phone || null,
    gender: r.gender || null,
    entityType: r.entityType,
    membershipTrack: r.membershipTrack,
    country: r.country,
    nationality: r.nationality || null,
    region: r.region || null,
    ageBand: r.ageBand ?? null,
    organizationName: r.organizationName ?? null,
    organizationType: r.organizationType ?? null,
    isUnfcccAdmitted: Boolean(r.isUnfcccAdmitted),
    youthAffiliation: r.youthAffiliation ?? null,
    under18: Boolean(r.under18),
    constituencyWorkStatus: r.constituencyWorkStatus ?? null,
    membershipPolicyVersion: r.membershipPolicyVersion,
    privacyConsent: Boolean(r.privacyConsent),
    privacyNoticeVersion: r.privacyNoticeVersion ?? null,
    privacyConsentAt: r.privacyConsentAt ?? null,
    emailVerifiedAt: r.emailVerifiedAt ?? null,
    memberStatus,
    hubAccessStatus,
    membershipStatus: r.membershipStatus ?? (r.coursePassedAt ? 'course_passed' : 'registered'),
    onboardingCohort: r.onboardingCohort ?? null,
    renewalDueAt: r.renewalDueAt ?? null,
    membershipEndedAt: r.membershipEndedAt ?? null,
    membershipEndReason: r.membershipEndReason ?? null,
    role,
    teamRoles: r.teamRoles ?? [],
    wgInterests: r.wgInterests ?? [],
    coursePassedAt: r.coursePassedAt ?? null,
    courseScore: r.courseScore ?? null,
    verifiedAt: r.verifiedAt ?? null,
    isVerified: isVerifiedAccount({
      hubAccessStatus,
      memberStatus,
    }),
    isNgo: r.entityType === 'organization',
    createdAt: r.createdAt,
    lastLoginAt: r.lastLoginAt ?? null,
    mustChangePassword: Boolean(r.mustChangePassword),
  }
}

// The SPA may also hit with a Bearer token (agent/MCP use) in addition to the
// httpOnly cookie; Payload already populates req.user for both.
export function requireAccount(req: PayloadRequest): AccountLike {
  const user = req.user
  if (!user || user.collection !== 'accounts') {
    throw fail.unauthorized()
  }
  return user as AccountLike
}

// Team workspaces require the corresponding authority record.
export async function requireTeam(
  req: PayloadRequest,
  teamRole: string,
): Promise<{ account: AccountLike; access: AccessProfile }> {
  const account = requireVerifiedMember(req)
  const access = await getAccessProfile(req, account)
  if (!access.teamRoles.includes(teamRole))
    throw fail.forbidden('This team workspace is not assigned to your account.')
  return { account, access }
}

// The accounts console gates on the `accounts.manage` capability, held by
// platform mandates (focal point, internal-management coordinator) — not by
// an account flag.
export async function requireAccountsManager(
  req: PayloadRequest,
): Promise<{ account: AccountLike; access: AccessProfile }> {
  const account = requireVerifiedMember(req)
  const access = await getAccessProfile(req, account)
  if (!access.capabilities.includes('accounts.manage'))
    throw fail.forbidden('This console is for platform operators.')
  return { account, access }
}

// Platform-wide operations (contact-point call scheduling and the like) gate
// on the `platform.manage` capability — the focal point and peers.
export async function requirePlatformOperator(
  req: PayloadRequest,
): Promise<{ account: AccountLike; access: AccessProfile }> {
  const account = requireVerifiedMember(req)
  const access = await getAccessProfile(req, account)
  if (!access.capabilities.includes('platform.manage'))
    throw fail.forbidden('This area is for platform officers.')
  return { account, access }
}

export function adminReason(body: any): string {
  const reason = String(body?.reason || '').trim()
  if (reason.length < 8)
    throw fail.validation({
      _: 'Give a reason of at least 8 characters for this operation.',
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
