import type { CollectionConfig } from 'payload'

export const AuditLog: CollectionConfig = {
  slug: 'audit-log',
  access: {
    read: ({ req }) => {
      if (!req.user) return false
      if (req.user.collection === 'users') return true
      return (req.user as any).role === 'admin'
    },
    create: () => false,
    update: () => false,
    delete: () => false,
  },
  fields: [
    { name: 'actor', type: 'relationship', relationTo: 'accounts', index: true },
    { name: 'actorEmail', type: 'text' },
    { name: 'action', type: 'text', required: true, index: true },
    { name: 'targetType', type: 'text' },
    { name: 'targetId', type: 'text' },
    { name: 'reason', type: 'text' },
    { name: 'before', type: 'json' },
    { name: 'after', type: 'json' },
    { name: 'requestId', type: 'text' },
  ],
}
