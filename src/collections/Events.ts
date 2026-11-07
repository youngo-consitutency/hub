import type { CollectionConfig } from 'payload'
import { noFieldAccess, serverWrites } from '../lib/collectionAccess'

export const Events: CollectionConfig = {
  slug: 'content-events',
  access: {
    read: () => true,
    ...serverWrites,
  },
  fields: [
    { name: 'slug', type: 'text', required: true, unique: true, index: true },
    { name: 'title', type: 'text', required: true },
    { name: 'type', type: 'text', required: true, defaultValue: 'wg_call', index: true },
    { name: 'startsAt', type: 'date', required: true, index: true },
    { name: 'endsAt', type: 'date' },
    { name: 'description', type: 'textarea' },
    {
      name: 'wg',
      type: 'relationship',
      relationTo: 'working-groups',
      index: true,
    },
    {
      name: 'meetingUrl',
      type: 'text',
      access: { read: noFieldAccess },
    },
    { name: 'recordingUrl', type: 'text' },
    {
      name: 'state',
      type: 'select',
      required: true,
      defaultValue: 'published',
      index: true,
      options: ['published', 'unpublished'],
    },
    { name: 'legacySource', type: 'text' },
  ],
}
