import type { CollectionConfig } from 'payload'

// Consultation intake (replaces consultation_contributions). Public POST,
// staff-only read.
export const ConsultationContributions: CollectionConfig = {
  slug: 'consultation-contributions',
  admin: {
    useAsTitle: 'id',
    group: 'Content',
  },
  access: {
    read: ({ req }) => req.user?.collection === 'users',
    create: () => true,
  },
  fields: [
    { name: 'kind', type: 'text', required: true, index: true },
    { name: 'name', type: 'text' },
    { name: 'email', type: 'text' },
    { name: 'organization', type: 'text' },
    { name: 'body', type: 'textarea' },
    { name: 'meta', type: 'json' },
    { name: 'consentGiven', type: 'checkbox', defaultValue: false },
  ],
}
