import type { PayloadRequest } from 'payload'
import type { Access, Field, FieldAccess } from 'payload'
import { getAccessProfile, hasCapability } from './access'

// Access for generated rest/graphql surfaces. Domain endpoints authorise then
// write via the local api; these rules stop the generated api bypassing that.

// Only the /cms console's content-document edits write through the generated api;
// it reads only published content or a member's own (or capability-scoped) rows.
export const noAccess: Access = () => false

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
export const grantsCapability = async (req: PayloadRequest, capability: string) => {
  if (!req.user || req.user.collection !== 'accounts') return false
  const profile = await getAccessProfile(req, req.user)
  return hasCapability(profile, capability)
}

// staff with platform.manage read every row; members only their own
export const ownRowsOrStaffRead: Access = async ({ req }) => {
  if (!req.user) return false
  if (await grantsCapability(req, 'platform.manage')) return true
  return { account: { equals: req.user.id } }
}

// the owning member, shared by the per-account workflow collections
export const accountField: Field = {
  name: 'account',
  type: 'relationship',
  relationTo: 'accounts',
  required: true,
  index: true,
}
