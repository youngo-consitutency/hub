import type { CollectionConfig } from 'payload'
import { staffWrites } from '../lib/collectionAccess'

export const MemberProfiles: CollectionConfig = {
  slug: 'member-profiles',
  admin: {
    useAsTitle: 'displayName',
    group: 'Membership',
  },
  access: {
    read: ({ req }) => Boolean(req.user),
    ...staffWrites,
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
    // Photo bytes live in member_profile_photos (bytea, migration-managed):
    // member photos must never pass through the public media store.
    { name: 'hasPhoto', type: 'checkbox', defaultValue: false },
    { name: 'photoUpdatedAt', type: 'date' },
  ],
}
