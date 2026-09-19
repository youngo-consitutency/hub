import type { CollectionConfig } from 'payload'

// Replaces account_assignments: scoped responsibilities (team roles, WG
// contact/lead, negotiation scopes, platform bodies) with an active window.
export const Assignments: CollectionConfig = {
  slug: 'assignments',
  admin: {
    useAsTitle: 'id',
    group: 'Membership',
    defaultColumns: ['account', 'scopeType', 'scopeId', 'role', 'status'],
  },
  access: {
    read: ({ req }) => {
      if (!req.user) return false
      if (req.user.collection === 'users') return true
      return { account: { equals: req.user.id } }
    },
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
        'organization',
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
      options: ['active', 'inactive', 'expired'],
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
