import type { CollectionConfig } from 'payload'
import { staffWrites } from '../lib/collectionAccess'

export const Coys: CollectionConfig = {
  slug: 'content-coys',
  access: {
    read: () => true,
    ...staffWrites,
  },
  fields: [
    { name: 'slug', type: 'text', required: true, unique: true, index: true },
    {
      name: 'type',
      type: 'select',
      required: true,
      options: ['coy', 'lcoy', 'rcoy', 'other'],
      defaultValue: 'coy',
      index: true,
    },
    { name: 'title', type: 'text', required: true },
    { name: 'country', type: 'text' },
    { name: 'city', type: 'text' },
    { name: 'region', type: 'text', index: true },
    { name: 'startsOn', type: 'text' },
    { name: 'endsOn', type: 'text' },
    { name: 'datesTbc', type: 'checkbox', defaultValue: false },
    { name: 'status', type: 'text', index: true },
    { name: 'applicationsCloseAt', type: 'date' },
    {
      name: 'reviewStatus',
      type: 'select',
      defaultValue: 'pending',
      options: ['pending', 'approved', 'rejected'],
      index: true,
    },
    { name: 'organizerName', type: 'text', label: 'Organiser name' },
    { name: 'organizerOrg', type: 'text', label: 'Organiser organisation' },
    { name: 'registerUrl', type: 'text' },
    { name: 'websiteUrl', type: 'text' },
  ],
}
