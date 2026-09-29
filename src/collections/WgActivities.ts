import type { CollectionConfig } from 'payload'
import { staffWrites } from '../lib/collectionAccess'

// WG contact-point activity log shown in WG workspaces (wg_activities table).
// Fields mirror the legacy snake_case contract; responses shape them back.
export const WgActivities: CollectionConfig = {
  slug: 'wg-activities',
  access: {
    read: ({ req }) => Boolean(req.user),
    ...staffWrites,
  },
  fields: [
    { name: 'wgSlug', type: 'text', required: true, index: true },
    { name: 'kind', type: 'text', required: true },
    { name: 'title', type: 'text', required: true },
    { name: 'body', type: 'textarea' },
    { name: 'startsAt', type: 'date' },
    { name: 'endsAt', type: 'date' },
    { name: 'url', type: 'text' },
    { name: 'taskForceSlug', type: 'text' },
    { name: 'createdBy', type: 'relationship', relationTo: 'accounts' },
  ],
}
