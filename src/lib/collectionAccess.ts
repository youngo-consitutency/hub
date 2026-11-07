import type { AnyValue } from './domain'
import type { Access, FieldAccess } from 'payload'
import { getAccessProfile, hasCapability } from './access'

// access for the generated rest/graphql surfaces. domain endpoints authorise
// the actor, then write through the local api with overrideAccess; these rules
// keep the generated api from bypassing that

// there is no console login: nothing writes through the generated api, and
// only signed-in member accounts read where a collection allows it
export const noAccess: Access = () => false

export const isMember: Access = ({ req }) => req.user?.collection === 'accounts'

// field-level equivalents (field access takes a different args shape)
export const noFieldAccess: FieldAccess = () => false

export const isMemberField: FieldAccess = ({ req }) => req.user?.collection === 'accounts'

// domain endpoints write through the local api with overrideAccess, so the
// generated api never needs to
export const serverWrites = {
  create: noAccess,
  update: noAccess,
  delete: noAccess,
} as const

// Capability check for generated-API reads, same as the endpoint guards.
export const grantsCapability = async (req: AnyValue, capability: string) => {
  if (!req.user || req.user.collection !== 'accounts') return false
  const profile = await getAccessProfile(req, req.user)
  return hasCapability(profile, capability)
}
