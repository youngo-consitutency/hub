import type { AnyValue } from '../lib/domain'
import type { CollectionConfig } from 'payload'
import { AUTHORITY_ROLE_KEYS } from '../lib/authority'
import { staffWrites } from '../lib/collectionAccess'

// The single authority store: every scoped responsibility an account holds —
// mandated (S13/S14/S25/S15: Council seats, team roles, officers) or
// participation (member-joinable WG/body/organisation/negotiation
// membership). One row per (account, role, scope); the partial unique index
// prevents duplicate active records under concurrency. `role` is free text:
// grants write canonical registry keys, migrated rows keep their recorded
// string — lib/authority.ts resolves both to one vocabulary.
export const AuthorityRecords: CollectionConfig = {
  slug: 'authority-records',
  access: {
    read: ({ req }) => {
      if (!req.user) return false
      if (req.user.collection === 'users') return true
      return { account: { equals: req.user.id } }
    },
    // Records are created through governed flows (selections, elections,
    // Council records, membership joins) — never written directly over the
    // generated API.
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
      // Canonical registry key for mandates and canonical participation
      // roles; migrated rows may carry a recorded legacy string that the
      // resolver maps (or reports as unmapped — never widened).
      name: 'role',
      type: 'text',
      required: true,
      index: true,
      validate: (value: unknown) => {
        const v = String(value ?? '')
        if (!v.trim()) return 'Required.'
        if (AUTHORITY_ROLE_KEYS.includes(v)) return true
        // Legacy recorded spellings are accepted so migrated rows round-trip
        // through Payload writes; they grant nothing unless the resolver maps
        // them.
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
      // Council seat this record occupies ('wg:finance', 'org:12',
      // 'focal_point'). For substitutes this is the seat they cover.
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
      // How the record was made — e.g. the adopted decision, completed
      // selection or election it records. For migrated rows it also carries
      // the immutable link to the source `assignments` row
      // (source: 'assignments_migration', assignmentId), which is why the
      // value is write-once: provenance must never be edited.
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
