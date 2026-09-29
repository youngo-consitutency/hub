import type { CollectionConfig } from 'payload'
import { isStaff } from '../lib/collectionAccess'

// Consultation intake (replaces consultation_contributions). Public POST,
// staff-only read.
export const ConsultationContributions: CollectionConfig = {
  slug: 'consultation-contributions',
  access: {
    read: ({ req }) => req.user?.collection === 'users',
    create: () => true,
    update: isStaff,
    delete: isStaff,
  },
  fields: [
    { name: 'kind', type: 'text', required: true, index: true },
    { name: 'name', type: 'text' },
    { name: 'email', type: 'text' },
    { name: 'organization', type: 'text', label: 'Organisation' },
    { name: 'body', type: 'textarea' },
    { name: 'meta', type: 'json' },
    { name: 'consentGiven', type: 'checkbox', defaultValue: false },
  ],
}
