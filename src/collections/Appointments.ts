import type { CollectionConfig } from 'payload'
import { APPOINTMENT_ROLE_KEYS } from '../lib/appointments'
import { staffWrites } from '../lib/collectionAccess'

// Mandated responsibilities (S13/S14/S25/S15): distinct from `assignments`,
// which remains the participation ledger (WG/body membership, negotiation
// scopes). An appointment row is the only source of constituency authority —
// it carries the appointing evidence, term window, Council seat and, for
// substitutes, the seat they cover.
export const Appointments: CollectionConfig = {
  slug: 'appointments',
  access: {
    read: ({ req }) => {
      if (!req.user) return false
      if (req.user.collection === 'users') return true
      return { account: { equals: req.user.id } }
    },
    // Appointments are created through governed flows (selections, elections,
    // Council records) — never written directly over the generated API.
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
      name: 'appointmentRole',
      type: 'select',
      required: true,
      options: APPOINTMENT_ROLE_KEYS,
      index: true,
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
      // Council seat this appointment occupies ('wg:finance', 'org:12',
      // 'focal_point'). For substitutes this is the seat they cover.
      name: 'councilSeat',
      type: 'text',
    },
    {
      // For council.substitute rows: the principal appointment they cover.
      name: 'substituteFor',
      type: 'relationship',
      relationTo: 'appointments',
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
      // How the appointment was made — e.g. the adopted decision, completed
      // selection or election it records. For migrated rows it also carries
      // the immutable supersession link to the source `assignments` row
      // (source: 'assignments_migration', assignmentId), which is why the
      // value is write-once: provenance must never be edited.
      name: 'appointedVia',
      type: 'json',
      hooks: {
        beforeChange: [
          ({ originalDoc, value }) =>
            originalDoc ? ((originalDoc as any).appointedVia ?? value) : value,
        ],
      },
    },
    {
      name: 'appointedBy',
      type: 'relationship',
      relationTo: 'accounts',
    },
    { name: 'evidence', type: 'text' },
  ],
}
