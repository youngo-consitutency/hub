import type { CollectionConfig } from 'payload'

export const Announcements: CollectionConfig = {
  slug: 'content-announcements',
  admin: {
    useAsTitle: 'title',
    group: 'Content',
    defaultColumns: ['title', 'pinned', 'publishedAt'],
  },
  access: {
    read: () => true,
  },
  fields: [
    { name: 'slug', type: 'text', required: true, unique: true, index: true },
    { name: 'title', type: 'text', required: true },
    { name: 'body', type: 'textarea', required: true },
    { name: 'pinned', type: 'checkbox', defaultValue: false },
    { name: 'ctaUrl', type: 'text' },
    { name: 'ctaLabel', type: 'text' },
    { name: 'ctaDeadlineAt', type: 'date' },
    { name: 'publishedAt', type: 'date', admin: { position: 'sidebar' } },
    { name: 'state', type: 'select', required: true, defaultValue: 'published', index: true, options: ['published', 'unpublished'] },
  ],
}
