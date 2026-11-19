// Canonical shapes across the endpoint/library boundary. Types-only leaf,
// safe to import from any layer.

/** A Payload collection doc at an untyped boundary; the `any` is intentional, tighten per-site. */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type Doc = Record<string, any>

/** An untyped value at a boundary where `Doc` is wrong; named to stay greppable. */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type AnyValue = any

/** Minimal identity recorded on events and audit entries; system events pass null. */
export interface ActorLike {
  id: number | string
  email?: string
}

/** Minimal account identity — Payload user docs, SQL rows and views all satisfy it. */
export interface AccountLike {
  id: number
  email: string
  entityType?: string
  membershipTrack?: string | null
  constituencyWorkStatus?: string | null
  membershipStatus?: string | null
  hubAccessStatus?: string | null
  memberStatus?: string | null
  [key: string]: AnyValue
}

/** The member-facing account projection produced by `accountView`. */
export interface AccountView {
  id: number
  email: string
  name?: string
  firstName?: string | null
  lastName?: string | null
  phone?: string | null
  gender?: string | null
  entityType?: string
  membershipTrack?: string | null
  country?: string | null
  nationality?: string | null
  region?: string | null
  ageBand?: string | null
  organizationName?: string | null
  organizationType?: string | null
  isUnfcccAdmitted: boolean
  youthAffiliation?: string | null
  under18: boolean
  constituencyWorkStatus: string | null
  membershipPolicyVersion?: string | null
  privacyConsent: boolean
  privacyNoticeVersion?: string | null
  privacyConsentAt: string | null
  emailVerifiedAt: string | null
  memberStatus?: string
  hubAccessStatus: string
  membershipStatus: string
  onboardingCohort?: string | null
  renewalDueAt?: string | null
  membershipEndedAt?: string | null
  membershipEndReason?: string | null
  /** Technical account kind — always 'member'; authority lives in records. */
  role: string
  teamRoles: string[]
  wgInterests: string[]
  coursePassedAt: string | null
  courseScore?: number | null
  verifiedAt: string | null
  isVerified: boolean
  isNgo: boolean
  createdAt?: string
  lastLoginAt?: string | null
  mustChangePassword: boolean
  [key: string]: AnyValue
}
