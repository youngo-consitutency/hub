import type { CollectionConfig } from 'payload'

// Public contact directory. personName/channelValue are members-only fields —
// the /api/directory view strips them for anonymous callers.
export const DirectoryContacts: CollectionConfig = {
  slug: 'directory-contacts',
  admin: {
    useAsTitle: 'roleTitle',
    group: 'Content',
    defaultColumns: ['group', 'roleTitle', 'publicEmail'],
  },
  access: {
    read: () => true,
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
    { name: 'personName', type: 'text', admin: { description: 'Members only' } },
    { name: 'channelValue', type: 'text', admin: { description: 'Members only' } },
    { name: 'sortOrder', type: 'number' },
  ],
}
