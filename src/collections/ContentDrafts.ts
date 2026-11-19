import type { CollectionConfig } from 'payload'
import { noAccess, serverWrites } from '../lib/collectionAccess'

// Content workflow: draft → in_review → approved → published; authors cannot review their own draft.
export const ContentDrafts: CollectionConfig = {
  slug: 'content-drafts',
  access: {
    read: noAccess,
    ...serverWrites,
  },
  fields: [
    {
      name: 'contentType',
      type: 'select',
      required: true,
      options: ['event', 'announcement', 'resource', 'coy', 'opportunity', 'page'],
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
