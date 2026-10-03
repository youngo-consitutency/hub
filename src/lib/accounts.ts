import type { PayloadRequest } from 'payload'
import { ApiError, fail } from './respond'
import { getAccessProfile } from './access'
import { toCamelCase } from './case'

// Port of server/lib/accounts.js publicAccount() — the exact shape the SPA
// reads from /api/auth/me and login/register responses.

// Account rows arrive from Payload docs (camelCase) and raw SQL
// (snake_case) — normalise once, then read the canonical field names.
const accountRow = (account: any): Record<string, any> => (account ? toCamelCase(account) : {})

// Single source for "may use member features". Every endpoint must go through
// requireVerifiedMember/requireCwMember below — do not re-implement the check.
export function isVerifiedAccount(account: any): boolean {
  const r = accountRow(account)
  return r.hubAccessStatus === 'active' && r.memberStatus === 'verified'
}

// Active Constituency Work membership (S17): decision rights and mandate
// eligibility. Same predicate the platform bridge uses — keep them aligned.
export function isCwActive(account: any): boolean {
  const r = accountRow(account)
  return (
    r.membershipTrack === 'constituency_work' &&
    r.constituencyWorkStatus === 'active' &&
    ['active', 'renewal_due'].includes(r.membershipStatus ?? '') &&
    r.hubAccessStatus === 'active'
  )
}

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
export function accountView(row: any) {
  const r = accountRow(row)
  if (!row) return null
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
      role,
    }),
    isNgo: r.entityType === 'organization',
    createdAt: r.createdAt,
    lastLoginAt: r.lastLoginAt ?? null,
    mustChangePassword: Boolean(r.mustChangePassword),
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

// Team workspaces require the corresponding authority record.
export async function requireTeam(req: PayloadRequest, teamRole: string) {
  const account = requireVerifiedMember(req)
  const access = await getAccessProfile(req, account)
  if (!access.teamRoles.includes(teamRole))
    throw fail.forbidden('This team workspace is not assigned to your account.')
  return { account, access }
}

// The accounts console gates on the `accounts.manage` capability, held by
// platform mandates (focal point, internal-management coordinator) — not by
// an account flag.
export async function requireAccountsManager(req: PayloadRequest) {
  const account = requireVerifiedMember(req)
  const access = await getAccessProfile(req, account)
  if (!access.capabilities.includes('accounts.manage'))
    throw fail.forbidden('This console is for platform operators.')
  return { account, access }
}

// Platform-wide operations (contact-point call scheduling and the like) gate
// on the `platform.manage` capability — the focal point and peers.
export async function requirePlatformOperator(req: PayloadRequest) {
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
