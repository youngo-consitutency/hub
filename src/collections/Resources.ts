import type { CollectionConfig } from 'payload'
import { noAccess, serverWrites } from '../lib/collectionAccess'

export const Resources: CollectionConfig = {
  slug: 'catalogue-resources',
  access: {
    // same filter as the public /resources listing
    read: () => ({
      or: [
        { verificationStatus: { not_equals: 'retired' } },
        { verificationStatus: { exists: false } },
      ],
    }),
    ...serverWrites,
  },
  fields: [
    { name: 'slug', type: 'text', required: true, unique: true, index: true },
    { name: 'title', type: 'text', required: true },
    { name: 'url', type: 'text', required: true },
    { name: 'summary', type: 'textarea' },
    { name: 'publisher', type: 'text' },
    { name: 'pathway', type: 'text', index: true },
    { name: 'type', type: 'text', index: true },
    { name: 'topic', type: 'text' },
    { name: 'topics', type: 'json' },
    { name: 'region', type: 'text' },
    { name: 'language', type: 'text' },
    { name: 'source', type: 'text' },
    {
      name: 'verificationStatus',
      type: 'select',
      defaultValue: 'needs_verification',
      options: ['verified', 'needs_verification', 'flagged', 'retired'],
      index: true,
    },
    { name: 'checkedAt', type: 'date' },
    { name: 'retiredAt', type: 'date' },
  ],
}

export const ResourceIssues: CollectionConfig = {
  slug: 'resource-issues',
  access: {
    read: noAccess,
    // members file through /api/member/resources/*, never the generated api
    ...serverWrites,
  },
  fields: [
    { name: 'resourceSlug', type: 'text', required: true, index: true },
    {
      name: 'kind',
      type: 'select',
      required: true,
      options: ['broken', 'outdated', 'tags', 'duplicate', 'other'],
    },
    { name: 'detail', type: 'textarea', required: true },
    { name: 'reportedBy', type: 'relationship', relationTo: 'accounts' },
    { name: 'resolvedAt', type: 'date' },
    { name: 'resolvedBy', type: 'relationship', relationTo: 'accounts' },
    { name: 'reviewId', type: 'text' },
  ],
}

export const ResourceReviews: CollectionConfig = {
  slug: 'resource-reviews',
  access: {
    read: noAccess,
    ...serverWrites,
  },
  fields: [
    { name: 'resourceSlug', type: 'text', required: true, index: true },
    { name: 'fingerprint', type: 'text' },
    {
      name: 'status',
      type: 'select',
      required: true,
      options: ['verified', 'needs_changes', 'retired'],
    },
    { name: 'note', type: 'textarea' },
    { name: 'checks', type: 'json' },
    { name: 'reviewedBy', type: 'relationship', relationTo: 'accounts' },
  ],
}
