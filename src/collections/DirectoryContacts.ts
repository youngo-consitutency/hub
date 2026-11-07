import type { CollectionConfig } from 'payload'
import { isMember, serverWrites } from '../lib/collectionAccess'
import { AUTHORITY_ROLES } from '../lib/authority'

// role contact channels: a mailbox plus a member-only channel per role
// holders come from authority-records via role + scopeId (working-group rows
// imply that group's contact point), never from stored names
// personName is unread; drop the column once nothing needs it
// channelValue and holders are members-only
export const DirectoryContacts: CollectionConfig = {
  slug: 'directory-contacts',
  access: {
    read: isMember,
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
        !value || Boolean(AUTHORITY_ROLES[String(value)]) || 'Unknown authority role.',
    },
    {
      name: 'scopeId',
      type: 'text',
      // a role without its scope can't resolve to anyone
      validate: (value: unknown, { siblingData }: { siblingData?: { role?: string } }) =>
        !siblingData?.role || Boolean(value) || 'Set the scope this role applies to.',
    },
    { name: 'personName', type: 'text' },
    { name: 'channelValue', type: 'text' },
    { name: 'sortOrder', type: 'number' },
  ],
}
