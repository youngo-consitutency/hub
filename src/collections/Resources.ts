import type { CollectionConfig } from 'payload'
import { staffWrites } from '../lib/collectionAccess'

export const Resources: CollectionConfig = {
  slug: 'catalogue-resources',
  admin: {
    useAsTitle: 'title',
    group: 'Content',
    defaultColumns: ['title', 'pathway', 'type', 'verificationStatus'],
  },
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
