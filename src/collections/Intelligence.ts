import type { CollectionConfig } from 'payload'
import { staffWrites } from '../lib/collectionAccess'

export const ResearchNotes: CollectionConfig = {
  slug: 'research-notes',
  admin: { group: 'Intelligence' },
  access: {
    read: ({ req }) => Boolean(req.user),
    ...staffWrites,
  },
  fields: [
    { name: 'account', type: 'relationship', relationTo: 'accounts', required: true, index: true },
    { name: 'kind', type: 'select', defaultValue: 'research_note', options: ['research_note'], index: true },
    { name: 'title', type: 'text', required: true },
    { name: 'note', type: 'textarea', required: true },
    { name: 'citations', type: 'json', required: true },
    { name: 'status', type: 'select', defaultValue: 'draft', options: ['draft', 'pending_review', 'approved', 'applied', 'rejected'], index: true },
    { name: 'idempotencyKey', type: 'text', index: true },
    { name: 'approvedBy', type: 'relationship', relationTo: 'accounts' },
    { name: 'appliedBy', type: 'relationship', relationTo: 'accounts' },
    { name: 'appliedAt', type: 'date' },
    { name: 'reviewedAt', type: 'date' },
  ],
}
