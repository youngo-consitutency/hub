import type { CollectionConfig } from 'payload'
import { isStaffOrMember, staffWrites } from '../lib/collectionAccess'

// Public contact directory. personName/channelValue are members-only fields —
// the /api/directory view strips them for anonymous callers.
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
