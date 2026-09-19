import type { CollectionConfig } from 'payload'

// Global Youth Statement cycle: static reference content (current edition,
// priorities, process, archive) + incoming contribution records.
export const GysCycles: CollectionConfig = {
  slug: 'gys-cycles',
  admin: {
    useAsTitle: 'title',
    group: 'Content',
  },
  access: {
    read: () => true,
  },
  fields: [
    { name: 'year', type: 'number', required: true, unique: true },
    { name: 'edition', type: 'text' },
    { name: 'title', type: 'text', required: true },
    { name: 'location', type: 'text' },
    { name: 'targetSession', type: 'text' },
    { name: 'intro', type: 'textarea' },
    { name: 'note', type: 'textarea' },
    { name: 'fullUrl', type: 'text' },
    { name: 'inputsUrl', type: 'text' },
    { name: 'inputsDeadlineAt', type: 'date' },
    { name: 'releaseUrl', type: 'text' },
    { name: 'priorities', type: 'json' },
    { name: 'process', type: 'json' },
    { name: 'archive', type: 'json' },
    { name: 'isCurrent', type: 'checkbox', defaultValue: false, index: true },
  ],
}

// Team workflow records (distinct from the public signup list): contributions
// the GYS policy team tracks toward the statement.
export const GysWorkflowCycles: CollectionConfig = {
  slug: 'gys-workflow-cycles',
  admin: { useAsTitle: 'title', group: 'GYS workflow' },
  access: {
    read: ({ req }) => Boolean(req.user),
    create: ({ req }) => req.user?.collection === 'users',
    update: ({ req }) => Boolean(req.user),
  },
  fields: [
    { name: 'code', type: 'text', required: true, unique: true },
    { name: 'title', type: 'text', required: true },
    { name: 'year', type: 'number', required: true },
    {
      name: 'status',
      type: 'select',
      required: true,
      defaultValue: 'intake',
      options: ['planning', 'intake', 'synthesis', 'review', 'consultation', 'approved', 'published', 'archived'],
      index: true,
    },
    { name: 'opensAt', type: 'date' },
    { name: 'closesAt', type: 'date' },
  ],
}

export const GysTrackedContributions: CollectionConfig = {
  slug: 'gys-tracked-contributions',
  admin: { useAsTitle: 'title', group: 'GYS workflow' },
  access: {
    read: ({ req }) => Boolean(req.user),
    create: ({ req }) => Boolean(req.user),
    update: ({ req }) => Boolean(req.user),
  },
  fields: [
    { name: 'cycle', type: 'relationship', relationTo: 'gys-workflow-cycles', required: true, index: true },
    { name: 'title', type: 'text', required: true },
    { name: 'body', type: 'textarea' },
    { name: 'theme', type: 'text' },
    { name: 'region', type: 'text' },
    { name: 'country', type: 'text' },
    { name: 'submitterType', type: 'text' },
    { name: 'organization', type: 'text' },
    { name: 'source', type: 'text', defaultValue: 'manual' },
    { name: 'externalId', type: 'text' },
    { name: 'rawAnswers', type: 'json' },
    { name: 'author', type: 'relationship', relationTo: 'accounts' },
    { name: 'reviewer', type: 'relationship', relationTo: 'accounts' },
    {
      name: 'status',
      type: 'select',
      required: true,
      defaultValue: 'submitted',
      options: ['submitted', 'triaged', 'drafting', 'needs_review', 'approved', 'rejected', 'published'],
      index: true,
    },
    { name: 'version', type: 'number', defaultValue: 1 },
  ],
}

export const GysContributions: CollectionConfig = {
  slug: 'gys-contributions',
  admin: {
    useAsTitle: 'name',
    group: 'Content',
    defaultColumns: ['name', 'email', 'country', 'cycle'],
  },
  access: {
    read: ({ req }) => req.user?.collection === 'users',
    create: () => true, // public signup form
  },
  fields: [
    { name: 'cycle', type: 'text', required: true },
    { name: 'name', type: 'text', required: true },
    { name: 'email', type: 'email', required: true },
    { name: 'country', type: 'text' },
    { name: 'organization', type: 'text' },
  ],
}
