import type { CollectionConfig } from 'payload'
import { noAccess, serverWrites } from '../lib/collectionAccess'
import { AUTHORITY_ROLES, normaliseScopeType } from '../lib/authority'

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
      // an authority registry key, e.g. focal_point
      validate: (value: unknown) =>
        !value || Object.hasOwn(AUTHORITY_ROLES, String(value)) || 'Unknown authority role.',
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
        if (!value) return true
        const spec =
          siblingData?.role && Object.hasOwn(AUTHORITY_ROLES, siblingData.role)
            ? AUTHORITY_ROLES[siblingData.role]
            : null
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
