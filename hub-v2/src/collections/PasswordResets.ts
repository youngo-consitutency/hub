import type { CollectionConfig } from 'payload'

// One-time password reset tokens (replaces password_reset_tokens table).
// tokenHash stores sha256(token) so the raw token only ever appears in email.
export const PasswordResets: CollectionConfig = {
  slug: 'password-resets',
  admin: { hidden: true },
  access: {
    read: () => false,
    create: () => false,
    update: () => false,
    delete: () => false,
  },
  fields: [
    {
      name: 'account',
      type: 'relationship',
      relationTo: 'accounts',
      required: true,
      index: true,
    },
    { name: 'email', type: 'text', required: true },
    { name: 'tokenHash', type: 'text', required: true, index: true },
    { name: 'expiresAt', type: 'date', required: true },
    { name: 'usedAt', type: 'date' },
  ],
}
