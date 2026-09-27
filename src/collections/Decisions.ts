import type { CollectionConfig } from 'payload'
import { isStaff, isStaffOrMember, staffWrites } from '../lib/collectionAccess'

// S09 Decision-Making Processes — proposals move through
// consultation → revision → decision → (consensus | voting) via the
// src/endpoints/decisions.ts state machine. Direct REST writes are staff-only;
// members act through the endpoints so phase rules, eligibility and audit
// logging are enforced in one place.

export const DecisionProposals: CollectionConfig = {
  slug: 'decision-proposals',
  admin: {
    useAsTitle: 'title',
    group: 'Governance',
    defaultColumns: ['title', 'body', 'status', 'decisionType'],
  },
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
      options: [
        'council',
        'working_group',
        'operational_team',
        'gct',
        'constituency',
      ],
      index: true,
    },
    {
      // Working-group slug or team name for scoped bodies; null for
      // council/constituency-wide decisions.
      name: 'bodyRef',
      type: 'text',
      index: true,
    },
    { name: 'snapJustification', type: 'textarea' },
    { name: 'snapDeadline', type: 'date' },
    // Policy version the proposal was drafted under, and the snap window in
    // hours — both carried for audit/publication displays.
    { name: 'policyVersion', type: 'text' },
    { name: 'snapHours', type: 'number' },
    // Optimistic-lock counter, incremented on every edit/transition.
    { name: 'version', type: 'number', defaultValue: 1 },
    // Legacy platform_decisions uuid, kept so old links keep resolving.
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
    // Snapshot of the eligible-voter count taken when voting opens; the
    // 5% quorum is computed against this (S09 §2 step 6).
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
    // Outcome record: evidence link/note plus the recorded tally when a vote
    // closed the proposal.
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
  admin: {
    useAsTitle: 'id',
    group: 'Governance',
    defaultColumns: ['proposal', 'kind', 'status', 'raisedBy'],
  },
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
  admin: {
    useAsTitle: 'id',
    group: 'Governance',
    defaultColumns: ['proposal', 'account'],
  },
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
  admin: {
    useAsTitle: 'id',
    group: 'Governance',
    defaultColumns: ['proposal', 'account', 'choice'],
  },
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
    { name: 'choice', type: 'text', required: true },
    { name: 'castAt', type: 'date', required: true },
  ],
}

export const DecisionVetoes: CollectionConfig = {
  slug: 'decision-vetoes',
  admin: {
    useAsTitle: 'id',
    group: 'Governance',
    defaultColumns: ['proposal', 'requesterKind', 'groupKey', 'status'],
  },
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
      // Organisation name or WG/OT slug — one request counts once per body.
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
  admin: {
    useAsTitle: 'type',
    group: 'Governance',
    defaultColumns: ['proposal', 'type', 'actor', 'createdAt'],
  },
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
