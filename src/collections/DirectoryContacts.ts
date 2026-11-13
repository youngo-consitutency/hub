import type { CollectionConfig } from 'payload'
import { noAccess, serverWrites } from '../lib/collectionAccess'
import { AUTHORITY_ROLES, normaliseScopeType, recordKind } from '../lib/authority'

// role contact channels: a mailbox plus a member-only channel per role
// holders come from authority-records via role + scopeId (working-group rows
// imply that group's contact point), never from stored names
// personName is unread; drop the column once nothing needs it
// channelValue and holders are members-only
export const DirectoryContacts: CollectionConfig = {
  slug: 'directory-contacts',
  access: {
    read: noAccess,
    ...serverWrites,
  },
  fields: [
    { name: 'group', type: 'text', required: true, index: true },
    { name: 'roleTitle', type: 'text', required: true },
    { name: 'description', type: 'textarea' },
    { name: 'publicEmail', type: 'text' },
    {
      name: 'wg',
      type: 'relationship',
      relationTo: 'working-groups',
    },
    {
      name: 'role',
      type: 'text',
      // an authority registry key, e.g. focal_point. mandates only: a
      // participation role would list a whole roster past members' privacy settings
      validate: (value: unknown, { siblingData }: { siblingData?: { scopeType?: string } }) => {
        if (!value) return true
        const role = String(value)
        if (!Object.hasOwn(AUTHORITY_ROLES, role)) return 'Unknown authority role.'
        const types = siblingData?.scopeType
          ? [normaliseScopeType(siblingData.scopeType)]
          : AUTHORITY_ROLES[role].scopeTypes
        return (
          types.every((t) => recordKind(t, role) === 'mandate') ||
          'Directory rows name mandate holders, not member lists.'
        )
      },
    },
    {
      name: 'scopeId',
      type: 'text',
      // a role without its scope can't resolve to anyone
      validate: (value: unknown, { siblingData }: { siblingData?: { role?: string } }) =>
        !siblingData?.role || Boolean(value) || 'Set the scope this role applies to.',
    },
    {
      name: 'scopeType',
      type: 'text',
      // needed when the role can sit under more than one scope type
      validate: (value: unknown, { siblingData }: { siblingData?: { role?: string } }) => {
        const spec =
          siblingData?.role && Object.hasOwn(AUTHORITY_ROLES, siblingData.role)
            ? AUTHORITY_ROLES[siblingData.role]
            : null
        // a single-scope role (or no role) can leave it blank and fall back
        if (!value)
          return (spec?.scopeTypes.length ?? 0) <= 1 || 'Choose which scope type this role uses.'
        return (
          Boolean(spec?.scopeTypes.includes(normaliseScopeType(String(value)))) ||
          'Scope type does not fit this role.'
        )
      },
    },
    { name: 'personName', type: 'text' },
    { name: 'channelValue', type: 'text' },
    { name: 'sortOrder', type: 'number' },
  ],
}
