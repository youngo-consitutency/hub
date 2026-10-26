import type { CollectionConfig } from 'payload'
import { isStaff, staffWrites } from '../lib/collectionAccess'

// Mail Desk drafts. Authors write through src/endpoints/mail.ts, which
// checks reach from authority capabilities; nothing sends until queued.
export const MailDrafts: CollectionConfig = {
  slug: 'mail-drafts',
  access: { read: isStaff, ...staffWrites },
  fields: [
    { name: 'author', type: 'relationship', relationTo: 'accounts', required: true, index: true },
    { name: 'title', type: 'text', required: true },
    // sanitised by src/shared/emailHtml.js
    { name: 'message', type: 'textarea', required: true },
    { name: 'actionUrl', type: 'text' },
    {
      name: 'scopeType',
      type: 'select',
      required: true,
      options: ['working_group', 'constituency', 'individual'],
    },
    { name: 'wgSlug', type: 'text' },
    // [{ id, name }] for individual scope; addresses are resolved at queue time
    { name: 'recipients', type: 'json' },
    {
      name: 'status',
      type: 'select',
      required: true,
      defaultValue: 'draft',
      options: ['draft', 'queued', 'discarded'],
      index: true,
    },
    { name: 'campaignId', type: 'text' },
    { name: 'recipientCount', type: 'number' },
    { name: 'queuedAt', type: 'date' },
  ],
}
