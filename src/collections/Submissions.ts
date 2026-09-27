import type { CollectionConfig } from 'payload'

export const Submissions: CollectionConfig = {
  slug: 'content-submissions',
  admin: {
    useAsTitle: 'title',
    group: 'Content',
    defaultColumns: ['title', 'status', 'deadlineAt'],
  },
  access: {
    read: () => true,
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
    { name: 'draftUrl', type: 'text' },
    { name: 'finalUrl', type: 'text' },
    { name: 'unfcccUrl', type: 'text' },
    { name: 'contributeNote', type: 'textarea' },
  ],
}
