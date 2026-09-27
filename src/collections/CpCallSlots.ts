import type { CollectionConfig } from 'payload'
import { staffWrites } from '../lib/collectionAccess'

// CP office-hours slots members book (replaces cp_call_slots + bookings).
export const CpCallSlots: CollectionConfig = {
  slug: 'cp-call-slots',
  admin: {
    useAsTitle: 'id',
    group: 'Membership',
    defaultColumns: ['startsAt', 'hostAccount', 'bookedByAccount', 'status'],
  },
  access: {
    read: ({ req }) => Boolean(req.user),
    ...staffWrites,
  },
  fields: [
    {
      name: 'hostAccount',
      type: 'relationship',
      relationTo: 'accounts',
      required: true,
      index: true,
    },
    { name: 'startsAt', type: 'date', required: true, index: true },
    { name: 'durationMin', type: 'number', defaultValue: 20 },
    { name: 'meetingUrl', type: 'text' },
    {
      name: 'status',
      type: 'select',
      required: true,
      defaultValue: 'open',
      options: ['open', 'booked', 'cancelled'],
      index: true,
    },
    {
      name: 'bookedByAccount',
      type: 'relationship',
      relationTo: 'accounts',
      index: true,
    },
    { name: 'bookedAt', type: 'date' },
    { name: 'note', type: 'textarea' },
  ],
}
