import type { PayloadRequest } from 'payload'
import { ApiError, fail } from './respond'
import { getAccessProfile, hasCapability, hasTeamRole } from './access'
import type { AccessProfile } from './access'
import { accountRow, isCwActive, isVerifiedAccount } from './accountStatus'
import type { AccountLike, AccountView, Doc, AnyValue } from './domain'

// The account shape the member UI reads from /api/auth/me and auth responses.

// Re-exported from the leaf module to keep accounts/access acyclic.
export { isVerifiedAccount, isCwActive }

export function requireVerifiedMember(req: PayloadRequest) {
  const account = requireAccount(req)
  if (!isVerifiedAccount(account))
    throw new ApiError(403, 'not_verified', 'Complete onboarding and verification first.')
  return account
}

// CW membership is required for decision rights (S17 §1.1) — a mandate is
// not membership.
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
export function accountView(row: AccountLike | Doc): AccountView
export function accountView(row: AccountLike | Doc | null | undefined): AccountView | null
export function accountView(row: AccountLike | Doc | null | undefined): AccountView | null {
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

// Bearer token (agent/MCP) as well as the cookie — req.user covers both.
export function requireAccount(req: PayloadRequest): AccountLike {
  const user = req.user
  if (!user || user.collection !== 'accounts') {
    throw fail.unauthorized()
  }
  return user as AccountLike
}

export interface MemberContext {
  account: AccountLike
  access: AccessProfile
}

// Account + derived access profile — the context capability gates need.
export async function memberContext(req: PayloadRequest): Promise<MemberContext> {
  const account = requireAccount(req)
  return { account, access: await getAccessProfile(req, account) }
}

export async function verifiedContext(req: PayloadRequest): Promise<MemberContext> {
  const account = requireVerifiedMember(req)
  return { account, access: await getAccessProfile(req, account) }
}

// Team workspaces require the corresponding authority record.
export async function requireTeam(req: PayloadRequest, teamRole: string): Promise<MemberContext> {
  const ctx = await verifiedContext(req)
  if (!hasTeamRole(ctx.access, teamRole))
    throw fail.forbidden('This team workspace is not assigned to your account.')
  return ctx
}

// The accounts console gates on `accounts.manage` (platform mandates only).
export async function requireAccountsManager(req: PayloadRequest): Promise<MemberContext> {
  const ctx = await verifiedContext(req)
  if (!hasCapability(ctx.access, 'accounts.manage'))
    throw fail.forbidden('This console is for platform operators.')
  return ctx
}

// Platform-wide operations gate on `platform.manage`.
export async function requirePlatformOperator(req: PayloadRequest): Promise<MemberContext> {
  const ctx = await verifiedContext(req)
  if (!hasCapability(ctx.access, 'platform.manage'))
    throw fail.forbidden('This area is for platform officers.')
  return ctx
}

export function adminReason(body: AnyValue): string {
  const reason = String(body?.reason || '').trim()
  if (reason.length < 8)
    throw fail.validation({
      _: 'Give a reason of at least 8 characters for this operation.',
    })
  return reason.slice(0, 500)
}

// Payload's auth cookie — set directly to keep the response contract.
export const SESSION_COOKIE = 'payload-token'

export function sessionCookieHeader(token: string, expiresAt: Date | string | number) {
  const secure = process.env.NODE_ENV === 'production' ? '; Secure' : ''
  return `${SESSION_COOKIE}=${encodeURIComponent(token)}; Path=/; HttpOnly; SameSite=Lax; Expires=${new Date(expiresAt).toUTCString()}${secure}`
}

export function clearSessionCookieHeader() {
  const secure = process.env.NODE_ENV === 'production' ? '; Secure' : ''
  return `${SESSION_COOKIE}=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0${secure}`
}
