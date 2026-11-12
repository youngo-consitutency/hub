import type { CollectionConfig } from 'payload'
import { noFieldAccess, serverWrites } from '../lib/collectionAccess'
import { OPPORTUNITY_FORMAT_VALUES, OPPORTUNITY_KIND_VALUES } from '../shared/opportunities'

// Shared opportunity board + NGO-posted opportunities.
export const Opportunities: CollectionConfig = {
  slug: 'opportunities',
  access: {
    // drafts and review queues are served by /api/member/opportunities/*
    read: () => ({ status: { equals: 'published' } }),
    ...serverWrites,
  },
  fields: [
    { name: 'slug', type: 'text', unique: true, index: true },
    {
      name: 'kind',
      type: 'select',
      required: true,
      defaultValue: 'call',
      options: OPPORTUNITY_KIND_VALUES,
      index: true,
    },
    { name: 'title', type: 'text', required: true },
    { name: 'summary', type: 'textarea' },
    { name: 'body', type: 'textarea' },
    {
      name: 'format',
      type: 'select',
      defaultValue: 'online',
      options: OPPORTUNITY_FORMAT_VALUES,
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
    { name: 'reviewNote', type: 'textarea', access: { read: noFieldAccess } },
    { name: 'reviewedAt', type: 'date' },
    { name: 'source', type: 'text' },
  ],
}
