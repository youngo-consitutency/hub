import { toCamelCase } from './case'
import type { AccountLike, Doc } from './domain'

// Account-status predicates, a leaf module that keeps the
// accounts → access dependency graph acyclic.

// Account rows arrive from Payload docs (camelCase) and raw SQL
// (snake_case) — normalise once, then read the canonical field names.
export const accountRow = (account: Partial<AccountLike> | null | undefined): Doc =>
  account ? toCamelCase(account) : {}

// Single source for "may use member features"; endpoints must use
// requireVerifiedMember/requireCwMember, not re-implement it.
export function isVerifiedAccount(
  account: Pick<AccountLike, 'hubAccessStatus' | 'memberStatus'> | null | undefined,
): boolean {
  const r = accountRow(account)
  return r.hubAccessStatus === 'active' && r.memberStatus === 'verified'
}

// Active Constituency Work membership (S17): decision rights and mandate
// eligibility. Same predicate the platform bridge uses — keep them aligned.
export function isCwActive(account: AccountLike | null | undefined): boolean {
  const r = accountRow(account)
  return (
    r.membershipTrack === 'constituency_work' &&
    r.constituencyWorkStatus === 'active' &&
    ['active', 'renewal_due'].includes(r.membershipStatus ?? '') &&
    r.hubAccessStatus === 'active'
  )
}
