import type { CollectionConfig } from 'payload'

export const NotificationPrefs: CollectionConfig = {
  slug: 'notification-prefs',
  access: {
    read: ({ req }) => {
      if (!req.user) return false
      if (req.user.collection === 'users') return true
      return { account: { equals: req.user.id } }
    },
    create: ({ req, data }) => {
      if (req.user?.collection === 'users') return true
      return req.user?.collection === 'accounts' && data?.account === req.user.id
    },
    update: ({ req }) => {
      if (!req.user) return false
      if (req.user.collection === 'users') return true
      return { account: { equals: req.user.id } }
    },
    delete: ({ req }) => req.user?.collection === 'users',
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
    { name: 'timezone', type: 'text', defaultValue: 'UTC' },
    { name: 'digestDay', type: 'number', defaultValue: 1 },
    { name: 'digestHourUtc', type: 'number', defaultValue: 6 },
    { name: 'email', type: 'json' }, // { digest, deadline, announcement }
    { name: 'pushEnabled', type: 'checkbox', defaultValue: false },
  ],
}

export const EmailVerificationTokens: CollectionConfig = {
  slug: 'email-verification-tokens',
  access: {
    read: () => false,
    create: () => false,
    update: () => false,
    delete: () => false,
  },
  fields: [
    { name: 'account', type: 'relationship', relationTo: 'accounts', required: true, index: true },
    { name: 'tokenHash', type: 'text', required: true, index: true },
    { name: 'expiresAt', type: 'date', required: true },
    { name: 'usedAt', type: 'date' },
  ],
}

export const PushSubscriptions: CollectionConfig = {
  slug: 'push-subscriptions',
  access: {
    read: ({ req }) => {
      if (!req.user) return false
      if (req.user.collection === 'users') return true
      return { account: { equals: req.user.id } }
    },
    create: ({ req, data }) => {
      if (req.user?.collection === 'users') return true
      return req.user?.collection === 'accounts' && data?.account === req.user.id
    },
    update: ({ req }) => {
      if (!req.user) return false
      if (req.user.collection === 'users') return true
      return { account: { equals: req.user.id } }
    },
    delete: ({ req }) => {
      if (!req.user) return false
      if (req.user.collection === 'users') return true
      return { account: { equals: req.user.id } }
    },
  },
  fields: [
    { name: 'account', type: 'relationship', relationTo: 'accounts', required: true, index: true },
    { name: 'endpoint', type: 'text', required: true, unique: true, index: true },
    { name: 'keys', type: 'json', required: true },
    { name: 'userAgent', type: 'text' },
    { name: 'disabledAt', type: 'date' },
  ],
}

export const NotificationOutbox: CollectionConfig = {
  slug: 'notification-outbox',
  access: {
    read: ({ req }) => {
      if (!req.user) return false
      if (req.user.collection === 'users') return true
      return { account: { equals: req.user.id } }
    },
    create: () => false,
    update: () => false,
    delete: () => false,
  },
  fields: [
    { name: 'account', type: 'relationship', relationTo: 'accounts', required: true, index: true },
    {
      name: 'category',
      type: 'select',
      required: true,
      options: ['digest', 'deadline', 'announcement'],
    },
    { name: 'templateKey', type: 'text', required: true },
    { name: 'sourceType', type: 'text' },
    { name: 'sourceId', type: 'text' },
    { name: 'deduplicationKey', type: 'text', required: true, unique: true, index: true },
    { name: 'payload', type: 'json' },
    { name: 'availableAt', type: 'date', required: true, index: true },
    {
      name: 'status',
      type: 'select',
      required: true,
      defaultValue: 'queued',
      index: true,
      options: ['queued', 'sent', 'failed', 'suppressed'],
    },
    { name: 'attempts', type: 'number', defaultValue: 0 },
    { name: 'leaseUntil', type: 'date' },
    { name: 'providerMessageId', type: 'text' },
    { name: 'lastErrorCode', type: 'text' },
    { name: 'sentAt', type: 'date' },
  ],
}
