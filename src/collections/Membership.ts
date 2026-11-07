import { noAccess } from '../lib/collectionAccess'
import type { CollectionConfig } from 'payload'

export const MembershipAppeals: CollectionConfig = {
  slug: 'membership-appeals',
  access: {
    read: ({ req }) => {
      if (!req.user) return false
      return { account: { equals: req.user.id } }
    },
    create: ({ req, data }) => {
      return req.user?.collection === 'accounts' && data?.account === req.user.id
    },
    update: noAccess,
    delete: () => false,
  },
  fields: [
    { name: 'account', type: 'relationship', relationTo: 'accounts', required: true, index: true },
    { name: 'statement', type: 'textarea', required: true },
    // proof_bytes bytea is added by migration (not a Payload field): identity
    // documents never pass through the public media store.
    { name: 'identityKind', type: 'text' },
    { name: 'proofContentType', type: 'text' },
    { name: 'proofByteSize', type: 'number' },
    {
      name: 'status',
      type: 'select',
      defaultValue: 'submitted',
      options: ['submitted', 'granted', 'upheld'],
      index: true,
    },
    { name: 'reviewNote', type: 'textarea' },
    { name: 'reviewedBy', type: 'relationship', relationTo: 'accounts' },
    { name: 'reviewedAt', type: 'date' },
  ],
}
