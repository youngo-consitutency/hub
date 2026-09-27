import type { CollectionConfig, Where } from 'payload'
import { isStaff, staffWrites } from '../lib/collectionAccess'

export const NgoSeats: CollectionConfig = {
  slug: 'ngo-seats',
  admin: { group: 'Membership', defaultColumns: ['orgAccount', 'memberAccount', 'seatRole', 'status'] },
  access: {
    read: ({ req }) => {
      if (!req.user) return false
      if (req.user.collection === 'users') return true
      const where: Where = {
        or: [
          { memberAccount: { equals: req.user.id } },
          { orgAccount: { equals: req.user.id } },
        ],
      }
      return where
    },
    // Seat grants flow through the organisation endpoints.
    ...staffWrites,
  },
  fields: [
    { name: 'orgAccount', type: 'relationship', relationTo: 'accounts', required: true, index: true },
    { name: 'memberAccount', type: 'relationship', relationTo: 'accounts', index: true },
    { name: 'email', type: 'text', index: true }, // invite target before account exists
    { name: 'name', type: 'text' },
    { name: 'seatRole', type: 'select', required: true, options: ['owner', 'representative', 'viewer', 'affiliate'], defaultValue: 'representative' },
    { name: 'status', type: 'select', required: true, defaultValue: 'invited', options: ['invited', 'requested', 'active', 'revoked', 'declined'], index: true },
    { name: 'inviteTokenHash', type: 'text' },
    { name: 'inviteExpiresAt', type: 'date' },
    { name: 'invitedBy', type: 'relationship', relationTo: 'accounts' },
    { name: 'acceptedAt', type: 'date' },
  ],
}

export const NgoRequests: CollectionConfig = {
  slug: 'ngo-requests',
  admin: { group: 'Membership' },
  access: {
    read: ({ req }) => {
      if (!req.user) return false
      if (req.user.collection === 'users') return true
      return { orgAccount: { equals: req.user.id } }
    },
    // Requests are filed and reviewed through the organisation endpoints.
    ...staffWrites,
  },
  fields: [
    { name: 'orgAccount', type: 'relationship', relationTo: 'accounts', required: true, index: true },
    {
      name: 'kind',
      type: 'select',
      required: true,
      options: ['submit', 'endorse', 'represent', 'deadline', 'other', 'badge_support'],
    },
    { name: 'title', type: 'text', required: true },
    { name: 'body', type: 'textarea' },
    { name: 'deadlineAt', type: 'date' },
    {
      name: 'status',
      type: 'select',
      defaultValue: 'open',
      options: ['open', 'in_progress', 'done', 'declined'],
      index: true,
    },
    { name: 'createdBy', type: 'relationship', relationTo: 'accounts' },
  ],
}

export const MembershipAppeals: CollectionConfig = {
  slug: 'membership-appeals',
  admin: { group: 'Membership' },
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
    update: ({ req }) => req.user?.collection === 'users',
    delete: ({ req }) => req.user?.collection === 'users',
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

export const NotificationPrefs: CollectionConfig = {
  slug: 'notification-prefs',
  admin: { hidden: true },
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
    { name: 'account', type: 'relationship', relationTo: 'accounts', required: true, unique: true, index: true },
    { name: 'timezone', type: 'text', defaultValue: 'UTC' },
    { name: 'digestDay', type: 'number', defaultValue: 1 },
    { name: 'digestHourUtc', type: 'number', defaultValue: 6 },
    { name: 'email', type: 'json' }, // { digest, deadline, announcement }
    { name: 'pushEnabled', type: 'checkbox', defaultValue: false },
  ],
}

export const AuditLog: CollectionConfig = {
  slug: 'audit-log',
  admin: {
    group: 'Admin',
    defaultColumns: ['action', 'actor', 'targetType', 'targetId', 'createdAt'],
  },
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

export const ResourceIssues: CollectionConfig = {
  slug: 'resource-issues',
  admin: { group: 'Content', defaultColumns: ['resourceSlug', 'kind', 'createdAt'] },
  access: {
    read: ({ req }) => Boolean(req.user),
    create: ({ req, data }) => {
      if (req.user?.collection === 'users') return true
      return req.user?.collection === 'accounts' && data?.reportedBy === req.user.id
    },
    update: isStaff,
    delete: isStaff,
  },
  fields: [
    { name: 'resourceSlug', type: 'text', required: true, index: true },
    { name: 'kind', type: 'select', required: true, options: ['broken', 'outdated', 'tags', 'duplicate', 'other'] },
    { name: 'detail', type: 'textarea', required: true },
    { name: 'reportedBy', type: 'relationship', relationTo: 'accounts' },
    { name: 'resolvedAt', type: 'date' },
    { name: 'resolvedBy', type: 'relationship', relationTo: 'accounts' },
    { name: 'reviewId', type: 'text' },
  ],
}

export const ResourceReviews: CollectionConfig = {
  slug: 'resource-reviews',
  admin: { group: 'Content' },
  access: {
    read: ({ req }) => Boolean(req.user),
    create: ({ req, data }) => {
      if (req.user?.collection === 'users') return true
      return req.user?.collection === 'accounts' && data?.reviewedBy === req.user.id
    },
    update: isStaff,
    delete: isStaff,
  },
  fields: [
    { name: 'resourceSlug', type: 'text', required: true, index: true },
    { name: 'fingerprint', type: 'text' },
    { name: 'status', type: 'select', required: true, options: ['verified', 'needs_changes', 'retired'] },
    { name: 'note', type: 'textarea' },
    { name: 'checks', type: 'json' },
    { name: 'reviewedBy', type: 'relationship', relationTo: 'accounts' },
  ],
}

export const ResearchNotes: CollectionConfig = {
  slug: 'research-notes',
  admin: { group: 'Intelligence' },
  access: {
    read: ({ req }) => Boolean(req.user),
    ...staffWrites,
  },
  fields: [
    { name: 'account', type: 'relationship', relationTo: 'accounts', required: true, index: true },
    { name: 'kind', type: 'select', defaultValue: 'research_note', options: ['research_note'], index: true },
    { name: 'title', type: 'text', required: true },
    { name: 'note', type: 'textarea', required: true },
    { name: 'citations', type: 'json', required: true },
    { name: 'status', type: 'select', defaultValue: 'draft', options: ['draft', 'pending_review', 'approved', 'applied', 'rejected'], index: true },
    { name: 'idempotencyKey', type: 'text', index: true },
    { name: 'approvedBy', type: 'relationship', relationTo: 'accounts' },
    { name: 'appliedBy', type: 'relationship', relationTo: 'accounts' },
    { name: 'appliedAt', type: 'date' },
    { name: 'reviewedAt', type: 'date' },
  ],
}

export const EmailVerificationTokens: CollectionConfig = {
  slug: 'email-verification-tokens',
  admin: { hidden: true },
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
  admin: { hidden: true },
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
  admin: { hidden: true },
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
    { name: 'category', type: 'select', required: true, options: ['digest', 'deadline', 'announcement'] },
    { name: 'templateKey', type: 'text', required: true },
    { name: 'sourceType', type: 'text' },
    { name: 'sourceId', type: 'text' },
    { name: 'deduplicationKey', type: 'text', required: true, unique: true, index: true },
    { name: 'payload', type: 'json' },
    { name: 'availableAt', type: 'date', required: true, index: true },
    { name: 'status', type: 'select', required: true, defaultValue: 'queued', index: true, options: ['queued', 'sent', 'failed', 'suppressed'] },
    { name: 'attempts', type: 'number', defaultValue: 0 },
    { name: 'leaseUntil', type: 'date' },
    { name: 'providerMessageId', type: 'text' },
    { name: 'lastErrorCode', type: 'text' },
    { name: 'sentAt', type: 'date' },
  ],
}
