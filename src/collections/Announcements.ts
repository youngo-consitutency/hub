import type { CollectionConfig } from 'payload'
import { staffWrites } from '../lib/collectionAccess'

export const Announcements: CollectionConfig = {
  slug: 'content-announcements',
  access: {
    read: () => true,
    ...staffWrites,
  },
  fields: [
    { name: 'slug', type: 'text', required: true, unique: true, index: true },
    { name: 'title', type: 'text', required: true },
    { name: 'body', type: 'textarea', required: true },
    { name: 'pinned', type: 'checkbox', defaultValue: false },
    { name: 'ctaUrl', type: 'text' },
    { name: 'ctaLabel', type: 'text' },
    { name: 'ctaDeadlineAt', type: 'date' },
    { name: 'publishedAt', type: 'date' },
    {
      name: 'state',
      type: 'select',
      required: true,
      defaultValue: 'published',
      index: true,
      options: ['published', 'unpublished'],
    },
  ],
}
