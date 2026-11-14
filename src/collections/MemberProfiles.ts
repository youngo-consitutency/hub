import type { CollectionConfig } from 'payload'
import { noAccess, serverWrites } from '../lib/collectionAccess'

export const MemberProfiles: CollectionConfig = {
  slug: 'member-profiles',
  access: {
    read: noAccess,
    ...serverWrites,
  },
  fields: [
    {
      name: 'account',
      type: 'relationship',
      relationTo: 'accounts',
      required: true,
      unique: true,
      index: true,
    },
    { name: 'displayName', type: 'text', required: true },
    { name: 'headline', type: 'text' },
    { name: 'bio', type: 'textarea' },
    { name: 'pronouns', type: 'text' },
    { name: 'expertiseTags', type: 'json' },
    {
      name: 'directoryVisibility',
      type: 'select',
      defaultValue: 'private',
      options: ['private', 'members', 'public'],
    },
    { name: 'showCountry', type: 'checkbox', defaultValue: false },
    { name: 'showOrganization', type: 'checkbox', label: 'Show organisation', defaultValue: false },
    { name: 'showWorkingGroups', type: 'checkbox', defaultValue: true },
    { name: 'showRoles', type: 'checkbox', defaultValue: true },
    { name: 'roleTitle', type: 'text' },
    { name: 'revision', type: 'number', defaultValue: 1 },
    // Avatar builder picks, allowlisted in src/shared/avatar.ts. Members never
    // upload images; null draws the default seeded by the account id.
    { name: 'avatar', type: 'json' },
  ],
}
