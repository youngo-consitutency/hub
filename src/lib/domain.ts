// Canonical shapes crossing the endpoint/library boundary.
//
// Account rows arrive as Payload docs (camelCase) or raw SQL rows
// (snake_case) — `accountRow` normalises them, `accountView` projects the
// SPA-facing shape. Everything downstream of requireAccount works with
// AccountLike; anything sent to the client is an AccountView.
//
// This module is a leaf: it declares types only and may be imported by any
// layer without risking a dependency cycle.

/**
 * A Payload collection doc at an untyped boundary. Generated types exist in
 * `payload-types.ts` for strongly-typed call sites; helpers that work across
 * collections or map raw rows take `Doc` until they can take a concrete type.
 * The `any` inside is intentional — reads stay permissive like the legacy
 * JavaScript they replaced; tighten per-site as types land.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type Doc = Record<string, any>

/**
 * An untyped scalar, object, or callable at a boundary — where `Doc` is
 * wrong because the value is not necessarily an object. Named so remaining
 * untyped edges stay greppable; tighten per-site as shapes land.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type AnyValue = any

/** Payload relationship field: an id, a populated doc, or empty. */
export type Rel = number | string | { id: number | string } | null | undefined

/**
 * Minimal identity recorded on events and audit entries. Satisfied by
 * AccountLike, AccountView and the platform module's Actor; system events
 * pass null.
 */
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

/** The SPA-facing account projection produced by `accountView`. */
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
