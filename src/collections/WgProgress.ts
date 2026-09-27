import type { CollectionConfig } from 'payload'
import { staffWrites } from '../lib/collectionAccess'

// Per-account working-group membership progress — replaces
// wg_workspace_progress. The presentation/rules gates decide when a member
// sees a WG's workspace material (join links, drive, internal resources).
export const WgProgress: CollectionConfig = {
  slug: 'wg-progress',
  admin: {
    useAsTitle: 'id',
    group: 'Membership',
    defaultColumns: ['account', 'wgSlug', 'status', 'roleInWg'],
  },
  access: {
    read: ({ req }) => {
      if (!req.user) return false
      if (req.user.collection === 'users') return true
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
    { name: 'wgSlug', type: 'text', required: true, index: true },
    { name: 'presentationOk', type: 'checkbox', defaultValue: false },
    { name: 'rulesOk', type: 'checkbox', defaultValue: false },
    { name: 'unlockedAt', type: 'date' },
    { name: 'joinedAt', type: 'date' },
    {
      name: 'status',
      type: 'select',
      defaultValue: 'interested',
      options: ['interested', 'pending_approval', 'active', 'inactive', 'rejected'],
      index: true,
    },
    {
      name: 'roleInWg',
      type: 'select',
      defaultValue: 'member',
      options: ['member', 'contact', 'lead'],
    },
    { name: 'onboardedBy', type: 'text' },
  ],
}
