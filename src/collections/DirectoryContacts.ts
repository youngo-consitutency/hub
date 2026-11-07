import type { CollectionConfig } from 'payload'
import { isStaffOrMember, staffWrites } from '../lib/collectionAccess'

// role contact channels: a role's mailbox and member-only channel. who holds
// the role comes from authority-records; personName is superseded and no
// longer read, kept only until a data check allows dropping the column.
// channelValue is members-only; /api/directory strips it for anonymous callers
export const DirectoryContacts: CollectionConfig = {
  slug: 'directory-contacts',
  access: {
    read: isStaffOrMember,
    ...staffWrites,
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
    { name: 'personName', type: 'text' },
    { name: 'channelValue', type: 'text' },
    { name: 'sortOrder', type: 'number' },
  ],
}
