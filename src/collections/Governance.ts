import type { CollectionConfig } from 'payload'
import { isStaff, isStaffOrMember, staffWrites } from '../lib/collectionAccess'

// S10 elections: secret ballots are held on voter credentials (random tokens)
// rather than account references — the ballot table deliberately cannot be
// joined back to an account, giving server-trust secrecy. This is NOT an
// end-to-end verifiable scheme like Belenios (see vault OSS evaluation); an
// externally-run election can be recorded via elections.externalRef.

export const Elections: CollectionConfig = {
  slug: 'elections',
  access: {
    read: isStaffOrMember,
    ...staffWrites,
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
    read: isStaffOrMember,
    ...staffWrites,
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

// Voter registry snapshot: one credential (random token) per eligible voter
// per election. Only the token's HMAC is stored — the raw token is returned
// once at issuance and never persisted.
export const ElectionVoters: CollectionConfig = {
  slug: 'election-voters',
  access: {
    read: isStaff,
    ...staffWrites,
  },
  fields: [
    {
      name: 'election',
      type: 'relationship',
      relationTo: 'elections',
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
    {
      name: 'kind',
      type: 'select',
      required: true,
      options: ['individual', 'organisation'],
    },
    { name: 'tokenHash', type: 'text', required: true, index: true },
    { name: 'issuedAt', type: 'date', required: true },
    { name: 'votedAt', type: 'date' },
  ],
}

// Secret ballot: keyed by election + race + token hash. No account column.
export const ElectionBallots: CollectionConfig = {
  slug: 'election-ballots',
  access: {
    read: isStaff,
    ...staffWrites,
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
    { name: 'voterTokenHash', type: 'text', required: true, index: true },
    {
      name: 'kind',
      type: 'select',
      required: true,
      options: ['individual', 'organisation'],
    },
    // Ordered candidate ids; empty array = blank ballot.
    { name: 'ranks', type: 'json', required: true },
    { name: 'castAt', type: 'date', required: true },
  ],
}

// ── Selections (S24) ─────────────────────────────────────────────────────

export const Selections: CollectionConfig = {
  slug: 'selections',
  access: {
    read: isStaffOrMember,
    ...staffWrites,
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
    read: isStaffOrMember,
    ...staffWrites,
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
    // COI declarations → recusals (S24 §2.2.4): the member lists applicant
    // ids they must not discuss or score.
    { name: 'recusedApplicantIds', type: 'json' },
    { name: 'coiNote', type: 'textarea' },
  ],
}

export const SelectionApplications: CollectionConfig = {
  slug: 'selection-applications',
  access: {
    read: isStaffOrMember,
    ...staffWrites,
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
    // Evaluations stay confidential to the committee + staff.
    read: isStaff,
    ...staffWrites,
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
    // Numerical method: per-criterion scores 0-10 (recorded privately, then
    // revealed at the final call — S24 Annex 3 option 2).
    { name: 'scores', type: 'json' },
    { name: 'comment', type: 'textarea' },
    { name: 'evaluatedAt', type: 'date', required: true },
  ],
}
