import type { CollectionConfig } from 'payload'
import { isStaffOrMemberField, staffWrites } from '../lib/collectionAccess'

// Shared opportunity board + NGO-posted opportunities.
export const Opportunities: CollectionConfig = {
  slug: 'opportunities',
  admin: {
    useAsTitle: 'title',
    group: 'Content',
    defaultColumns: ['title', 'kind', 'status', 'deadlineAt'],
  },
  access: {
    read: ({ req }) => Boolean(req.user) || { status: { equals: 'published' } },
    ...staffWrites,
  },
  fields: [
    { name: 'slug', type: 'text', unique: true, index: true },
    {
      name: 'kind',
      type: 'select',
      required: true,
      defaultValue: 'call',
      options: ['event', 'workshop', 'hackathon', 'opportunity', 'call', 'training'],
      index: true,
    },
    { name: 'title', type: 'text', required: true },
    { name: 'summary', type: 'textarea' },
    { name: 'body', type: 'textarea' },
    {
      name: 'format',
      type: 'select',
      defaultValue: 'online',
      options: ['online', 'in_person', 'hybrid'],
      index: true,
    },
    { name: 'location', type: 'text' },
    { name: 'region', type: 'text' },
    { name: 'startsAt', type: 'date' },
    { name: 'endsAt', type: 'date' },
    { name: 'deadlineAt', type: 'date', index: true },
    { name: 'linkUrl', type: 'text' },
    { name: 'organizationName', type: 'text' },
    {
      name: 'orgAccount',
      type: 'relationship',
      relationTo: 'accounts',
    },
    {
      name: 'status',
      type: 'select',
      required: true,
      defaultValue: 'published',
      options: ['draft', 'pending_review', 'published', 'withdrawn', 'rejected'],
      index: true,
    },
    { name: 'reviewNote', type: 'textarea', access: { read: isStaffOrMemberField } },
    { name: 'reviewedAt', type: 'date' },
    { name: 'source', type: 'text', admin: { readOnly: true } },
  ],
}
