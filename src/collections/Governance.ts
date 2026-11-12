import type { CollectionConfig } from 'payload'
import { noAccess, serverWrites } from '../lib/collectionAccess'

// S10 elections: nominations, screening, eligibility and results live here.
// votes are cast on belenios (secret, publicly verifiable ballots); the
// election's belenios link is externalRef

export const Elections: CollectionConfig = {
  slug: 'elections',
  access: {
    read: noAccess,
    ...serverWrites,
  },
  fields: [
    { name: 'title', type: 'text', required: true },
    {
      name: 'kind',
      type: 'select',
      required: true,
      defaultValue: 'focal_point',
      options: ['focal_point', 'other'],
    },
    {
      name: 'status',
      type: 'select',
      required: true,
      defaultValue: 'announced',
      options: [
        'announced',
        'nominations',
        'voting',
        'tallying',
        'completed',
        'restart_required',
        'cancelled',
      ],
      index: true,
    },
    { name: 'description', type: 'textarea' },
    {
      // Parallel races, e.g. global_south / global_north for FP elections.
      name: 'races',
      type: 'array',
      required: true,
      fields: [
        { name: 'slug', type: 'text', required: true },
        { name: 'label', type: 'text', required: true },
      ],
    },
    { name: 'nominationsOpenAt', type: 'date' },
    { name: 'nominationsCloseAt', type: 'date' },
    { name: 'votingOpensAt', type: 'date' },
    { name: 'votingCloseAt', type: 'date' },
    { name: 'quorumIndividuals', type: 'number', defaultValue: 100 },
    { name: 'quorumOrganisations', type: 'number', defaultValue: 25 },
    // Snapshot of the eligible registry at announcement (S10 §3.2).
    { name: 'eligibleIndividualCount', type: 'number' },
    { name: 'eligibleOrgCount', type: 'number' },
    { name: 'result', type: 'json' },
    // Link to an externally-run verifiable election (e.g. Belenios) when used.
    { name: 'externalRef', type: 'text' },
    { name: 'facilitationNote', type: 'textarea' },
  ],
}

export const ElectionCandidates: CollectionConfig = {
  slug: 'election-candidates',
  access: {
    read: noAccess,
    ...serverWrites,
  },
  fields: [
    {
      name: 'election',
      type: 'relationship',
      relationTo: 'elections',
      required: true,
      index: true,
    },
    { name: 'race', type: 'text', required: true, index: true },
    {
      name: 'account',
      type: 'relationship',
      relationTo: 'accounts',
      required: true,
      index: true,
    },
    { name: 'statement', type: 'textarea', required: true },
    { name: 'videoUrl', type: 'text' },
    {
      name: 'status',
      type: 'select',
      required: true,
      defaultValue: 'pending',
      options: ['pending', 'screened_in', 'screened_out', 'withdrawn'],
      index: true,
    },
    { name: 'screeningNote', type: 'textarea' },
    { name: 'nominatedAt', type: 'date', required: true },
  ],
}

// ── Selections (S24) ──
export const Selections: CollectionConfig = {
  slug: 'selections',
  access: {
    read: noAccess,
    ...serverWrites,
  },
  fields: [
    { name: 'title', type: 'text', required: true },
    { name: 'opportunityNote', type: 'textarea', required: true },
    {
      name: 'kind',
      type: 'select',
      required: true,
      defaultValue: 'standard',
      options: ['standard', 'wg_nomination'],
    },
    { name: 'bodyRef', type: 'text' },
    {
      name: 'status',
      type: 'select',
      required: true,
      defaultValue: 'committee_forming',
      options: [
        'committee_forming',
        'open',
        'closed',
        'evaluating',
        'decided',
        'announced',
        'cancelled',
      ],
      index: true,
    },
    {
      name: 'method',
      type: 'select',
      required: true,
      defaultValue: 'colour',
      options: ['colour', 'numerical'],
    },
    {
      name: 'criteria',
      type: 'array',
      fields: [
        { name: 'name', type: 'text', required: true },
        { name: 'weightPct', type: 'number', required: true },
      ],
    },
    { name: 'deadlineAt', type: 'date' },
    { name: 'spotsAvailable', type: 'number', defaultValue: 1 },
    { name: 'balanceNote', type: 'textarea' },
    { name: 'selectionSummary', type: 'textarea' },
    {
      name: 'createdBy',
      type: 'relationship',
      relationTo: 'accounts',
      required: true,
    },
  ],
}

export const SelectionCommittee: CollectionConfig = {
  slug: 'selection-committee',
  access: {
    read: noAccess,
    ...serverWrites,
  },
  fields: [
    {
      name: 'selection',
      type: 'relationship',
      relationTo: 'selections',
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
    { name: 'joinedAt', type: 'date', required: true },
    // COI recusals (S24 §2.2.4): applicant ids the member may not discuss.
    { name: 'recusedApplicantIds', type: 'json' },
    { name: 'coiNote', type: 'textarea' },
  ],
}

export const SelectionApplications: CollectionConfig = {
  slug: 'selection-applications',
  access: {
    read: noAccess,
    ...serverWrites,
  },
  fields: [
    {
      name: 'selection',
      type: 'relationship',
      relationTo: 'selections',
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
    { name: 'answers', type: 'json', required: true },
    { name: 'selfFinance', type: 'checkbox' },
    { name: 'gender', type: 'text' },
    { name: 'region', type: 'text' },
    {
      name: 'status',
      type: 'select',
      required: true,
      defaultValue: 'submitted',
      options: ['submitted', 'selected', 'not_selected', 'withdrawn'],
      index: true,
    },
    { name: 'submittedAt', type: 'date', required: true },
  ],
}

export const SelectionEvaluations: CollectionConfig = {
  slug: 'selection-evaluations',
  access: {
    // Evaluations stay confidential to the committee and staff.
    read: noAccess,
    ...serverWrites,
  },
  fields: [
    {
      name: 'selection',
      type: 'relationship',
      relationTo: 'selections',
      required: true,
      index: true,
    },
    {
      name: 'application',
      type: 'relationship',
      relationTo: 'selection-applications',
      required: true,
      index: true,
    },
    {
      name: 'evaluator',
      type: 'relationship',
      relationTo: 'accounts',
      required: true,
      index: true,
    },
    {
      // Colour method: BLACK/RED/ORANGE/YELLOW/GREEN.
      name: 'grade',
      type: 'select',
      options: ['black', 'red', 'orange', 'yellow', 'green'],
    },
    // Numerical method: scores 0-10 per criterion, revealed at the final
    // call (S24 Annex 3 option 2).
    { name: 'scores', type: 'json' },
    { name: 'comment', type: 'textarea' },
    { name: 'evaluatedAt', type: 'date', required: true },
  ],
}
