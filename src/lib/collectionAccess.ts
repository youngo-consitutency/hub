import type { Access, FieldAccess } from 'payload'

// Coherent access model for generated REST/GraphQL surfaces.
//
// Member domain operations are authorised inside src/endpoints/* and
// src/lib/*, which write through the Local API with overrideAccess: true
// after establishing the actor. Collection-level access therefore exists to
// prevent the generated APIs from becoming a second, unchecked write path:
// reads stay scoped to the record's visibility, and writes are restricted to
// staff users (the `users` collection) or disabled outright so they must
// flow through a domain endpoint that performs authorisation.

export const isStaff: Access = ({ req }) => req.user?.collection === 'users'

export const isStaffOrMember: Access = ({ req }) =>
  req.user?.collection === 'users' || req.user?.collection === 'accounts'

// Field-level equivalents of the predicates above — field access functions
// receive a different args shape than collection access.
export const isStaffField: FieldAccess = ({ req }) => req.user?.collection === 'users'

export const isStaffOrMemberField: FieldAccess = ({ req }) =>
  req.user?.collection === 'users' || req.user?.collection === 'accounts'

// Any authenticated principal may read; only console staff may write.
// Domain endpoints write via the Local API with overrideAccess after
// authorising the actor, so this does not remove legitimate member flows.
export const staffWrites = {
  create: isStaff,
  update: isStaff,
  delete: isStaff,
} as const
