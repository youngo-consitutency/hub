import type { CollectionConfig } from 'payload'

export const WorkingGroups: CollectionConfig = {
  slug: 'working-groups',
  admin: {
    useAsTitle: 'name',
    group: 'Content',
    defaultColumns: ['name', 'slug', 'publicSpace', 'isActive'],
  },
  access: {
    read: () => true,
  },
  fields: [
    { name: 'slug', type: 'text', required: true, unique: true, index: true },
    { name: 'name', type: 'text', required: true },
    { name: 'monogram', type: 'text' },
    { name: 'focusLine', type: 'text' },
    { name: 'description', type: 'textarea' },
    { name: 'cadenceNote', type: 'text' },
    { name: 'topic', type: 'text' },
    {
      name: 'tags',
      type: 'array',
      fields: [{ name: 'tag', type: 'text' }],
    },
    {
      name: 'resources',
      type: 'array',
      fields: [
        { name: 'label', type: 'text', required: true },
        { name: 'description', type: 'textarea' },
        { name: 'url', type: 'text', required: true },
        { name: 'visibility', type: 'text' },
      ],
    },
    { name: 'taskForces', type: 'json' },
    { name: 'whatsappUrl', type: 'text' },
    { name: 'groupUrl', type: 'text' },
    { name: 'driveUrl', type: 'text' },
    {
      name: 'publicSpace',
      type: 'checkbox',
      defaultValue: false,
      admin: { position: 'sidebar' },
    },
    {
      name: 'isActive',
      type: 'checkbox',
      defaultValue: true,
      admin: { position: 'sidebar' },
    },
    { name: 'sortOrder', type: 'number' },
  ],
}
