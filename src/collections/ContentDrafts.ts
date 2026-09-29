import type { CollectionConfig } from 'payload'
import { staffWrites } from '../lib/collectionAccess'

// Governed content workflow: draft → in_review → approved → published.
// The author cannot review their own draft; publishing overlays the live
// record in the matching collection keyed by contentKey (slug).
export const ContentDrafts: CollectionConfig = {
  slug: 'content-drafts',
  access: {
    read: ({ req }) => Boolean(req.user),
    ...staffWrites,
  },
  fields: [
    {
      name: 'contentType',
      type: 'select',
      required: true,
      options: ['event', 'announcement', 'resource', 'coy', 'opportunity'],
      index: true,
    },
    { name: 'contentKey', type: 'text', required: true, index: true },
    {
      name: 'status',
      type: 'select',
      required: true,
      defaultValue: 'draft',
      options: ['draft', 'in_review', 'changes_requested', 'approved', 'published', 'rejected'],
      index: true,
    },
    { name: 'payload', type: 'json', required: true },
    {
      name: 'author',
      type: 'relationship',
      relationTo: 'accounts',
      index: true,
    },
    {
      name: 'reviewer',
      type: 'relationship',
      relationTo: 'accounts',
    },
    { name: 'reviewNote', type: 'textarea' },
    { name: 'submittedAt', type: 'date' },
    { name: 'reviewedAt', type: 'date' },
    { name: 'publishedAt', type: 'date' },
    { name: 'revision', type: 'number', defaultValue: 1 },
  ],
}
