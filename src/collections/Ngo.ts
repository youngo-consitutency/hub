import type { CollectionConfig, Where } from 'payload'
import { staffWrites } from '../lib/collectionAccess'

export const NgoSeats: CollectionConfig = {
  slug: 'ngo-seats',
  access: {
    read: ({ req }) => {
      if (!req.user) return false
      if (req.user.collection === 'users') return true
      const where: Where = {
        or: [{ memberAccount: { equals: req.user.id } }, { orgAccount: { equals: req.user.id } }],
      }
      return where
    },
    // Seat grants flow through the organisation endpoints.
    ...staffWrites,
  },
  fields: [
    {
      name: 'orgAccount',
      type: 'relationship',
      relationTo: 'accounts',
      required: true,
      index: true,
    },
    { name: 'memberAccount', type: 'relationship', relationTo: 'accounts', index: true },
    { name: 'email', type: 'text', index: true }, // invite target before account exists
    { name: 'name', type: 'text' },
    {
      name: 'seatRole',
      type: 'select',
      required: true,
      options: ['owner', 'representative', 'viewer', 'affiliate'],
      defaultValue: 'representative',
    },
    {
      name: 'status',
      type: 'select',
      required: true,
      defaultValue: 'invited',
      options: ['invited', 'requested', 'active', 'revoked', 'declined'],
      index: true,
    },
    { name: 'inviteTokenHash', type: 'text' },
    { name: 'inviteExpiresAt', type: 'date' },
    { name: 'invitedBy', type: 'relationship', relationTo: 'accounts' },
    { name: 'acceptedAt', type: 'date' },
  ],
}

export const NgoRequests: CollectionConfig = {
  slug: 'ngo-requests',
  access: {
    read: ({ req }) => {
      if (!req.user) return false
      if (req.user.collection === 'users') return true
      return { orgAccount: { equals: req.user.id } }
    },
    // Requests are filed and reviewed through the organisation endpoints.
    ...staffWrites,
  },
  fields: [
    {
      name: 'orgAccount',
      type: 'relationship',
      relationTo: 'accounts',
      required: true,
      index: true,
    },
    {
      name: 'kind',
      type: 'select',
      required: true,
      options: ['submit', 'endorse', 'represent', 'deadline', 'other', 'badge_support'],
    },
    { name: 'title', type: 'text', required: true },
    { name: 'body', type: 'textarea' },
    { name: 'deadlineAt', type: 'date' },
    {
      name: 'status',
      type: 'select',
      defaultValue: 'open',
      options: ['open', 'in_progress', 'done', 'declined'],
      index: true,
    },
    { name: 'createdBy', type: 'relationship', relationTo: 'accounts' },
  ],
}
