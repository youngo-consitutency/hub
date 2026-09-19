import type { CollectionConfig } from 'payload'

export const Coys: CollectionConfig = {
  slug: 'content-coys',
  admin: {
    useAsTitle: 'title',
    group: 'Content',
    defaultColumns: ['title', 'type', 'status', 'startsOn'],
  },
  access: {
    read: () => true,
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
      admin: { position: 'sidebar' },
    },
    { name: 'organizerName', type: 'text' },
    { name: 'organizerOrg', type: 'text' },
    { name: 'registerUrl', type: 'text' },
    { name: 'websiteUrl', type: 'text' },
  ],
}
