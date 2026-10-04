import type { CollectionConfig } from 'payload'
import { staffWrites } from '../lib/collectionAccess'

// Structured content documents — onboarding courses, policy catalogues,
// contact lists — edited in the console and served read-only to the member UI.
// `body` is JSON so documents keep the shape their consumers expect.
export const ContentDocuments: CollectionConfig = {
  slug: 'content-documents',
  access: {
    read: () => true,
    ...staffWrites,
  },
  fields: [
    { name: 'slug', type: 'text', required: true, unique: true, index: true },
    { name: 'title', type: 'text', required: true },
    { name: 'body', type: 'json', required: true },
  ],
}
