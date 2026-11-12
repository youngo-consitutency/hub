import type { CollectionConfig } from 'payload'
import { noAccess, serverWrites } from '../lib/collectionAccess'

// Consultation intake (replaces consultation_contributions). Public POST goes
// through /api/consultation/contributions, staff-only read.
export const ConsultationContributions: CollectionConfig = {
  slug: 'consultation-contributions',
  access: {
    read: noAccess,
    ...serverWrites,
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
