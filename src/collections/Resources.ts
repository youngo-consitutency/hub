import type { CollectionConfig } from 'payload'
import { isStaff, staffWrites } from '../lib/collectionAccess'

export const Resources: CollectionConfig = {
  slug: 'catalogue-resources',
  access: {
    read: () => true,
    ...staffWrites,
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
    read: ({ req }) => Boolean(req.user),
    create: ({ req, data }) => {
      if (req.user?.collection === 'users') return true
      return req.user?.collection === 'accounts' && data?.reportedBy === req.user.id
    },
    update: isStaff,
    delete: isStaff,
  },
  fields: [
    { name: 'resourceSlug', type: 'text', required: true, index: true },
    { name: 'kind', type: 'select', required: true, options: ['broken', 'outdated', 'tags', 'duplicate', 'other'] },
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
    read: ({ req }) => Boolean(req.user),
    create: ({ req, data }) => {
      if (req.user?.collection === 'users') return true
      return req.user?.collection === 'accounts' && data?.reviewedBy === req.user.id
    },
    update: isStaff,
    delete: isStaff,
  },
  fields: [
    { name: 'resourceSlug', type: 'text', required: true, index: true },
    { name: 'fingerprint', type: 'text' },
    { name: 'status', type: 'select', required: true, options: ['verified', 'needs_changes', 'retired'] },
    { name: 'note', type: 'textarea' },
    { name: 'checks', type: 'json' },
    { name: 'reviewedBy', type: 'relationship', relationTo: 'accounts' },
  ],
}
