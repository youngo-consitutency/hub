import type { CollectionConfig } from 'payload'
import { isStaffOrMemberField, staffWrites } from '../lib/collectionAccess'

export const Submissions: CollectionConfig = {
  slug: 'content-submissions',
  admin: {
    useAsTitle: 'title',
    group: 'Content',
    defaultColumns: ['title', 'status', 'deadlineAt'],
  },
  access: {
    read: () => true,
    ...staffWrites,
  },
  fields: [
    { name: 'slug', type: 'text', required: true, unique: true, index: true },
    { name: 'title', type: 'text', required: true },
    {
      name: 'status',
      type: 'select',
      required: true,
      defaultValue: 'open',
      options: ['open', 'drafting', 'internal_review', 'submitted', 'archived'],
      index: true,
    },
    { name: 'deadlineAt', type: 'date', index: true },
    {
      name: 'wg',
      type: 'relationship',
      relationTo: 'working-groups',
      index: true,
    },
    // Internal drafting workspace link — members only, not for anonymous reads.
    { name: 'draftUrl', type: 'text', access: { read: isStaffOrMemberField } },
    { name: 'finalUrl', type: 'text' },
    { name: 'unfcccUrl', type: 'text' },
    { name: 'contributeNote', type: 'textarea' },
  ],
}
