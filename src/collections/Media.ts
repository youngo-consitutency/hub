import type { CollectionConfig } from 'payload'
import { serverWrites } from '../lib/collectionAccess'

export const Media: CollectionConfig = {
  slug: 'media',
  access: {
    read: () => true,
    ...serverWrites,
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
