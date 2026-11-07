import type { CollectionConfig } from 'payload'
import { isMember, serverWrites } from '../lib/collectionAccess'
import { AUTHORITY_ROLES } from '../lib/authority'

// role contact channels: a role's mailbox and member-only channel. who holds
// the role comes from authority-records through `role` + `scopeId` (working-
// group rows imply the group's contact point), never from stored names.
// personName is superseded and unread, kept until a data check allows
// dropping the column. channelValue and holders are members-only
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
    { name: 'scopeId', type: 'text' },
    { name: 'personName', type: 'text' },
    { name: 'channelValue', type: 'text' },
    { name: 'sortOrder', type: 'number' },
  ],
}
