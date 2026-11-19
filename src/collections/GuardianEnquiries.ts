import type { CollectionConfig } from 'payload'
import { grantsCapability, serverWrites } from '../lib/collectionAccess'

// Under-18 guardian enquiries: no account link or child data; hard-deleted on close, purged after 12 months.
export const GuardianEnquiries: CollectionConfig = {
  slug: 'guardian-enquiries',
  access: {
    read: ({ req }) => grantsCapability(req, 'membership.review'),
    ...serverWrites,
  },
  fields: [
    { name: 'guardianName', type: 'text', required: true },
    { name: 'guardianEmail', type: 'text', required: true },
    {
      name: 'relationship',
      type: 'select',
      required: true,
      options: ['parent', 'legal_guardian'],
    },
    { name: 'consentStatement', type: 'textarea', required: true },
    { name: 'consentedAt', type: 'date', required: true },
  ],
}
