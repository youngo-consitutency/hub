import type { CollectionConfig } from 'payload'
import { isStaff, isStaffField, isStaffOrMember, staffWrites } from '../lib/collectionAccess'

export const WorkingGroups: CollectionConfig = {
  slug: 'working-groups',
  access: {
    read: isStaffOrMember,
    ...staffWrites,
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
      // Gated per-member by workspace progress in the group endpoints — the
      // generated API must not bypass that gate, so REST reads are staff-only.
      name: 'resources',
      type: 'array',
      access: { read: isStaffField },
      fields: [
        { name: 'label', type: 'text', required: true },
        { name: 'description', type: 'textarea' },
        { name: 'url', type: 'text', required: true },
        { name: 'visibility', type: 'text' },
      ],
    },
    { name: 'taskForces', type: 'json', access: { read: isStaffField } },
    { name: 'whatsappUrl', type: 'text', access: { read: isStaffField } },
    { name: 'groupUrl', type: 'text', access: { read: isStaffField } },
    { name: 'driveUrl', type: 'text', access: { read: isStaffField } },
    {
      name: 'publicSpace',
      type: 'checkbox',
      defaultValue: false,
    },
    {
      name: 'isActive',
      type: 'checkbox',
      defaultValue: true,
    },
    { name: 'sortOrder', type: 'number' },
  ],
}
