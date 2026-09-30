import type { CollectionConfig } from 'payload'
import { staffWrites } from '../lib/collectionAccess'

// Participation ledger: working-group/body membership and negotiation
// scopes. Mandated responsibilities live in `appointments` — rows here that
// predate that split still resolve through the explicit map in
// lib/appointments.ts.
export const Assignments: CollectionConfig = {
  slug: 'assignments',
  access: {
    read: ({ req }) => {
      if (!req.user) return false
      if (req.user.collection === 'users') return true
      return { account: { equals: req.user.id } }
    },
    // Assignments are granted through governed appointment/selection flows,
    // never written directly over the generated API.
    ...staffWrites,
  },
  fields: [
    {
      name: 'account',
      type: 'relationship',
      relationTo: 'accounts',
      required: true,
      index: true,
    },
    {
      name: 'scopeType',
      type: 'select',
      required: true,
      options: [
        'team',
        'working_group',
        'negotiation_track',
        'negotiation_project',
        'platform_body',
        'body',
        { label: 'Organisation', value: 'organization' },
        'platform',
      ],
    },
    { name: 'scopeId', type: 'text', required: true, index: true },
    { name: 'role', type: 'text', required: true, defaultValue: 'member' },
    { name: 'appointmentEvidence', type: 'text' },
    {
      name: 'status',
      type: 'select',
      required: true,
      defaultValue: 'active',
      options: ['active', 'inactive', 'expired', 'revoked'],
      index: true,
    },
    { name: 'startsAt', type: 'date' },
    { name: 'endsAt', type: 'date' },
    {
      name: 'assignedBy',
      type: 'relationship',
      relationTo: 'accounts',
    },
  ],
}
