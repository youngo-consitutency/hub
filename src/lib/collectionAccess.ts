import type { AnyValue } from './domain'
import type { Access, FieldAccess } from 'payload'
import { getAccessProfile, hasCapability } from './access'

// Access model for generated REST/GraphQL surfaces. Domain endpoints
// authorise actors then write via the Local API with overrideAccess;
// collection access exists so generated APIs can't bypass that — reads stay
// scoped, writes are staff-only or disabled.

export const isStaff: Access = ({ req }) => req.user?.collection === 'users'

export const isStaffOrMember: Access = ({ req }) =>
  req.user?.collection === 'users' || req.user?.collection === 'accounts'

// Field-level equivalents (field access takes a different args shape).
export const isStaffField: FieldAccess = ({ req }) => req.user?.collection === 'users'

export const isStaffOrMemberField: FieldAccess = ({ req }) =>
  req.user?.collection === 'users' || req.user?.collection === 'accounts'

// Any authenticated principal reads; only console staff writes. Domain
// endpoints write via overrideAccess, so legitimate flows are unaffected.
export const staffWrites = {
  create: isStaff,
  update: isStaff,
  delete: isStaff,
} as const

// Capability check for generated-API reads, same as the endpoint guards.
export const grantsCapability = async (req: AnyValue, capability: string) => {
  if (!req.user || req.user.collection !== 'accounts') return false
  const profile = await getAccessProfile(req, req.user)
  return hasCapability(profile, capability)
}
