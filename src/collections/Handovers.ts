import type { CollectionConfig } from 'payload'
import { staffWrites } from '../lib/collectionAccess'

// S17 handover duty: when membership ends — or a mandate is revoked — the
// member has two weeks to return YOUNGO data and complete handover tasks.
// One record per trigger, with a checklist the member works through and the
// membership team confirms.
export const Handovers: CollectionConfig = {
  slug: 'handovers',
  access: {
    read: ({ req }) => {
      if (!req.user) return false
      if (req.user.collection === 'users') return true
      if ((req.user as any).role === 'admin') return true
      return { account: { equals: req.user.id } }
    },
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
      name: 'reason',
      type: 'select',
      required: true,
      options: ['resignation', 'termination', 'cw_expiry', 'mandate_end', 'other'],
      index: true,
    },
    // What is being handed over, e.g. "Constituency Work roles" or
    // "finance WG contact point".
    { name: 'scopeLabel', type: 'text', required: true },
    {
      name: 'items',
      type: 'array',
      fields: [
        { name: 'label', type: 'text', required: true },
        { name: 'done', type: 'checkbox', defaultValue: false },
        { name: 'doneAt', type: 'date' },
      ],
    },
    // Membership/mandate end + 14 days (S17 data-return deadline).
    { name: 'dueAt', type: 'date', required: true },
    {
      name: 'status',
      type: 'select',
      required: true,
      defaultValue: 'open',
      options: ['open', 'completed', 'overdue', 'waived'],
      index: true,
    },
    { name: 'notes', type: 'textarea' },
    {
      name: 'openedBy',
      type: 'relationship',
      relationTo: 'accounts',
      required: true,
    },
    { name: 'openedAt', type: 'date', required: true },
    { name: 'closedAt', type: 'date' },
    {
      name: 'closedBy',
      type: 'relationship',
      relationTo: 'accounts',
    },
  ],
}
