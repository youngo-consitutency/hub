import type { AnyValue } from '../lib/domain'
import type { CollectionConfig } from 'payload'
import { AUTHORITY_ROLE_KEYS } from '../lib/authority'
import { staffWrites } from '../lib/collectionAccess'

// The single authority store: mandated (S13/S14/S25/S15) or participation
// records, one row per (account, role, scope); the partial unique index
// prevents duplicate actives. `role` is free text — lib/authority.ts resolves
// canonical keys and migrated legacy strings to one vocabulary.
export const AuthorityRecords: CollectionConfig = {
  slug: 'authority-records',
  access: {
    read: ({ req }) => {
      if (!req.user) return false
      if (req.user.collection === 'users') return true
      return { account: { equals: req.user.id } }
    },
    // Records are created through governed flows — never the generated API.
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
      name: 'kind',
      type: 'select',
      required: true,
      options: ['mandate', 'participation'],
      index: true,
    },
    {
      // Canonical registry key; migrated rows may carry legacy strings the
      // resolver maps or reports as unmapped.
      name: 'role',
      type: 'text',
      required: true,
      index: true,
      validate: (value: unknown) => {
        const v = String(value ?? '')
        if (!v.trim()) return 'Required.'
        if (AUTHORITY_ROLE_KEYS.includes(v)) return true
        // Legacy spellings accepted for round-tripping; they grant nothing.
        return /^[a-z0-9._-]+$/i.test(v) || 'Unknown role.'
      },
    },
    {
      name: 'scopeType',
      type: 'select',
      required: true,
      options: [
        'platform',
        'organisation',
        'working_group',
        'operational_team',
        'body',
        'team',
        'event',
        'negotiation_track',
        'negotiation_project',
      ],
    },
    { name: 'scopeId', type: 'text', required: true, index: true },
    {
      // Council seat this record occupies (substitutes: the covered seat).
      name: 'councilSeat',
      type: 'text',
    },
    {
      // For council.substitute rows: the principal mandate they cover.
      name: 'substituteFor',
      type: 'relationship',
      relationTo: 'authority-records',
    },
    {
      name: 'status',
      type: 'select',
      required: true,
      defaultValue: 'active',
      options: ['active', 'inactive', 'expired', 'revoked'],
      index: true,
    },
    { name: 'startsAt', type: 'date', required: true },
    { name: 'endsAt', type: 'date' },
    {
      // Provenance — the decision/selection/election that made the record,
      // or the migrated `assignments` link. Write-once; never editable.
      name: 'provenance',
      type: 'json',
      hooks: {
        beforeChange: [
          ({ originalDoc, value }) =>
            originalDoc ? ((originalDoc as AnyValue).provenance ?? value) : value,
        ],
      },
    },
    {
      name: 'recordedBy',
      type: 'relationship',
      relationTo: 'accounts',
    },
    { name: 'evidence', type: 'text' },
  ],
}
