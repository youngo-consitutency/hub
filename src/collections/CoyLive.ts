import type { CollectionConfig } from 'payload'
import { staffWrites, isStaff } from '../lib/collectionAccess'

// Live operations for a COY with `liveOps` on: an allowlist of participants
// and the notices organisers send them. Members read and write only through
// src/endpoints/coy.ts, which checks organiser rights and the allowlist.
export const CoyParticipants: CollectionConfig = {
  slug: 'coy-participants',
  access: { read: isStaff, ...staffWrites },
  fields: [
    { name: 'coy', type: 'relationship', relationTo: 'content-coys', required: true, index: true },
    { name: 'account', type: 'relationship', relationTo: 'accounts', required: true, index: true },
    // the address the organiser typed, kept for the allowlist view
    { name: 'email', type: 'text', required: true },
    { name: 'note', type: 'text' },
    { name: 'addedBy', type: 'relationship', relationTo: 'accounts' },
  ],
}

export const CoyNotices: CollectionConfig = {
  slug: 'coy-notices',
  access: { read: isStaff, ...staffWrites },
  fields: [
    { name: 'coy', type: 'relationship', relationTo: 'content-coys', required: true, index: true },
    { name: 'title', type: 'text', required: true },
    { name: 'body', type: 'textarea', required: true },
    { name: 'channels', type: 'json' },
    { name: 'campaignId', type: 'text', unique: true, index: true },
    { name: 'author', type: 'relationship', relationTo: 'accounts', required: true },
  ],
}
