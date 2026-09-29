import type { CollectionConfig } from 'payload'
import { isStaff, isStaffField } from '../lib/collectionAccess'

export const FeedbackTickets: CollectionConfig = {
  slug: 'feedback-tickets',
  access: {
    read: ({ req }) => {
      if (!req.user) return false
      if (req.user.collection === 'users') return true
      return { account: { equals: req.user.id } }
    },
    create: ({ req, data }) => {
      if (req.user?.collection === 'users') return true
      // Members may only file tickets under their own account.
      return req.user?.collection === 'accounts' && (!data?.account || data?.account === req.user.id)
    },
    update: isStaff,
    delete: isStaff,
  },
  fields: [
    { name: 'title', type: 'text', required: true },
    {
      name: 'kind',
      type: 'select',
      required: true,
      options: ['bug', 'ui_ux', 'feature', 'blocker', 'content', 'other'],
    },
    {
      name: 'severity',
      type: 'select',
      required: true,
      defaultValue: 'normal',
      options: ['low', 'normal', 'high', 'critical'],
    },
    { name: 'body', type: 'textarea', required: true },
    { name: 'pageUrl', type: 'text' },
    { name: 'contextNote', type: 'text' },
    {
      name: 'account',
      type: 'relationship',
      relationTo: 'accounts',
      index: true,
    },
    { name: 'contactEmail', type: 'text' },
    {
      name: 'status',
      type: 'select',
      required: true,
      defaultValue: 'new',
      options: ['new', 'triaged', 'in_progress', 'resolved', 'declined'],
      index: true,
    },
    { name: 'triageNote', type: 'textarea' },
    { name: 'githubIssueUrl', type: 'text' },
  ],
}
