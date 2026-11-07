import type { CollectionConfig } from 'payload'
import { isMemberField, serverWrites } from '../lib/collectionAccess'

export const Submissions: CollectionConfig = {
  slug: 'content-submissions',
  access: {
    read: () => true,
    ...serverWrites,
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
    { name: 'draftUrl', type: 'text', access: { read: isMemberField } },
    { name: 'finalUrl', type: 'text' },
    { name: 'unfcccUrl', type: 'text' },
    { name: 'contributeNote', type: 'textarea' },
  ],
}
