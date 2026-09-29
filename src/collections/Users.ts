import type { CollectionConfig } from 'payload'
import { isStaff } from '../lib/collectionAccess'

export const Users: CollectionConfig = {
  slug: 'users',
  auth: true,
  access: {
    read: isStaff,
    create: isStaff,
    update: isStaff,
    delete: isStaff,
  },
  fields: [
    // Email added by default
    // Add more fields as needed
  ],
}
