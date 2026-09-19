import type { CollectionConfig } from 'payload'

// WG contact-point activity log shown in WG workspaces (wg_activities table).
export const WgActivities: CollectionConfig = {
  slug: 'wg-activities',
  admin: {
    useAsTitle: 'title',
    group: 'Membership',
  },
  access: {
    read: ({ req }) => Boolean(req.user),
    create: ({ req }) => Boolean(req.user),
    update: ({ req }) => Boolean(req.user),
  },
  fields: [
    {
      name: 'wg',
      type: 'relationship',
      relationTo: 'working-groups',
      required: true,
      index: true,
    },
    { name: 'title', type: 'text', required: true },
    { name: 'note', type: 'textarea' },
    { name: 'kind', type: 'text', defaultValue: 'update' },
    { name: 'linkUrl', type: 'text' },
    { name: 'postedBy', type: 'relationship', relationTo: 'accounts' },
    { name: 'postedAt', type: 'date' },
  ],
}
