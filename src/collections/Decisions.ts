import type { CollectionConfig } from 'payload'
import { isStaff, isStaffOrMember, staffWrites } from '../lib/collectionAccess'

// S09 decision-making: consultation → revision → decision → (consensus |
// voting) via the src/endpoints/decisions.ts state machine. REST writes are
// staff-only — members act through endpoints so rules and audit hold.

export const DecisionProposals: CollectionConfig = {
  slug: 'decision-proposals',
  access: {
    read: isStaffOrMember,
    ...staffWrites,
  },
  fields: [
    { name: 'title', type: 'text', required: true },
    { name: 'context', type: 'textarea', required: true },
    { name: 'proposalText', type: 'textarea', required: true },
    {
      name: 'decisionType',
      type: 'select',
      required: true,
      defaultValue: 'standard',
      options: ['standard', 'snap', 'og_standard', 'og_snap', 'press_release'],
    },
    {
      name: 'body',
      type: 'select',
      required: true,
      options: ['council', 'working_group', 'operational_team', 'gct', 'constituency'],
      index: true,
    },
    {
      // WG slug / team name for scoped bodies; null for council-wide.
      name: 'bodyRef',
      type: 'text',
      index: true,
    },
    { name: 'snapJustification', type: 'textarea' },
    { name: 'snapDeadline', type: 'date' },
    // Drafting policy version + snap window hours (audit/publication).
    { name: 'policyVersion', type: 'text' },
    { name: 'snapHours', type: 'number' },
    // Optimistic-lock counter, incremented on every edit/transition.
    { name: 'version', type: 'number', defaultValue: 1 },
    // Legacy platform_decisions uuid for old links.
    { name: 'legacyRef', type: 'text', index: true },
    {
      name: 'status',
      type: 'select',
      required: true,
      defaultValue: 'draft',
      options: [
        'draft',
        'consultation',
        'revision',
        'decision',
        'voting',
        'adopted',
        'vetoed',
        'withdrawn',
        'failed_quorum',
        'rejected',
      ],
      index: true,
    },
    {
      name: 'proposedBy',
      type: 'relationship',
      relationTo: 'accounts',
      required: true,
      index: true,
    },
    {
      name: 'contactPersons',
      type: 'relationship',
      relationTo: 'accounts',
      hasMany: true,
      required: true,
    },
    { name: 'presentedAt', type: 'date' },
    { name: 'consultationEndsAt', type: 'date' },
    { name: 'revisionEndsAt', type: 'date' },
    { name: 'decisionEndsAt', type: 'date' },
    { name: 'votingEndsAt', type: 'date' },
    // Eligible-voter snapshot at voting open — the 5% quorum base (S09 §2).
    { name: 'eligibleVoterCount', type: 'number' },
    {
      name: 'ballotOptions',
      type: 'array',
      fields: [{ name: 'option', type: 'text', required: true }],
    },
    {
      name: 'adoptedVia',
      type: 'select',
      options: ['consensus', 'consensus_with_reservations', 'vote', 'meeting'],
    },
    { name: 'decidedAt', type: 'date' },
    { name: 'resultSummary', type: 'textarea' },
    { name: 'trackerUrl', type: 'text' },
    // Outcome: evidence link/note plus tally when a vote closed it.
    { name: 'outcomeEvidence', type: 'textarea' },
    { name: 'votesFor', type: 'number' },
    { name: 'votesAgainst', type: 'number' },
    // Approved for the public decision register by a content publisher.
    { name: 'isPublic', type: 'checkbox', defaultValue: false },
    {
      name: 'revisions',
      type: 'array',
      fields: [
        { name: 'version', type: 'number', required: true },
        { name: 'title', type: 'text', required: true },
        { name: 'proposal', type: 'textarea', required: true },
        { name: 'createdAt', type: 'date' },
      ],
    },
  ],
}

export const DecisionFlags: CollectionConfig = {
  slug: 'decision-flags',
  access: {
    read: isStaffOrMember,
    ...staffWrites,
  },
  fields: [
    {
      name: 'proposal',
      type: 'relationship',
      relationTo: 'decision-proposals',
      required: true,
      index: true,
    },
    {
      name: 'kind',
      type: 'select',
      required: true,
      options: ['red', 'grey'],
      index: true,
    },
    {
      name: 'rationaleCategory',
      type: 'select',
      options: [
        'principles_violation',
        'coc_violation',
        'science_contradiction',
        'past_decision_contradiction',
        'process_noncompliance',
        'mission_misalignment',
        'inadequate_consultation',
        'grey_flag_unsatisfactory',
      ],
    },
    { name: 'reason', type: 'textarea', required: true },
    { name: 'alternative', type: 'textarea' },
    {
      name: 'raisedBy',
      type: 'relationship',
      relationTo: 'accounts',
      required: true,
      index: true,
    },
    {
      name: 'status',
      type: 'select',
      required: true,
      defaultValue: 'open',
      options: ['open', 'addressed', 'withdrawn', 'nullified'],
      index: true,
    },
    { name: 'responseNote', type: 'textarea' },
    {
      name: 'respondedBy',
      type: 'relationship',
      relationTo: 'accounts',
    },
    { name: 'respondedAt', type: 'date' },
    { name: 'raisedAt', type: 'date', required: true },
  ],
}

export const DecisionComments: CollectionConfig = {
  slug: 'decision-comments',
  access: {
    read: isStaffOrMember,
    ...staffWrites,
  },
  fields: [
    {
      name: 'proposal',
      type: 'relationship',
      relationTo: 'decision-proposals',
      required: true,
      index: true,
    },
    {
      name: 'account',
      type: 'relationship',
      relationTo: 'accounts',
      required: true,
      index: true,
    },
    { name: 'body', type: 'textarea', required: true },
    { name: 'createdAt', type: 'date', required: true },
  ],
}

export const DecisionBallots: CollectionConfig = {
  slug: 'decision-ballots',
  access: {
    read: isStaffOrMember,
    ...staffWrites,
  },
  // One ballot per member per proposal — enforced at the database.
  indexes: [{ unique: true, fields: ['proposal', 'account'] }],
  fields: [
    {
      name: 'proposal',
      type: 'relationship',
      relationTo: 'decision-proposals',
      required: true,
      index: true,
    },
    {
      name: 'account',
      type: 'relationship',
      relationTo: 'accounts',
      required: true,
      index: true,
    },
    { name: 'choice', type: 'text', required: true },
    { name: 'castAt', type: 'date', required: true },
  ],
}

export const DecisionVetoes: CollectionConfig = {
  slug: 'decision-vetoes',
  access: {
    read: isStaffOrMember,
    ...staffWrites,
  },
  fields: [
    {
      name: 'proposal',
      type: 'relationship',
      relationTo: 'decision-proposals',
      required: true,
      index: true,
    },
    {
      name: 'requesterKind',
      type: 'select',
      required: true,
      options: ['org', 'org_global_south', 'wg_or_ot'],
    },
    {
      // Org name or WG/OT slug — one request per body.
      name: 'groupKey',
      type: 'text',
      required: true,
    },
    { name: 'reasoning', type: 'textarea', required: true },
    {
      name: 'requestedBy',
      type: 'relationship',
      relationTo: 'accounts',
      required: true,
    },
    {
      name: 'status',
      type: 'select',
      required: true,
      defaultValue: 'pending',
      options: ['pending', 'confirmed', 'rejected'],
      index: true,
    },
    { name: 'createdAt', type: 'date', required: true },
  ],
}

export const DecisionEvents: CollectionConfig = {
  slug: 'decision-events',
  access: {
    read: isStaffOrMember,
    create: isStaff,
    update: () => false,
    delete: () => false,
  },
  fields: [
    {
      name: 'proposal',
      type: 'relationship',
      relationTo: 'decision-proposals',
      required: true,
      index: true,
    },
    { name: 'type', type: 'text', required: true },
    {
      name: 'actor',
      type: 'relationship',
      relationTo: 'accounts',
    },
    { name: 'detail', type: 'json' },
    { name: 'createdAt', type: 'date', required: true },
  ],
}
