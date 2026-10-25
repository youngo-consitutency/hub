import type { CollectionConfig } from 'payload'
import { grantsCapability, staffWrites } from '../lib/collectionAccess'

// Under-18 safeguarding stop: a parent or legal guardian asks the Membership
// Team to make contact. No link to an account and no child data; rows are
// hard-deleted on close and purged after 12 months (src/lib/guardianEnquiries.ts).
export const GuardianEnquiries: CollectionConfig = {
  slug: 'guardian-enquiries',
  access: {
    read: ({ req }) => grantsCapability(req, 'membership.review'),
    ...staffWrites,
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
