import type { CollectionConfig } from 'payload'
import { grantsCapability, isStaff, isStaffField, staffWrites } from '../lib/collectionAccess'

// Operational workflow records — members act via src/endpoints/operations.ts;
// generated REST writes are staff-only; safeguarding is staff-read.

// S12 funding: submission → review → approval → disbursement → spend report.
export const FundingRequests: CollectionConfig = {
  slug: 'funding-requests',
  access: {
    read: async ({ req }) => {
      if (!req.user) return false
      if (req.user.collection === 'users') return true
      if (await grantsCapability(req, 'platform.manage')) return true
      return { account: { equals: req.user.id } }
    },
    ...staffWrites,
  },
  fields: [
    {
      name: 'account',
      type: 'relationship',
      relationTo: 'accounts',
      required: true,
      index: true,
    },
    { name: 'title', type: 'text', required: true },
    { name: 'purpose', type: 'textarea', required: true },
    { name: 'amountNumeric', type: 'number', required: true },
    { name: 'currency', type: 'text', required: true, defaultValue: 'EUR' },
    {
      name: 'category',
      type: 'select',
      required: true,
      options: ['event_travel', 'project', 'operations', 'other'],
    },
    { name: 'periodStart', type: 'date' },
    { name: 'periodEnd', type: 'date' },
    {
      name: 'status',
      type: 'select',
      required: true,
      defaultValue: 'submitted',
      options: [
        'submitted',
        'under_review',
        'approved',
        'rejected',
        'disbursed',
        'reported',
        'cancelled',
      ],
      index: true,
    },
    { name: 'reviewNote', type: 'textarea' },
    {
      name: 'reviewedBy',
      type: 'relationship',
      relationTo: 'accounts',
    },
    { name: 'reviewedAt', type: 'date' },
    { name: 'disbursedAt', type: 'date' },
    { name: 'reportNote', type: 'textarea' },
    { name: 'reportedAt', type: 'date' },
    { name: 'submittedAt', type: 'date', required: true },
  ],
}

// S23/S04 safeguarding + awareness. Strictly confidential: REST read is
// staff-only; reporters see only their own reference.
export const SafeguardingCases: CollectionConfig = {
  slug: 'safeguarding-cases',
  access: {
    read: isStaff,
    ...staffWrites,
  },
  fields: [
    {
      name: 'reporter',
      type: 'relationship',
      relationTo: 'accounts',
      index: true,
    },
    { name: 'anonymous', type: 'checkbox', defaultValue: false },
    {
      name: 'kind',
      type: 'select',
      required: true,
      options: ['safeguarding', 'child_safeguarding', 'concern', 'coc'],
    },
    {
      name: 'severity',
      type: 'select',
      required: true,
      defaultValue: 'medium',
      options: ['low', 'medium', 'high', 'critical'],
    },
    { name: 'description', type: 'textarea', required: true },
    { name: 'involvedParties', type: 'json' },
    {
      name: 'status',
      type: 'select',
      required: true,
      defaultValue: 'received',
      options: ['received', 'triaged', 'investigating', 'resolved', 'closed'],
      index: true,
    },
    {
      name: 'assignedTo',
      type: 'relationship',
      relationTo: 'accounts',
    },
    // Case timeline — confidential to the safeguarding team.
    {
      name: 'updates',
      type: 'array',
      access: { read: isStaffField },
      fields: [
        { name: 'note', type: 'textarea', required: true },
        { name: 'status', type: 'text' },
        {
          name: 'by',
          type: 'relationship',
          relationTo: 'accounts',
        },
        { name: 'at', type: 'date' },
      ],
    },
    { name: 'outcomeNote', type: 'textarea', access: { read: isStaffField } },
    { name: 'receivedAt', type: 'date', required: true },
    { name: 'closedAt', type: 'date' },
  ],
}

// S07 conflict-of-interest declarations.
export const CoiDeclarations: CollectionConfig = {
  slug: 'coi-declarations',
  access: {
    read: async ({ req }) => {
      if (!req.user) return false
      if (req.user.collection === 'users') return true
      if (await grantsCapability(req, 'platform.manage')) return true
      return { account: { equals: req.user.id } }
    },
    ...staffWrites,
  },
  fields: [
    {
      name: 'account',
      type: 'relationship',
      relationTo: 'accounts',
      required: true,
      index: true,
    },
    { name: 'interest', type: 'text', required: true },
    { name: 'details', type: 'textarea', required: true },
    { name: 'relatedScope', type: 'text' },
    {
      name: 'status',
      type: 'select',
      required: true,
      defaultValue: 'declared',
      options: ['declared', 'under_review', 'resolved', 'dismissed'],
      index: true,
    },
    { name: 'reviewNote', type: 'textarea' },
    {
      name: 'reviewedBy',
      type: 'relationship',
      relationTo: 'accounts',
    },
    { name: 'reviewedAt', type: 'date' },
    { name: 'declaredAt', type: 'date', required: true },
  ],
}

// S20 recognition certificates and letters.
export const RecognitionRequests: CollectionConfig = {
  slug: 'recognition-requests',
  access: {
    read: async ({ req }) => {
      if (!req.user) return false
      if (req.user.collection === 'users') return true
      if (await grantsCapability(req, 'platform.manage')) return true
      return { account: { equals: req.user.id } }
    },
    ...staffWrites,
  },
  fields: [
    {
      name: 'account',
      type: 'relationship',
      relationTo: 'accounts',
      required: true,
      index: true,
    },
    {
      name: 'kind',
      type: 'select',
      required: true,
      options: ['certificate', 'letter', 'other'],
    },
    { name: 'purpose', type: 'textarea', required: true },
    { name: 'eventRef', type: 'text' },
    {
      name: 'status',
      type: 'select',
      required: true,
      defaultValue: 'requested',
      options: ['requested', 'approved', 'issued', 'declined'],
      index: true,
    },
    { name: 'reviewNote', type: 'textarea' },
    {
      name: 'reviewedBy',
      type: 'relationship',
      relationTo: 'accounts',
    },
    { name: 'issuedAt', type: 'date' },
    { name: 'requestedAt', type: 'date', required: true },
  ],
}

// S13: the Council holds authority over major partnerships and financial
// sponsorships — records link back to the council decision that approved
// them where required.
export const PartnershipRequests: CollectionConfig = {
  slug: 'partnership-requests',
  access: {
    read: async ({ req }) => {
      if (!req.user) return false
      if (req.user.collection === 'users') return true
      if (await grantsCapability(req, 'platform.manage')) return true
      return { account: { equals: req.user.id } }
    },
    ...staffWrites,
  },
  fields: [
    {
      name: 'account',
      type: 'relationship',
      relationTo: 'accounts',
      required: true,
      index: true,
    },
    { name: 'organisationName', type: 'text', required: true },
    {
      name: 'kind',
      type: 'select',
      required: true,
      options: ['partnership', 'sponsorship', 'mou', 'other'],
    },
    { name: 'summary', type: 'textarea', required: true },
    { name: 'valueNote', type: 'textarea' },
    { name: 'requiresCouncilDecision', type: 'checkbox', defaultValue: false },
    {
      name: 'councilDecision',
      type: 'relationship',
      relationTo: 'decision-proposals',
    },
    {
      name: 'status',
      type: 'select',
      required: true,
      defaultValue: 'proposed',
      options: ['proposed', 'under_review', 'approved', 'active', 'declined', 'ended'],
      index: true,
    },
    { name: 'reviewNote', type: 'textarea' },
    {
      name: 'reviewedBy',
      type: 'relationship',
      relationTo: 'accounts',
    },
    { name: 'proposedAt', type: 'date', required: true },
    { name: 'endedAt', type: 'date' },
  ],
}

// S08 data-protection requests (access, erasure, rectification, objection).
// Statutory deadline is tracked on the record.
export const PrivacyRequests: CollectionConfig = {
  slug: 'privacy-requests',
  access: {
    read: async ({ req }) => {
      if (!req.user) return false
      if (req.user.collection === 'users') return true
      if (await grantsCapability(req, 'platform.manage')) return true
      return { account: { equals: req.user.id } }
    },
    ...staffWrites,
  },
  fields: [
    {
      name: 'account',
      type: 'relationship',
      relationTo: 'accounts',
      required: true,
      index: true,
    },
    {
      name: 'kind',
      type: 'select',
      required: true,
      options: ['access', 'erasure', 'rectification', 'portability', 'objection'],
    },
    { name: 'details', type: 'textarea', required: true },
    {
      name: 'status',
      type: 'select',
      required: true,
      defaultValue: 'received',
      options: ['received', 'in_progress', 'fulfilled', 'declined'],
      index: true,
    },
    { name: 'responseNote', type: 'textarea' },
    { name: 'dueAt', type: 'date', required: true },
    {
      name: 'handledBy',
      type: 'relationship',
      relationTo: 'accounts',
    },
    { name: 'fulfilledAt', type: 'date' },
    { name: 'requestedAt', type: 'date', required: true },
  ],
}
