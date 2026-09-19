import type { CollectionConfig } from 'payload'

export const CouncilDecisions: CollectionConfig = {
  slug: 'council-decisions',
  admin: {
    useAsTitle: 'title',
    group: 'Content',
    defaultColumns: ['title', 'status', 'proposer'],
  },
  access: {
    read: () => true,
  },
  fields: [
    { name: 'slug', type: 'text', required: true, unique: true, index: true },
    { name: 'title', type: 'text', required: true },
    {
      name: 'status',
      type: 'select',
      required: true,
      defaultValue: 'proposed',
      options: [
        'proposed',
        'open_for_input',
        'objection_window',
        'adopted',
        'rejected',
        'withdrawn',
      ],
      index: true,
    },
    { name: 'summary', type: 'textarea' },
    { name: 'proposer', type: 'text', defaultValue: 'Focal points' },
    { name: 'proposalUrl', type: 'text' },
    { name: 'finalUrl', type: 'text' },
    { name: 'respondNote', type: 'textarea' },
    { name: 'outcomeNote', type: 'textarea' },
    { name: 'inputDeadline', type: 'date' },
    { name: 'objectionDeadline', type: 'date' },
    { name: 'decidedAt', type: 'date' },
    { name: 'statusLog', type: 'json' },
  ],
}
