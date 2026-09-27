import type { CollectionConfig } from 'payload'
import { staffWrites } from '../lib/collectionAccess'

export const Media: CollectionConfig = {
  slug: 'media',
  access: {
    read: () => true,
    ...staffWrites,
  },
  fields: [
    {
      name: 'alt',
      type: 'text',
      required: true,
    },
  ],
  upload: true,
}
